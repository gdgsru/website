#!/usr/bin/env python3
"""
build_profiles.py - GDG SRU member profile generator (offline, no network, no secrets).

Input : verified_responses.csv  (Google Sheet export, only rows flagged Approved = TRUE are used)
Output: <site>/data/profiles/{handle}.json   one static profile per member
        <site>/data/profiles_index.json      alphabetical index for Cmd+K search
        build/members_seed.sql               PRIVATE: handle -> email hash / roll for Supabase
                                             (paste into the Supabase SQL Editor, do NOT commit)

Usage:
    python scripts/build_profiles.py verified_responses.csv
    python scripts/build_profiles.py verified_responses.csv --roll-display full --dayfirst

Photos: student photos are never published. Each member gets one of the 30 curated avatars
(assets/avatars/avatar-01..30.svg). A member can choose one in the sheet ("Avatar" column, e.g. 7 or avatar-07);
otherwise a stable pick is made from their handle, so it doesn't change between rebuilds.

Privacy: emails are never written to the public JSON, and roll numbers are masked there unless
you pass --roll-display full. The full roll and a SHA-256 email hash only go to the private seed.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ALLOWED_DOMAIN = "@sru.edu.in"
THEMES = {"google-blue", "google-red", "google-yellow", "google-green", "terminal-dark"}
DEFAULT_THEME = "google-blue"
RESERVED_HANDLES = {"admin", "api", "u", "profile", "verify", "assets", "data", "index", "me", "team", "events"}
ROLL_SHAPE = re.compile(r"^[0-9]{4}[A-Z][0-9]{5}$")  # e.g. 2403A51001 (warning only if different)
AVATAR_COUNT = 30  # must match the files in cloudflare-pages-site/assets/avatars/
TRUTHY = {"true", "yes", "y", "1", "approved", "x", "checked", "✓"}

# Header aliases (case-insensitive, punctuation ignored). Add your Form's wording here,
# or pass --map field=Exact Header on the command line.
ALIASES = {
    "timestamp": ["timestamp"],
    "email": ["email address", "email", "sru email", "college email", "official email"],
    "name": ["full name", "name"],
    "roll": ["roll number", "roll no", "roll", "student id", "registration number"],
    "department": ["department", "branch", "dept", "school"],
    "cohort": ["cohort", "cohort year", "batch", "year of joining", "admission year"],
    "handle": ["desired handle", "handle", "username", "desired username", "profile handle"],
    "github": ["github", "github username", "github url", "github profile"],
    "portfolio": ["portfolio", "portfolio url", "website", "personal website"],
    "linkedin": ["linkedin", "linkedin url", "linkedin profile"],
    "bio": ["bio", "about you", "short bio", "about"],
    "theme": ["theme", "card theme", "pass theme", "accent"],
    "skills": ["skills", "tech stack", "interests", "skills and interests"],
    "approved": ["approved"],
    "avatar": ["avatar", "avatar choice", "pass avatar"],
}


def norm_header(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def build_column_map(headers: list[str], overrides: dict[str, str]) -> dict[str, str | None]:
    by_norm = {norm_header(h): h for h in headers}
    colmap: dict[str, str | None] = {}
    for field, names in ALIASES.items():
        if field in overrides:
            colmap[field] = overrides[field]
            continue
        colmap[field] = next((by_norm[n] for n in map(norm_header, names) if n in by_norm), None)
    return colmap


def normalize_roll(raw: str) -> str:
    """'2403a5-1001' / '2403 A51001' -> '2403A51001' (same rule as private.norm_roll in Supabase)."""
    return re.sub(r"[^A-Za-z0-9]", "", raw or "").upper()


def sanitize_handle(raw: str) -> str:
    h = re.sub(r"[^a-z0-9_-]", "", (raw or "").strip().lower().lstrip("@"))
    return h.strip("-_")[:32]


def slug_from_name(name: str) -> str:
    return sanitize_handle(re.sub(r"\s+", "-", name.strip().lower()))


def clean_text(raw: str, limit: int) -> str:
    """Strip control chars and angle brackets. The browser still escapes on render; this is defence in depth."""
    s = re.sub(r"[\x00-\x1f\x7f<>]", " ", raw or "")
    return re.sub(r"\s+", " ", s).strip()[:limit]


def safe_url(raw: str) -> str:
    """http(s) only. Anything else (javascript:, data:, mailto:...) is dropped."""
    u = (raw or "").strip()
    if not u:
        return ""
    if not re.match(r"^[a-z][a-z0-9+.-]*:", u, re.I):
        u = "https://" + u  # "example.dev" -> https://example.dev
    if not re.match(r"^https?://[^\s<>\"']+$", u, re.I):
        return ""
    return u[:300]


def github_username(raw: str) -> str:
    s = (raw or "").strip().rstrip("/")
    m = re.search(r"github\.com/([A-Za-z0-9-]{1,39})", s, re.I)
    s = m.group(1) if m else s.lstrip("@")
    return s if re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})", s) else ""


def parse_timestamp(raw: str, dayfirst: bool) -> datetime | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    fmts = ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"]
    us = ["%m/%d/%Y %H:%M:%S", "%m/%d/%Y %H:%M", "%m/%d/%Y"]
    eu = ["%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y"]
    for fmt in fmts + (eu + us if dayfirst else us + eu):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


def pick_avatar(raw: str, handle: str) -> tuple[str, bool]:
    """Returns (avatar_id, was_chosen). Accepts 7, 07, avatar-7 or avatar-07. Anything else falls back to a
    stable hash of the handle, so the same person keeps the same avatar across rebuilds."""
    m = re.fullmatch(r"(?:avatar-?)?0*(\d{1,2})", (raw or "").strip().lower())
    if m and 1 <= int(m.group(1)) <= AVATAR_COUNT:
        return f"avatar-{int(m.group(1)):02d}", True
    digest = hashlib.sha256(handle.encode("utf-8")).digest()
    return f"avatar-{int.from_bytes(digest[:4], 'big') % AVATAR_COUNT + 1:02d}", False


def mask_roll(roll: str) -> str:
    return roll if len(roll) <= 6 else roll[:4] + "•" * (len(roll) - 6) + roll[-2:]


def email_hash(email: str) -> str:
    # Must match Supabase: encode(extensions.digest(lower(btrim(email)), 'sha256'), 'hex')
    return hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()


def sql_ident_ok(handle: str, roll: str, ehash: str) -> bool:
    return bool(re.fullmatch(r"[a-z0-9_-]{2,32}", handle) and re.fullmatch(r"[A-Z0-9]*", roll)
                and re.fullmatch(r"[0-9a-f]{64}", ehash))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", type=Path, help="verified_responses.csv exported from the Google Sheet")
    ap.add_argument("--site-dir", type=Path, default=None,
                    help="static site root (default: ./cloudflare-pages-site, else ./public)")
    ap.add_argument("--seed-out", type=Path, default=Path("build/members_seed.sql"))
    ap.add_argument("--roll-display", choices=["masked", "full"], default="masked",
                    help="how the roll number appears in PUBLIC json (default: masked)")
    ap.add_argument("--dayfirst", action="store_true", help="timestamps are DD/MM/YYYY (default MM/DD/YYYY)")
    ap.add_argument("--keep-stale", action="store_true", help="do not delete old profile json files")
    ap.add_argument("--map", action="append", default=[], metavar="FIELD=Header",
                    help="override a column, e.g. --map handle='Pick a username'")
    args = ap.parse_args()

    site = args.site_dir or next((p for p in (Path("cloudflare-pages-site"), Path("public")) if p.is_dir()), None)
    if site is None:
        print("ERROR: no site dir found. Pass --site-dir.", file=sys.stderr)
        return 1
    profiles_dir = site / "data" / "profiles"
    index_path = site / "data" / "profiles_index.json"

    overrides = {}
    for item in args.map:
        k, _, v = item.partition("=")
        if k not in ALIASES or not v:
            print(f"ERROR: bad --map '{item}'. Fields: {', '.join(ALIASES)}", file=sys.stderr)
            return 1
        overrides[k] = v

    with args.csv.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        rows = list(reader)
        headers = reader.fieldnames or []
    cols = build_column_map(headers, overrides)
    missing = [f for f in ("email", "name", "roll", "handle", "approved") if not cols.get(f)]
    if missing:
        print(f"ERROR: could not find column(s): {', '.join(missing)}\nHeaders seen: {headers}\n"
              "Use --map field='Exact Header' to point at them.", file=sys.stderr)
        return 1

    def get(row: dict, field: str) -> str:
        c = cols.get(field)
        return (row.get(c) or "").strip() if c else ""

    stats = {"rows": len(rows), "unapproved": 0, "bad_domain": 0, "no_roll": 0, "dupes": 0}
    candidates: dict[str, dict] = {}  # roll -> latest record

    for i, row in enumerate(rows):
        if get(row, "approved").lower() not in TRUTHY:
            stats["unapproved"] += 1
            continue
        email = get(row, "email").lower()
        if not email.endswith(ALLOWED_DOMAIN):
            stats["bad_domain"] += 1
            print(f"  skip (row {i + 2}): not an {ALLOWED_DOMAIN} address -> {email or '(blank)'}")
            continue
        roll = normalize_roll(get(row, "roll"))
        if not roll:
            stats["no_roll"] += 1
            print(f"  skip (row {i + 2}): missing roll number -> {email}")
            continue
        if not ROLL_SHAPE.match(roll):
            print(f"  warn (row {i + 2}): roll '{roll}' does not look like 2403A51001 ({email})")
        ts = parse_timestamp(get(row, "timestamp"), args.dayfirst)
        # Latest timestamp wins. Rows without a parsable timestamp fall back to sheet order.
        sort_key = (ts or datetime.min, i)
        rec = {"row": i + 2, "key": sort_key, "ts": ts, "email": email, "roll": roll, "src": row}
        prev = candidates.get(roll)
        if prev:
            stats["dupes"] += 1
        if not prev or sort_key > prev["key"]:
            candidates[roll] = rec

    # One pass per email: if one email shows up under two rolls, keep the latest and say so.
    by_email: dict[str, dict] = {}
    for rec in sorted(candidates.values(), key=lambda r: r["key"]):
        if rec["email"] in by_email:
            old = by_email[rec["email"]]
            print(f"  warn: {rec['email']} used for rolls {old['roll']} and {rec['roll']}; keeping latest ({rec['roll']})")
        by_email[rec["email"]] = rec
    deduped = list(by_email.values())

    # Handles: sanitize, reserve-check, then detect collisions.
    by_handle: dict[str, list[dict]] = {}
    for rec in deduped:
        raw = get(rec["src"], "handle")
        name = clean_text(get(rec["src"], "name"), 80)
        h = sanitize_handle(raw) or slug_from_name(name)
        rec["name"] = name
        if len(h) < 2 or h in RESERVED_HANDLES:
            print(f"  conflict: handle '{raw}' unusable/reserved for {name} ({rec['roll']}); fix it in the sheet")
            rec["handle"] = ""
            continue
        rec["handle"] = h
        by_handle.setdefault(h, []).append(rec)

    collisions = {h: rs for h, rs in by_handle.items() if len(rs) > 1}
    if collisions:
        print("\n=== USERNAME COLLISIONS (none of these were published; edit the handle in the sheet and re-run) ===")
        for h, rs in sorted(collisions.items()):
            print(f"  @{h}")
            for r in sorted(rs, key=lambda r: r["key"]):
                when = r["ts"].strftime("%Y-%m-%d %H:%M") if r["ts"] else "no timestamp"
                print(f"     - {r['name']:<28} {r['roll']:<12} {r['email']:<34} {get(r['src'], 'department')[:24]:<24} row {r['row']}  {when}")
        print()

    final = [rs[0] for h, rs in by_handle.items() if len(rs) == 1]
    now = datetime.now(timezone.utc)
    derived_cohort = 0
    profiles: list[dict] = []
    for rec in final:
        src, roll = rec["src"], rec["roll"]
        theme = get(src, "theme").lower().replace(" ", "-")
        theme = theme if theme in THEMES else DEFAULT_THEME
        cohort = clean_text(get(src, "cohort"), 12)
        if not cohort and re.match(r"^\d{2}", roll):
            cohort = "20" + roll[:2]  # best-effort from the roll prefix; edit the sheet to override
            derived_cohort += 1
        skills = [clean_text(s, 24) for s in re.split(r"[,;\n]", get(src, "skills")) if s.strip()][:8]
        avatar, chosen = pick_avatar(get(src, "avatar"), rec["handle"])
        if get(src, "avatar") and not chosen:
            print(f"  warn: avatar '{get(src, 'avatar')}' for @{rec['handle']} is not 1-{AVATAR_COUNT}; using a default instead")
        profiles.append({
            "schema": 1,
            "handle": rec["handle"],
            "name": rec["name"],
            "roll_display": roll if args.roll_display == "full" else mask_roll(roll),
            "department": clean_text(get(src, "department"), 60),
            "cohort": cohort,
            "status": "verified",
            "theme": theme,
            "avatar": avatar,
            "github": github_username(get(src, "github")),
            "portfolio": safe_url(get(src, "portfolio")),
            "linkedin": safe_url(get(src, "linkedin")),
            "bio": clean_text(get(src, "bio"), 240),
            "skills": skills,
            "joined": (rec["ts"] or now).strftime("%Y-%m-%d"),
            "_roll": roll, "_email": rec["email"],  # stripped before writing
        })
    profiles.sort(key=lambda p: (p["name"].casefold(), p["handle"]))

    # ---- write public files -------------------------------------------------
    profiles_dir.mkdir(parents=True, exist_ok=True)
    written = set()
    for p in profiles:
        public = {k: v for k, v in p.items() if not k.startswith("_")}
        path = profiles_dir / f"{p['handle']}.json"
        path.write_text(json.dumps(public, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        written.add(path.name)
    removed = 0
    if not args.keep_stale:
        for old in profiles_dir.glob("*.json"):
            if old.name not in written:
                old.unlink()
                removed += 1

    index = {
        "v": 1,
        "generated": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        # u = handle, n = name, d = department, c = cohort
        "profiles": [{"u": p["handle"], "n": p["name"], "d": p["department"], "c": p["cohort"]} for p in profiles],
    }
    index_path.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    # ---- write PRIVATE seed -------------------------------------------------
    # Mirrors the sheet WITHOUT wiping admin decisions: members whose (handle, email) pair is unchanged are
    # updated in place, so a "hidden" flag set in Mission Control survives the next batch.
    args.seed_out.parent.mkdir(parents=True, exist_ok=True)
    values = []
    for p in profiles:
        eh = email_hash(p["_email"])
        if not sql_ident_ok(p["handle"], p["_roll"], eh):
            print(f"  skip seed row for @{p['handle']}: failed validation")
            continue
        values.append(f"  ('{p['handle']}', '{eh}', '{p['_roll']}')")
    if values:
        lines = [
            "-- PRIVATE. Generated by build_profiles.py. Do not commit. Paste into the Supabase SQL Editor.",
            "-- Mirrors the sheet: adds new members, updates changed rows, removes people no longer listed.",
            "-- Members whose handle + email are unchanged keep their Mission Control 'hidden' setting.",
            "begin;",
            "create temp table _seed (handle text, email_hash text, roll_norm text) on commit drop;",
            "insert into _seed (handle, email_hash, roll_norm) values",
            ",\n".join(values) + ";",
            "delete from public.member_profiles m",
            " where not exists (select 1 from _seed s where s.handle = m.handle and s.email_hash = m.email_hash);",
            "insert into public.member_profiles (handle, email_hash, roll_norm)",
            "  select handle, email_hash, roll_norm from _seed",
            "  on conflict (handle) do update set roll_norm = excluded.roll_norm, updated_at = now();",
            "commit;",
        ]
    else:
        # Never emit a script that would empty the table because of a bad or empty export.
        lines = ["-- No publishable members in this export, so nothing to change. (Refusing to generate a delete-everything script.)"]
        print("  WARNING: no publishable members; seed file is a no-op.")
    args.seed_out.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(
        f"\nRows read: {stats['rows']} | not approved: {stats['unapproved']} | bad domain: {stats['bad_domain']} | "
        f"no roll: {stats['no_roll']} | duplicate submissions merged: {stats['dupes']}\n"
        f"Published profiles: {len(profiles)} | collisions held back: {sum(len(r) for r in collisions.values())} | "
        f"stale files removed: {removed} | cohort derived from roll: {derived_cohort}\n"
        f"Wrote {profiles_dir}/ , {index_path} , {args.seed_out} (private)"
    )
    return 2 if collisions else 0


if __name__ == "__main__":
    sys.exit(main())
