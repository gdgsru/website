#!/usr/bin/env python3
"""Build one CSS bundle per page (site/assets/css/page-<route>.css) from css-src/*.css.

What it does (no dependencies, Python 3.8+):
  1. Collects every word used in the site's HTML and JS (class names, ids, data-* names).
  2. Drops CSS rules/selectors that can never match: a selector is kept only if every
     .class, #id and [data-*] it requires appears somewhere in the HTML/JS.
  3. Drops rules scoped to a different route (.page-team, [data-route=team] ...) from each
     page's bundle: every page only ever renders its own .page-<route> container.
  4. Drops @keyframes nothing refers to, then strips comments and whitespace.
  5. Concatenates the layers in their original cascade order, so each page loads one file.

It is deliberately conservative: classes built at runtime ("g16-" + name) are covered
by a prefix check, :not()/:is()/:where()/:has() arguments are ignored, rules that use
CSS nesting are kept untouched, and custom properties are never removed.

Edit css-src/*.css, then run:  python scripts/build-css.py
Never edit site/assets/css/page-*.css by hand: they are regenerated.
"""
import glob, os, re, sys, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "css-src")
OUT = os.path.join(ROOT, "site", "assets", "css")
SITE = os.path.join(ROOT, "site")

# ---------------------------------------------------------------- page config
INNER = ["base", "theme-reference", "polish", "campus-scene", "cards", "nav-menu-team",
         "scene-tickets", "card-system", "fixes", "aurora"]
HOME = ["base", "theme-reference", "polish", "cards", "nav-menu-team", "scene-tickets",
        "card-system", "fixes", "aurora", "campus-scene", "startup-intro"]
# bundle name -> (layer order, routes that can be on screen). event.html reuses "events".
BUNDLES = {
    "home": (HOME, {"home"}),
    "events": (INNER, {"events", "event-detail"}),
    "team": (INNER, {"team"}),
    "blogs": (INNER, {"blogs"}),
    "join": (INNER, {"join"}),
    "certificates": (INNER, {"certificates"}),
    "verify": (INNER, {"verify"}),
    "leaderboard": (INNER, {"leaderboard"}),
    "perks": (INNER, {"perks"}),
    "privacy": (INNER, {"privacy"}),
}
# route names seen as .page-<name> / data-route on real pages; rules for names outside
# this list (about, contact, ...) are kept everywhere because nothing proves they are dead.
KNOWN_ROUTES = {"home", "events", "event-detail", "team", "blogs", "join", "certificates",
                "verify", "leaderboard", "perks", "privacy"}

# ---------------------------------------------------------------- usage universe
def read(p):
    with open(p, encoding="utf-8", errors="ignore") as f:
        return f.read()

def universe():
    texts = []
    for p in glob.glob(os.path.join(SITE, "**", "*.html"), recursive=True):
        if os.path.basename(p) == "mission-control.html":
            continue
        texts.append(read(p))
    for p in glob.glob(os.path.join(SITE, "assets", "js", "*.js")):
        texts.append(read(p))
    blob = "\n".join(texts)
    words = set(re.findall(r"[A-Za-z0-9_-]+", blob))
    # runtime-built names:  "g16-"+x   `g16-${x}`   'is-' + y
    prefixes = set(re.findall(r"([A-Za-z][\w-]*[-_])(?=[\"'`]\s*\+|\$\{)", blob))
    # runtime-built suffix names:  x+"-on"
    suffixes = set(re.findall(r"(?:\+\s*[\"'`]|\}\s*)([-_][\w-]+)", blob))
    # dataset.fooBar  ->  data-foo-bar
    for m in re.findall(r"dataset\.([A-Za-z][A-Za-z0-9]*)", blob):
        words.add("data-" + re.sub(r"([A-Z])", lambda k: "-" + k.group(1).lower(), m))
    for m in re.findall(r"dataset\[\s*[\"']([A-Za-z][A-Za-z0-9]*)[\"']", blob):
        words.add("data-" + re.sub(r"([A-Z])", lambda k: "-" + k.group(1).lower(), m))
    return words, prefixes, suffixes

