# Google Developer Group on Campus · SR University

Production web platform and Mission Control administration portal for the GDG on Campus chapter at SR University, Warangal.

---

## Key Features

- **On-Demand Certificate Engine:** Generates high-resolution vector and PNG certificates in the browser from uploaded attendance rosters. Zero cloud storage required for certificates; fully verified via unique SHA-256 credentials.
- **Mission Control Admin Portal:** Organizer dashboard for managing events, attendance rosters, leadership profiles, chapter settings, and live certificate design customizations.
- **Live Leaderboard:** Tracks student points, contributions, and community rankings across chapter sprints and sponsored programs.
- **Resource Hub & Member Pass:** 3D interactive perk cards, learning resources, and a personalized holographic member badge generator.
- **Zero-Build Architecture:** Modern vanilla HTML5/CSS3/ES6+ JavaScript with no Node.js compilation required. Works out of the box on any static web host.

---

## Directory Overview

- **`website/`**: Complete static frontend files ready for deployment (Cloudflare Pages, Vercel, Netlify, or GitHub Pages).
- **`supabase/`**: Database migrations, Edge Functions, configuration, and a 1-click consolidated SQL setup script (`FULL_SUPABASE_SETUP.sql`).
- **`DEPLOYMENT_GUIDE.md`**: In-depth instructions for setting up Supabase, auth hardening, storage buckets, and going live.
- **`ARCHITECTURE.md`**: Technical specification, data model ERD, and component lifecycle diagrams.
- **`CLAUDE.md`**: Context and architecture guide for Claude AI or external engineers.
