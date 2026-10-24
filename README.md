# Google Developer Groups on Campus · SR University

[![Live Production](https://img.shields.io/badge/Production-Live%20on%20Cloudflare-34A853?style=for-the-badge&logo=cloudflare&logoColor=white)](https://gdgsru.pages.dev)
[![GDG Chapter](https://img.shields.io/badge/Chapter-SR%20University-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/)
[![Community](https://img.shields.io/badge/Community-Warangal%2C%20India-EA4335?style=for-the-badge&logo=google-maps&logoColor=white)](https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/)
[![License](https://img.shields.io/badge/License-MIT-FBBC04?style=for-the-badge)](LICENSE)

Official web platform, interactive certificate verification suite, and **Mission Control** organizer administration portal for **Google Developer Groups on Campus at SR University**, Warangal.

🌐 **Production Website:** [https://gdgsru.pages.dev](https://gdgsru.pages.dev)  
🛠️ **Mission Control:** [https://gdgsru.pages.dev/admin/](https://gdgsru.pages.dev/admin/)  
📜 **Certificate Portal:** [https://gdgsru.pages.dev/certificates/](https://gdgsru.pages.dev/certificates/)  
🔍 **Credential Verification:** [https://gdgsru.pages.dev/verify/](https://gdgsru.pages.dev/verify/)

---

## 🌟 Key Features

* **🎓 On-Demand Cryptographic Certificate Engine**
  * Instant browser-side vector and high-resolution PNG rendering directly from confirmed event attendance.
  * SHA-256 deterministic credential hashes with a public `/verify/` verification portal.
  * Direct canvas repositioning (drag signatures and logos directly on preview) with 60fps pointer capture.
  * Dedicated Chapter Logo Studio: upload custom chapter logos, size slider (32px–140px), pixel-nudge controls, and chapter heading preservation.
  * One-click bulk PDF ZIP generation, merged PDFs, and direct LinkedIn profile certificate badges.

* **🚀 Mission Control Administration Portal**
  * Single-pane-of-glass executive KPI dashboard for organizers.
  * Direct drawers for Events, Attendance Rosters, Blogs, Resources, and Leadership Team cards.
  * Auto-provisioning storage buckets with client-side image WebP pre-compression.
  * Unsaved-change protection guards and live markdown preview.

* **🏆 Live Gamified Leaderboard**
  * Student rankings, point tallies, and monthly sprints for chapter activities.
  * Support for sponsored program tracks and verified badges.

* **🪪 Holographic Member Pass & 3D Resource Hub**
  * Interactive canvas member card with gyro-tilt and light sheen reflections.
  * 3D flippable resource cards and curriculum downloads.

* **⚡ Zero-Build Architecture**
  * Pure standards-compliant HTML5, CSS3, and modern ES6+ JavaScript.
  * No compilation, bundlers, or Node.js runtime required to serve or deploy.
  * Ultra-fast sub-second loading speeds worldwide via Cloudflare edge CDN.

---

## 📂 Repository Structure

```text
.
├── cloudflare-pages-site/     # Production static web application (Cloudflare Pages web root)
│   ├── assets/                # Styles, fonts, runtime scripts, and admin modules
│   │   ├── admin/             # Mission Control modular scripts (certificates-admin.js, etc.)
│   │   ├── css/               # Modular CSS and component styles
│   │   ├── data/              # Master certificate template HTML & seed data
│   │   ├── fonts/             # Self-hosted Google Sans Flex & JetBrains Mono fonts
│   │   └── js/                # Runtime engines (cert-engine.js, config-loader.js, app.js)
│   ├── blog/                  # Chapter articles and technical tutorials
│   ├── certificates/          # Public self-service certificate claim portal
│   ├── events/                # Event directory, filters, and registration links
│   ├── join/                  # Community onboarding and membership
│   ├── leaderboard/           # Student contribution points and ranks
│   ├── member-badge/          # Interactive holographic digital member pass
│   ├── privacy/               # Privacy policy and attendee data protection
│   ├── resources/             # Learning guides, perks, and study jams
│   ├── team/                  # Executive board & core team directory
│   ├── verify/                # Public credential verification portal
│   ├── config.js              # Supabase project configuration & shared site defaults
│   ├── mission-control.html   # Organizer administration workspace
│   ├── _redirects             # Cloudflare Pages routing rewrite rules
│   └── _headers               # Security headers, CSP, and asset cache-control
│
├── supabase/                  # Backend database schema, migrations & Edge Functions
│   ├── functions/             # Deno Edge Functions
│   │   ├── claim-certificate/ # Protected rate-limited certificate claiming API
│   │   └── fetch-blog-metadata/
│   ├── migrations/            # Sequential SQL migrations
│   ├── FULL_SUPABASE_SETUP.sql# 1-click consolidated setup script for Supabase SQL Editor
│   └── config.toml            # Supabase CLI configuration
│
├── scripts/                   # Developer operations and deployment utilities
│   ├── git_push_helper.py     # Authenticated GitHub push helper
│   ├── repackage_zips.py      # Automated zip distribution packager
│   └── check_supabase_live.py # Remote database connectivity verifier
│
├── ARCHITECTURE.md            # In-depth architectural specification and data model
├── DEPLOYMENT_GUIDE.md        # Step-by-step Supabase & Cloudflare deployment manual
├── CLAUDE.md                  # Development guidelines and coding conventions
├── wrangler.toml              # Cloudflare configuration
└── package.json               # Cloudflare Pages build definitions
```

---

## 🛠️ Quick Start (Local Development)

Because the project uses a zero-build architecture, you can run the entire site locally using any static web server:

```powershell
# Using Python
python -m http.server 8080 --directory cloudflare-pages-site

# Or using Node (npx)
npx serve cloudflare-pages-site -l 8080
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## 🚀 Deployment

The site is continuously deployed to **Cloudflare Pages** via Git integration on the `main` branch.

* **Production Branch:** `main`
* **Build output directory:** `cloudflare-pages-site`
* **Framework preset:** `None`

Every push to `main` automatically triggers an edge deployment in under 30 seconds.

---

## 🔐 Security & Architecture

* **Least Privilege:** Public users query through hardened PostgreSQL views (`public_*`) and Postgres RPC functions with strict Row Level Security (RLS).
* **Cryptographic Verification:** Credential codes are generated deterministically using HMAC-SHA-256 over the student's normalized record and event ID. Certificates cannot be forged.
* **Content Security Policy:** Certificates are rendered in a sandboxed runtime preventing cross-origin script injection or unsanitized HTML execution.

---

## 🤝 Community & Support

* **Chapter:** [GDG on Campus SR University](https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/)
* **Institution:** SR University, Warangal, Telangana, India
* **Contact:** [gdg@sru.edu.in](mailto:gdg@sru.edu.in)
* **Discord:** [Join the GDG SRU Discord Server](https://discord.gg/htSJMNcdZs)
* **LinkedIn:** [GDG SRU LinkedIn](https://www.linkedin.com/company/gdg-sru/home/)
* **Instagram:** [@gdg_sru](https://www.instagram.com/gdg_sru/)

---

© 2026 Google Developer Groups on Campus · SR University. Built by the GDG SRU Core Team.
