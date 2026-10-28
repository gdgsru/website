# GDG SRU member pass: install & run

Everything here mirrors your repo layout. Copy folders over the repo root (the three files marked **patched** replace your copies).

| File | What it is |
|---|---|
| `scripts/build_profiles.py` | Offline generator. CSV in, static JSON out, plus a private SQL seed |
| `supabase/migrations/20261027120000_member_profiles.sql` | Private `member_profiles` table + public `get_member_stats(handle)` RPC |
| `supabase/migrations/20261028090000_member_profiles_admin.sql` | **Run second.** Adds the `hidden` flag, makes the public RPC hidden-aware, adds 3 admin-only RPCs |
| `cloudflare-pages-site/assets/admin/mc-profiles.js` | Mission Control tab: **Member profiles** |
| `cloudflare-pages-site/assets/admin/mission-control.js` **patched** | Two small edits: adds the tab to the nav and registers its script |
| `cloudflare-pages-site/profile.html` | The pass page (served at `/u/{handle}`) |
| `cloudflare-pages-site/assets/css/profile.css` | Palettes, 3D tilt, foil, responsive grid, lanyard `@media print` |
| `cloudflare-pages-site/assets/js/profile.js` | Dual fetch, rendering, `exportCardPng()`, `exportAtsPdf()` |
| `cloudflare-pages-site/assets/js/qr-svg.js` | Offline QR generator (no library) |
| `cloudflare-pages-site/assets/avatars/avatar-01..30.svg` | The only images a pass can show. Replace these with your curated set (see below) |
| `cloudflare-pages-site/_redirects` **patched** | Adds `/u/:username` -> `/profile?u=:username` |
| `cloudflare-pages-site/_headers` **patched** | `no-cache` for `/u/*`, `/profile`, `/data/*` |
| `cloudflare-pages-site/assets/js/command-palette.js` **patched** | Member search in Ctrl+K + fixes a bug (below) |

## One-time setup
1. Run both migrations in the Supabase SQL Editor, in filename order.
2. Copy the files into the repo. Append `.gitignore.additions` to your `.gitignore`.

## Every time you onboard a batch
1. In the Google Sheet, set `Approved = TRUE` for members whose workshop attendance you verified. Export as CSV to `verified_responses.csv`.
2. `python scripts/build_profiles.py verified_responses.csv` (add `--dayfirst` if your sheet dates are DD/MM/YYYY).
3. Fix any username collisions it prints (edit the handle in the sheet, re-run). Colliding students are held back, not guessed.
4. Paste `build/members_seed.sql` into the Supabase SQL Editor and run it. It mirrors the sheet (adds, updates, removes) and keeps each member's **hidden** setting. An empty export produces a no-op file, never a wipe.
5. `git add cloudflare-pages-site/data && git commit && git push`. Cloudflare Pages deploys.

If your Form headers differ, the script prints which column it couldn't find. Fix with e.g. `--map handle="Pick a username"`.

## Mission Control: Member profiles tab
Sidebar: *Certificates & passes -> Member profiles*. It lists every pass with live XP, level and workshop count, and shows a status for each:
- **Live**: published and connected to the database.
- **Hidden**: the pass page says "This pass isn't available" and no points or certificates are returned. Instant, no rebuild. Unhide at any time.
- **Not in database**: published but missing from the seed. Run the newest `members_seed.sql`.
- **Not published**: in the database but no profile file. Re-run `build_profiles.py` and push.

Also: search, filters, copy link, remove from database, CSV download. Hide/unhide/remove are logged in the Activity log. Everything is checked server-side with `is_admin()`.

**What it can't do:** hiding doesn't delete the profile file from the repo, and the person stays in Ctrl+K search until the next build. Handle changes and profile text edits go through the sheet and a rebuild, because the files are named by handle.

## Photos and avatars
Student photos are never published. Every pass shows one of 30 curated avatars in `assets/avatars/`. The placeholders included here are abstract, face-free shapes in the Google palette. To use your own set, replace the 30 files with the same names. If your files are PNG, change the extension in `avatarSrc()` in `profile.js` (currently `.svg`).

Assignment: a member can pick one in the sheet's **Avatar** column (`7`, `07` or `avatar-07`). Anyone who leaves it blank gets a stable pick from their handle, so it won't change between rebuilds. Invalid values print a warning and fall back to the default.

The pass no longer loads GitHub avatars, so GitHub is only a link-out in the links list.

## What is live vs static
- **Static (from your sheet):** name, masked roll, department, cohort, theme, links, bio, skills.
- **Live (Supabase, anon key, read-only):** XP, level, workshop count, certificates with credential IDs. If the call fails the pass still renders and says live stats are unavailable.

## Decisions you may want to change
- **Roll numbers are masked** on the public pass (`2403••••01`). Use `--roll-display full` to show them.
- **QR target** is `/u/{handle}`. Your `/verify` page doesn't read `?u=`; change `QR_PATH` in `profile.js` if you add that.
- **No search indexing:** `profile.html` has `noindex`. Remove it if you want profiles in Google.
- Members only appear in the directory/palette after the next build, and need a privacy page update since roll/department are public.

## Testing status
- Browser-tested (Chromium, mocked database): pass page, exports, QR, palette, mobile, print, hidden/withdrawn flow, and the admin tab (using your real admin CSS with a stubbed `MC`).
- **Not run against a real Supabase or a real Mission Control login.** Run the two migrations first, then open the tab and try Hide/Unhide on a test member.

## Known gap: the older /member-badge/ generator
`cloudflare-pages-site/member-badge/index.html` has a **"Upload Photo"** control, which lets students upload their own photos. That conflicts with the no-student-photos policy. It isn't changed in this bundle. Removing it needs a matching change to the script that handles the file input (`#photo`), so do that together with a test. Until then, consider hiding the page.

## Bug fixed in your palette
`command-palette.js` assigned `lastActiveElement` without ever declaring it. In strict mode that throws, so Ctrl+K never opened on any page. The patched file declares it.
