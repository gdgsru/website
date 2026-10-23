# GDG SRU website

Static public website for GDG on Campus, SR University, backed by Supabase, plus a private admin area (Mission Control). Deploys as a plain static folder (Cloudflare Pages). The only build step is the optional CSS bundler below; its output is committed, so deploying needs no tooling.

## Project layout

```
site/                     Deployable folder (publish this)
  index.html              Home
  events/ team/ blog/ join/ resources/
  leaderboard/ certificates/ verify/ privacy/
                          One index.html per public route
  event.html              Event detail (/event.html?slug=...)
  mission-control.html    Private admin entry (not linked publicly)
  404.html  favicon.svg  config.js
  _headers  _redirects    Cloudflare Pages caching, security headers, routes
  assets/
    css/                  Generated page-<route>.css bundles, see "CSS"
    js/                   Scripts, see "JavaScript"
    fonts/                Self-hosted fonts + fonts.css
    images/               hero-building.webp
    brand/                SRU wordmark
    team/  team-icons/    Team portraits and card icons
    admin/                Mission Control JS and CSS
    data/                 team-seed.json (one-time roster import)
css-src/                  Editable CSS sources (input to scripts/build-css.py)
supabase/
  schema.sql              Consolidated schema for a FRESH project only
  migrations/             Upgrades already applied to the current project
  follow-up-migrations/   Pending/optional migrations
  scripts/                One-off SQL (official links)
  functions/              Edge Functions (fetch-blog-metadata, claim-certificate)
  config.toml
docs/PERFORMANCE.md       Performance notes
scripts/START_LOCAL_TEST.bat   Windows local server
```

### CSS

Edit `css-src/*.css`, then run `python scripts/build-css.py`. It writes one bundle per page to `site/assets/css/page-<route>.css` (home, events, team, blogs, join, certificates, verify, leaderboard, perks, privacy; `event.html` uses the events bundle). Each page links only its own bundle plus `fonts.css`. **Never edit `site/assets/css/page-*.css` by hand.**

The bundler keeps the original cascade order (home: `base` → `theme-reference` → `polish` → `cards` → `nav-menu-team` → `scene-tickets` → `card-system` → `fixes` → `aurora` → `campus-scene` → `startup-intro`; inner pages load `campus-scene` right after `polish`), drops rules that cannot match anything in the site's HTML/JS, drops rules scoped to other routes (`.page-team`, `[data-route=...]`), removes unused keyframes and minifies. Rerun it after any CSS, template or class-name change. A new route needs an entry in `BUNDLES` and `KNOWN_ROUTES` in the script.

### JavaScript

- `card-system.js`, `app.js` (page templates and renderer), `config-loader.js` (live Supabase data), `effects.js` load first, in that order. All are `defer`. `config-loader.js` loads `config.js` and supabase-js itself, in parallel, so neither blocks rendering.
- Deferred behaviour scripts: `theme-reference`, `polish`, `theme-carousel`, `nav-effects`, `menu`, `fixes`, `intro` (home only), `aurora`, `campus-tilt` (home only), `title-transition`.
- `assets/admin/mission-control.js` and `.css` are used only by `mission-control.html`.

## Local testing

Windows: double-click `scripts/START_LOCAL_TEST.bat`, then open `http://localhost:3000/`. Anywhere: `python -m http.server 3000 --directory site`. Use http, not `file://`. Friendly `/events/slug` URLs need the Cloudflare `_redirects`; locally use `/event.html?slug=...`.

## Supabase

Project `gdg-sru-website` (ref `isfhqbytrbilceqddnll`). `site/config.js` holds the project URL and a public publishable key, which is meant for browsers. Never put a service-role or secret key in `site/`.

- **Do not rerun `supabase/schema.sql`** on the current project. Older empty tables were renamed `legacy_*_20261012` and kept.
- Public views run under row-level security; the leaderboard uses a public-only projection (no email hashes or activity rows).
- Public storage buckets are readable by visitors. Upload only content cleared for public sharing.
- Contact emails and social links live in `site_settings` (`gdg@sru.edu.in` primary, `gdgoncamps.sru@gmail.com` secondary).

## Mission Control

Open `/mission-control.html` directly; there is intentionally no public link. Access needs a Supabase Auth user listed in `public.admin_users` (a hidden URL is not security). Keep public sign-ups disabled. Press **Ctrl/Cmd + K** anywhere for search and jump.

Layout: `mission-control.js` is the shell (sign-in, navigation, `#/section/id` routing, command palette, drawers) and exposes helpers as `window.MC`. Screens load on demand: `mc-overview.js`, `mc-content.js` (events, blog, resources), `mc-team.js`, `mc-extra.js` (leaderboard, settings), `certificates-admin.js` (attendance, certificates). Every record has a link, for example `#/events/<id>`, `#/team/<id>`, `#/attendance?event=<id>`.