WORDS, PREFIXES, SUFFIXES = universe()

def name_used(n):
    if n in WORDS:
        return True
    if any(n.startswith(p) for p in PREFIXES):
        return True
    if any(n.endswith(s) for s in SUFFIXES):
        return True
    return False

# ---------------------------------------------------------------- tokenizer
def skip_string(s, i):
    q = s[i]; i += 1
    while i < len(s):
        if s[i] == "\\": i += 2; continue
        if s[i] == q: return i + 1
        i += 1
    return i

def skip_comment(s, i):
    j = s.find("*/", i + 2)
    return len(s) if j < 0 else j + 2

def scan_until(s, i, stops):
    """Advance to the first char in `stops` at paren/bracket depth 0, outside strings/comments."""
    depth = 0
    while i < len(s):
        c = s[i]
        if c == "/" and s[i:i+2] == "/*": i = skip_comment(s, i); continue
        if c in "\"'": i = skip_string(s, i); continue
        if c == "\\": i += 2; continue
        if depth == 0 and c in stops: return i
        if c in "([": depth += 1
        elif c in ")]": depth = max(0, depth - 1)
        i += 1
    return i

def match_brace(s, i):
    """s[i] == '{' -> index just after the matching '}'."""
    depth = 0
    while i < len(s):
        c = s[i]
        if c == "/" and s[i:i+2] == "/*": i = skip_comment(s, i); continue
        if c in "\"'": i = skip_string(s, i); continue
        if c == "\\": i += 2; continue
        if c == "(":
            # url(...) may hold unquoted data: URIs; jump to the closing paren
            j = scan_until(s, i + 1, ")")
            i = j + 1; continue
        if c == "{": depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0: return i + 1
        i += 1
    return i

RAW_AT = ("keyframes", "-webkit-keyframes", "font-face", "page", "property", "counter-style", "font-feature-values")

def parse(s):
    nodes, i, n = [], 0, len(s)
    while i < n:
        while i < n and s[i] in " \t\r\n": i += 1
        if i >= n: break
        if s[i] == "/" and s[i:i+2] == "/*": i = skip_comment(s, i); continue
        j = scan_until(s, i, "{;}")
        if j >= n or s[j] == ";":
            text = s[i:j].strip()
            if text: nodes.append(("stmt", text))
            i = j + 1; continue
        if s[j] == "}":
            i = j + 1; continue
        prelude = strip_comments(s[i:j]).strip()
        end = match_brace(s, j)
        body = s[j+1:end-1]
        if prelude.startswith("@"):
            m = re.match(r"@([\w-]+)", prelude)
            name = m.group(1).lower()
            if name in RAW_AT: nodes.append(("rawat", prelude, name, body))
            else: nodes.append(("at", prelude, parse(body)))
        else:
            nodes.append(("rule", prelude, body))
        i = end
    return nodes

def strip_comments(s):
    out, i = [], 0
    while i < len(s):
        if s[i] == "/" and s[i:i+2] == "/*": i = skip_comment(s, i); continue
        if s[i] in "\"'":
            j = skip_string(s, i); out.append(s[i:j]); i = j; continue
        out.append(s[i]); i += 1
    return "".join(out)

# ---------------------------------------------------------------- selectors
def split_top(sel, sep=","):
    parts, depth, cur, i = [], 0, [], 0
    while i < len(sel):
        c = sel[i]
        if c in "\"'":
            j = skip_string(sel, i); cur.append(sel[i:j]); i = j; continue
        if c == "\\": cur.append(sel[i:i+2]); i += 2; continue
        if c in "([": depth += 1
        elif c in ")]": depth -= 1
        if c == sep and depth == 0:
            parts.append("".join(cur)); cur = []
        else: cur.append(c)
        i += 1
    parts.append("".join(cur))
    return [p.strip() for p in parts if p.strip()]

