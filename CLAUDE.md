# CLAUDE.md — Project Guide & Context for Claude

This document provides complete architecture, conventions, and operational context for **GDG on Campus SR University** (`gdg-sru`). When working on this codebase, adhere strictly to these patterns.

---

## 1. Project Philosophy & Tech Stack

- **Zero-Build Architecture:** No Vite, Webpack, Babel, or npm compilation steps. Pure, standards-compliant modern HTML5, CSS3, and ES6+ JavaScript.
- **Hosting:** Static file hosting on Cloudflare Pages / Netlify / Vercel with clean URL rewrite rules (`_redirects` and `_headers`).
- **Backend & Database:** [Supabase](https://supabase.com) (PostgreSQL 15+, PostgREST, Supabase Auth, Row Level Security, Edge Functions, Storage).
- **Design System:** Google Sans Flex typography, Google four-colour accent palette (`#4285F4` Blue, `#EA4335` Red, `#FBBC04` Yellow, `#34A853` Green), smooth micro-interactions, dark/light theme toggle.

---

## 2. Directory Structure

```

├── CLAUDE.md                # This context guide
├── ARCHITECTURE.md          # Comprehensive technical spec & ERD
├── DEPLOYMENT_GUIDE.md      # Step-by-step setup guide for humans & DevOps
│
├── website/                 # Public web application & Mission Control
│   ├── assets/              # Production static assets
│   │   ├── admin/           # Mission Control modular scripts & styles
│   │   ├── css/             # Scoped stylesheets for each page
│   │   ├── data/            # Master certificate template HTML & seed JSON
│   │   ├── fonts/           # Local Google Sans Flex & Code WOFF2 fonts
│   │   └── js/              # Runtime engines (cert-engine.js, app.js, config-loader.js)
│   ├── blog/                # Blog stories
│   ├── certificates/        # Public on-demand certificate claim portal
│   ├── events/              # Events listing & filters
│   ├── join/                # Community onboarding
│   ├── leaderboard/         # Student contributions & points
│   ├── member-badge/        # Interactive SVG/canvas member pass generator
│   ├── privacy/             # Chapter privacy policy
│   ├── resources/           # Student resource hub & perks
│   ├── team/                # Leadership cards rendered dynamically from Supabase
│   ├── verify/              # Public cryptographic certificate verification portal
│   ├── config.js            # Supabase credentials & site defaults
│   ├── mission-control.html # Organizer administration portal
│   └── _redirects           # Routing rewrites for clean paths
│
└── supabase/                # Database migrations & configuration
    ├── FULL_SUPABASE_SETUP.sql  # 1-click consolidated setup for SQL Editor (hardened & deduplicated)
    ├── config.toml          # Supabase CLI configuration (open signups disabled)
    ├── migrations/          # 16 sequential versioned migrations
    └── functions/           # Edge Functions (claim-certificate, fetch-blog-metadata)
```

---

## 3. Core Architectural Subsystems

### A. Certificate Engine (`assets/js/cert-engine.js` & `assets/admin/certificates-admin.js`)
- **Generation Model:** On-demand browser-side rendering. Certificates are NOT stored as static image files in the cloud. Instead, attendee records are verified against the attendance roster in Supabase, and the browser generates the certificate via `GDGCert.buildDocument()`.
- **Master Artwork Template:** Stored in `assets/data/certificate-default-template.html` and synced to Supabase `certificate_configs`. Contains the exact geometric frame, dossier cards, QR verification code, watermark, and signatures.
- **Configurable Fields (2-Way Synced with Mission Control):**
  - `track`: Track Name (e.g., `AI & Cloud`)
  - `skills`: Skill pills (`Vertex AI, Gemini, Python`)
  - `syllabus`: Curriculum / Topic overview paragraph
  - `dev_tag`: Tech badge sticker (default `#GoogleDeveloper`)
  - `node_pill`: Active node badge (`NODE_ACTIVE // 2026`)
  - `partner_sticker`: Partner sticker pill (`#SRU_ACM // CO-HOST`)
  - `dossier_tag`: Terminal dossier sticker (`BUILD_WITH_AI`)
  - `signatories`: Array of signature images, titles, and scale offsets.
- **Export Formats:**
  - `downloadPng()`: Uses `html2canvas` at 2x pixel ratio for crisp 1123×794 resolution.
  - `downloadPdf()`: Uses `jspdf` to generate an A4 landscape PDF.
  - `copyPngToClipboard()`: Direct `navigator.clipboard.write()` with `image/png` blob.

### B. Dynamic Content & Config Loader (`assets/js/config-loader.js`)
- Automatically initializes the Supabase client without blocking page load.
- Fetches dynamic settings (`public_site_settings`), upcoming pinned events (`updateNextSession`), published team members (`public_team_list`), resources, and certificates.
- Fallback safe: if Supabase credentials are missing or offline, the site renders graceful offline defaults from `GDG_SITE_DEFAULTS` without crashing.

### C. Mission Control Admin Portal (`mission-control.html` & `assets/admin/`)
- Protected by Supabase Auth + an allowlist check in table `public.admin_users`.
- Row Level Security (RLS) is the authority. Unauthenticated users cannot read non-published content or write to any table.
- 60-minute inactivity auto-logout timer for security.
- Features: Event manager, Attendance roster CSV/text importer, Team member editor with live card preview, Certificate studio with live iframe preview, Leaderboard manager, Site settings & branding.

---

## 4. Key Conventions & Pitfalls to Avoid

1. **Do NOT add npm build steps:** Everything must remain run-time executable in standard browsers. External libraries (Supabase JS, html2canvas, jspdf) are loaded via CDN or local vendor scripts.
2. **Never call `private.is_admin()` in `anon` RLS policies:**
   - The PostgreSQL function `is_admin()` is strictly restricted to authenticated administrators.
   - For public `anon` read policies, ONLY use simple status checks (e.g. `using (status = 'published')` or `using (visible = true)`).
3. **Preserve Master Certificate Artwork:**
   - The certificate template in `assets/data/certificate-default-template.html` must remain identical to the master design. Never replace it with generic HTML templates.
4. **Cross-Site Scripting (XSS) Prevention:**
   - Always sanitize dynamic HTML with `esc()` or `GDGCert.sanitize()`.
   - The certificate preview iframe enforces a strict Content Security Policy (`default-src 'none'; img-src 'self' data: blob:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:`).
5. **Clean Links:**
   - Use clean relative paths (e.g. `/events/`, `/team/`, `/certificates/`, `/verify/`).
   - All `target="_blank"` anchor tags must include `rel="noopener noreferrer"`.