Everything is connected: the Overview and Events list show each event's progress (drafted, published, attendance in, certificates open, archived) and every step links to the screen that completes it, with the event preselected. "Needs attention" is computed live from events, attendance, certificates, team and leaderboard data.

Admin behaviour worth knowing: event times are entered and shown in IST regardless of the browser's timezone; certificate templates must be plain HTML/CSS; template activation and attendance roster replacement are transactional; the admin signs out after 60 minutes of inactivity. Every signed-in admin currently has full access (there are no per-section roles yet).

For password recovery, add the exact URL `https://YOUR_DOMAIN/mission-control.html` (and `http://localhost:3000/mission-control.html` for local tests) to Supabase Authentication -> URL Configuration -> Redirect URLs. No wildcards.

### Team page (fully admin-managed)

No person or department is written into HTML or JavaScript any more. The public page (`assets/js/team-page.js`) reads `public_team_list`, `public_team_departments` and the `team_page` setting. In **Mission Control -> Team** you edit, per person: name, role, department, level, card colour, member ID, season, the line on the back, bio, photo (upload or link) and its framing, social links, status and order (drag to reorder or move between departments). A live preview uses the same card code as the site. **Page and departments** edits the headline text and each department's heading, blurb, order and visibility.

Setup on the existing project (once): apply `supabase/migrations/20261020100000_team_card_fields_and_departments.sql`, then open Team and click **Import starter roster** (or **Sync starter roster** if profiles were imported earlier; it fills missing card details and never overwrites edits). If the database cannot be reached, the public page falls back to `assets/data/team-seed.json` so it is never blank. Hosting: `_headers` allows the same-origin card preview frame on `mission-control.html` and `team-card-preview.html` only.

## Certificates (generated on demand, no per-recipient certificate files)

**Certificate design preservation:** `docs/certificate-bulk-original.html` is the uploaded master and is kept byte-for-byte unchanged. The built-in printable template uses its original stylesheet text without adjusting the certificate's font families, font sizes, layout dimensions, spacing, colors, borders or decorative elements. Dynamic placeholders only populate attendee/event text, logo and partner assets, skills, tags, and signatories. Optional stickers, skills and the collaborator badge are populated with the same starting values as the supplied Studio design; an admin can clear/edit these fields per event.