def drop_functional(sel):
    """Remove :not()/:is()/:where()/:has()/... and any other pseudo with (...) arguments."""
    out, i = [], 0
    while i < len(sel):
        m = re.compile(r":{1,2}[\w-]+\(").match(sel, i)
        if m:
            depth, j = 1, m.end()
            while j < len(sel) and depth:
                if sel[j] in "\"'": j = skip_string(sel, j); continue
                if sel[j] == "(": depth += 1
                elif sel[j] == ")": depth -= 1
                j += 1
            i = j; continue
        out.append(sel[i]); i += 1
    return "".join(out)

def unesc(t):
    return re.sub(r"\\([0-9a-fA-F]{1,6} ?|.)", lambda m: chr(int(m.group(1), 16)) if re.fullmatch(r"[0-9a-fA-F]{1,6} ?", m.group(1)) else m.group(1), t)

def selector_live(sel):
    s = re.sub(r"\"[^\"]*\"|'[^']*'", '""', sel)       # attribute values
    s = drop_functional(s)
    for m in re.finditer(r"\.((?:\\.|[\w-])+)", s):
        if not name_used(unesc(m.group(1))): return False
    for m in re.finditer(r"#((?:\\.|[\w-])+)", s):
        if not name_used(unesc(m.group(1))): return False
    for m in re.finditer(r"\[\s*([\w-]+)", s):
        a = m.group(1)
        if a.startswith("data-") and not name_used(a): return False
    return True

def route_ok(sel, own):
    """False when the selector needs a route container that this page never renders."""
    s = drop_functional(sel)
    names = set(re.findall(r"\.page-([a-z-]+?)(?![\w-])", s))
    names |= set(re.findall(r"data-(?:route|page)\s*[~|^$*]?=\s*[\"']?([\w-]+)", s))
    return all((n not in KNOWN_ROUTES) or (n in own) for n in names)

# ---------------------------------------------------------------- emit
def min_ws(t):
    t = re.sub(r"\s+", " ", t).strip()
    t = re.sub(r"\s*([{};,>~])\s*", r"\1", t)           # safe in selectors and values
    t = re.sub(r";}", "}", t)
    return t

def min_selector(sel):
    sel = re.sub(r"\s+", " ", sel).strip()
    sel = re.sub(r"\s*([,>~+])\s*", r"\1", sel)
    return sel

def min_value(val):
    """Collapse whitespace around commas, leaving strings and url(...) untouched."""
    out, i = [], 0
    chunk = []
    def flush():
        t = "".join(chunk); chunk.clear()
        t = re.sub(r"\s+", " ", t)
        t = re.sub(r"\s*,\s*", ",", t)
        out.append(t)
    while i < len(val):
        c = val[i]
        if c in "\"'":
            flush(); j = skip_string(val, i); out.append(val[i:j]); i = j; continue
        m = re.compile(r"url\(", re.I).match(val, i)
        if m:
            flush(); j = scan_until(val, m.end(), ")"); out.append(val[i:j+1]); i = j + 1; continue
        chunk.append(c); i += 1
    flush()
    return "".join(out).strip()

def min_body(body):
    body = strip_comments(body)
    out, i, cur = [], 0, []
    # split declarations at top-level ';' so values keep their inner spacing
    decls = []
    k = 0
    while k < len(body):
        j = scan_until(body, k, ";")
        decls.append(body[k:j]); k = j + 1
    for d in decls:
        d = d.strip()
        if not d: continue
        if ":" in d:
            name, val = d.split(":", 1)
            name = name.strip()
            # custom property values are kept as authored (JS may read them back verbatim)
            out.append(name + ":" + (re.sub(r"\s+", " ", val.strip()) if name.startswith("--") else min_value(val.strip())))
        else:
            out.append(d)
    return ";".join(out)