A visitor opens **/certificates/**, picks a published event and types their name and their roll number (or registered email). The public page calls the `claim-certificate` Edge Function, which applies a server-side rate limit and then asks the database whether exactly one attended roster row matches that combination. The certificate is rendered in the visitor’s browser and can be saved as PDF or image. No certificate file or per-person certificate row is stored. The credential ID is derived from event + attendee key (roll number, else email) using a private salt, so **/verify/** re-checks it against the attendance list.

Admin setup (Mission Control):
1. **Certificates → Template**: choose **Use built-in GDG template** to use the certificate design supplied in `docs/certificate-bulk-original.html`. The printable certificate keeps the source design's original fonts, font sizes, colors, spacing, borders, shadows, SVG decoration and layout; only text/image content is bound to event and attendee values. The original uploaded Studio HTML is preserved unchanged at `docs/certificate-bulk-original.html`; the built-in printable template is `site/assets/data/certificate-default-template.html`. You can still upload your own `.html` / `.htm` file (up to 500 KB). Preview before saving. Scripts, forms, iframes, event handlers and unsafe URLs are removed from rendered templates. You can upload a separate PNG/JPEG/WebP image asset and insert its hosted `<img>` at the editor cursor. Keep the main logo, partner logos and signatures in the event editor if they differ by event.
2. **Certificates → Event certificate**: select the event and choose a template. Edit the certificate title, event name/subtitle, venue, category, duration, tags, chapter/issuer, date, watermark, curriculum, logo, partners and signatories. Add **custom template fields** for any extra data; the admin UI shows the placeholder to place in HTML, such as `{{custom_sponsor_name}}`. Watch the live preview, enable certificate claiming and save.
3. **Attendance** (or the roster box inside the event editor): upload a CSV with a `Name` column plus optional `Email` and `Status`/`Attendance Status`, or paste one name per line. One-name-per-line imports default to `attended`; if a `Status` column is included, every row must have a supported value (`attended`, `absent`, or `pending`; common yes/no and present/not-attended aliases are accepted). Invalid emails, blank/unknown statuses, reused emails across different names, and contradictory duplicate rows block the whole import. Download the sample CSV from the importer. Each upload is capped at 10,000 rows. Re-uploading adds new names and updates matching records; **Replace** atomically swaps the event’s roster. Duplicate normalized names are blocked unless duplicate rows have the same non-empty email and can safely be treated as the same attendee.

Behaviour and safety:
- Matching trims leading/trailing whitespace, collapses repeated spaces and ignores case. Attendees are identified by roll number (or email when no roll number is present). Two people can share the same name as long as their roll number or email is different. If attendance rows cannot uniquely identify an attendee, issuance fails closed; correct the roster before enabling claims.
- The public event picker lists events with status `published` or `archived`, an enabled certificate configuration, and at least one attended attendee. Draft and cancelled events cannot issue new certificates; archiving a completed event does not strand attendees who still need their certificates. Disabling a certificate event stops new claims but does not invalidate already-generated IDs while the relevant attendance row remains in the roster.
- The Edge Function defaults to 120 claim checks per network address per 10-minute window, configurable with the `CERTIFICATE_CLAIM_LIMIT` Edge Function secret (accepted range 10–1000). It uses a SHA-256 hash of the client IP plus a server-side secret salt and an attempt counter; it does not store the submitted attendee name in that counter. Old counters are periodically pruned. This slows basic name guessing but is not a substitute for CAPTCHA/Turnstile or additional abuse monitoring if traffic becomes high. A shared campus or mobile-carrier IP can be used by many real visitors, so review the limit after launch.
- In production, set the Supabase Edge Function secret `ALLOWED_ORIGIN` to the exact public site origin (or a comma-separated list for multiple approved origins). The claim function fails closed if `ALLOWED_ORIGIN` is unset or the request origin is not allowlisted. Preview deployments need their own explicitly listed origins if they should support certificate claims. For local testing, include `http://localhost:3000` while testing and remove it from the production allowlist if it is no longer needed.
- The Edge Function has `verify_jwt = false` because certificate claiming is a public feature; it checks for a project public API key and uses the service-role key only inside the function. Never place the service-role key in `site/config.js` or any public file. The `claim_certificate` database RPC is executable only by `service_role`, not by browser clients directly.
- Apply `supabase/migrations/20261019100000_on_demand_certificates.sql` first if the on-demand model is not already installed, then apply `supabase/migrations/20261019120000_harden_certificate_claims_and_roster_import.sql`. The latter adds the rate-limit counter, unique-name checks, atomic roster import and transactional template activation. On the existing project, **do not** rerun `supabase/schema.sql`.
- Deploy both functions after migrations: `supabase functions deploy claim-certificate` and `supabase functions deploy fetch-blog-metadata`. The Blogger metadata function now imports its Supabase client dependency. Confirm the project is linked to `isfhqbytrbilceqddnll` before deployment.
- Rendering: template text is sanitized on every render and shown in a sandboxed iframe with a restrictive CSP. Images must be HTTPS or embedded PNG/JPEG/WebP. PDF/image export uses html2canvas + jsPDF, loaded from `/assets/vendor/` if you add them there, otherwise from cdnjs (allowed in `_headers`).
- The privacy notice now distinguishes the retained attendance roster from generated certificate files and describes the short-lived hashed network rate-limit counter. The chapter still needs to approve a retention period for attendance records before launch.
- The migration and deployment steps have **not** been run against your live Supabase project from this environment. Apply them to staging first and test valid/invalid names, duplicate names, rate limiting, CSV replacement rollback, template assets, PDF export and verification end to end.

### Offline demo

`python -m http.server 3000 --directory site`, then open `http://localhost:3000/certificate-demo.html`. It runs the real template engine with a sample attendance list, no Supabase. Delete `site/certificate-demo.html` and `site/assets/js/cert-demo.js` before launch if you do not want it public.

## Before launch

- The privacy policy is a working draft. Review retention periods, applicable law and SR University requirements, and publish the real schedule.
- Not yet tested end to end: every admin operation, the certificate migration on the live project, PDF export, and production deployment. Treat this as ready for staging, not production-verified. Check layouts in a real browser.
- Public site uses the light theme only; dark-mode switching was removed.

## Build before deploying

The public pages share one header, navigation, mobile menu and footer, kept in `site/partials/`. The CSS is generated from `css-src/`.

- `python3 scripts/build-css.py` regenerates the site CSS.
- `python3 scripts/build-pages.py` rewrites the shared blocks on every public page. Run it after editing anything in `site/partials/`.
- `python3 scripts/build-pages.py --check` fails if any page is out of date. Use it in CI.

On the host, set the build command to `python3 scripts/build-pages.py && python3 scripts/build-css.py`.

Migration order for a fresh project: `schema.sql` once, then `20261019100000`, `20261019120000`, `20261020100000`, `20261020110000`, `20261020120000`, `20261020130000`, `20261020140000`, `20261020150000`. Do not run the `20261012…` files on a fresh project.

Attendance records are deleted one year after their event ends. The daily job is scheduled through `pg_cron` when it is available. If not, run `select private.purge_expired_personal_data();` on a schedule.