stats = {"rules_in": 0, "rules_out": 0, "kf_in": 0, "kf_out": 0}
kept_text = []

def filter_nodes(nodes, own):
    res = []
    for nd in nodes:
        k = nd[0]
        if k == "rule":
            stats["rules_in"] += 1
            _, prelude, body = nd
            if "{" in strip_comments(body):             # CSS nesting: keep untouched
                res.append(nd); stats["rules_out"] += 1; continue
            sels = split_top(prelude)
            live = [s for s in sels if route_ok(s, own) and selector_live(s)]
            if live:
                res.append(("rule", ",".join(min_selector(s) for s in live), body))
                stats["rules_out"] += 1
                kept_text.append(body)
        elif k == "at":
            _, prelude, kids = nd
            kids = filter_nodes(kids, own)
            if kids: res.append(("at", prelude, kids))
        elif k == "rawat":
            if nd[2] in ("keyframes", "-webkit-keyframes"): stats["kf_in"] += 1
            res.append(nd)
        else:
            res.append(nd)
    return res

def prune_keyframes(nodes, used):
    res = []
    for nd in nodes:
        if nd[0] == "rawat" and nd[2] in ("keyframes", "-webkit-keyframes"):
            name = nd[1].split(None, 1)[1].strip().strip("\"'")
            if name in used or name in WORDS:
                res.append(nd); stats["kf_out"] += 1
        elif nd[0] == "at":
            kids = prune_keyframes(nd[2], used)
            if kids: res.append(("at", nd[1], kids))
        else:
            res.append(nd)
    return res

def emit(nodes):
    out = []
    for nd in nodes:
        k = nd[0]
        if k == "stmt": out.append(min_ws(nd[1]) + ";")
        elif k == "rule": out.append(nd[1] + "{" + min_body(nd[2]) + "}")
        elif k == "rawat":
            body = nd[3]
            if nd[2] in ("keyframes", "-webkit-keyframes"):
                body = "".join(emit([("rule", p, b) for p, b in
                                     [(x[1], x[2]) for x in parse(body) if x[0] == "rule"]]))
                out.append(re.sub(r"\s+", " ", nd[1]) + "{" + body + "}")
            else:
                out.append(re.sub(r"\s+", " ", nd[1]) + "{" + min_body(body) + "}")
        elif k == "at":
            prelude = re.sub(r"\s+", " ", nd[1]).strip()
            prelude = re.sub(r"\s*([,:])\s*", r"\1", prelude)
            prelude = re.sub(r"\band\(", "and (", prelude)
            out.append(prelude + "{" + "".join(emit(nd[2])) + "}")
    return out

def main():
    os.makedirs(OUT, exist_ok=True)
    for old in glob.glob(os.path.join(OUT, "*.css")):
        os.remove(old)
    sources = {os.path.basename(p)[:-4]: read(p) for p in glob.glob(os.path.join(SRC, "*.css"))}
    total_src = sum(len(v.encode()) for v in sources.values())
    print(f"source CSS: {total_src/1024:.1f} KB across {len(sources)} files")
    for name, (layers, own) in BUNDLES.items():
        kept_text.clear()
        parsed = [filter_nodes(parse(sources[l]), own) for l in layers]
        used = set(re.findall(r"[A-Za-z0-9_-]+", " ".join(kept_text)))
        css = "".join("".join(emit(prune_keyframes(nodes, used))) for nodes in parsed)
        with open(os.path.join(OUT, f"page-{name}.css"), "w", encoding="utf-8") as f:
            f.write(css + "\n")
        full = sum(len(sources[l].encode()) for l in layers)
        print(f"page-{name+'.css':18s} {full/1024:7.1f} KB -> {len(css.encode())/1024:7.1f} KB")

if __name__ == "__main__":
    main()
