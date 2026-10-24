# GDG on Campus SR University — Production Deployment Guide

This guide covers everything required to deploy the static website and configure Supabase from scratch.

---

## Architecture Summary
- **Frontend:** Pure HTML5, CSS3, Modern ES6+ JavaScript. No build step or node_modules needed.
- **Backend:** Supabase (PostgreSQL 15+, Supabase Auth, Row Level Security, Edge Functions, Storage).
- **Target Platforms:** Cloudflare Pages, Vercel, Netlify, or GitHub Pages.

---

## Step 1: Database Setup via Supabase SQL Editor

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor** -> **New query**.
3. Paste the entire content of [`supabase/FULL_SUPABASE_SETUP.sql`](file:///d:/Drafts/Blogs/website/supabase/FULL_SUPABASE_SETUP.sql).
4. Click **Run**.
   - This creates all tables, views, security definer functions, Row Level Security (RLS) policies, and default chapter settings.

---

## Step 2: Supabase Authentication Hardening & MFA

1. In Supabase Dashboard, navigate to **Authentication** -> **Providers** -> **Email**.
2. **Crucial:** Toggle **OFF** `Allow new users to sign up`.
   - *Why:* Open registration must be disabled so public visitors cannot register accounts. Only invited organizers added to `public.admin_users` can access Mission Control.
3. In **Authentication** -> **Settings**, verify that `Enable Email Confirmations` is enabled.
4. In **Authentication** -> **Multi-Factor Authentication (MFA)**:
   - Enable **TOTP** (Authenticator App) for organizer accounts.
   - Set enforcement to required or prompt at login for administrator accounts to protect Mission Control.

---

## Step 2b: Automated Data Retention & pg_cron Setup

India's DPDP Act and the chapter privacy policy state that attendee roster records are purged after one year:
1. In Supabase Dashboard, navigate to **Database** -> **Extensions**.
2. Search for **`pg_cron`** and toggle it **ON**.
3. Open **SQL Editor** and schedule the daily cleanup job:
   ```sql
   select cron.schedule(
     'purge-expired-personal-data',
     '0 3 * * *', -- Runs every night at 03:00 UTC
     'call private.purge_expired_attendance_rosters()'
   );
   ```
4. Verify the job is active:
   ```sql
   select jobid, jobname, schedule, active from cron.job;
   ```

---

## Step 3: Storage Buckets Setup

In Supabase Dashboard -> **Storage**, create three **Public** buckets:
1. `site-assets` — Chapter banners, event artwork, brand logos.
2. `resource-files` — Student learning materials, PDFs, slides.
3. `certificate-templates` — Master certificate templates and signature assets.

*(Read and write security policies for these buckets are automatically created by `FULL_SUPABASE_SETUP.sql`).*

---

## Step 4: Authorize Chapter Organizers in Mission Control

Mission Control checks the `public.admin_users` table to authorize leads:
1. In **Authentication** -> **Users**, click **Add user** -> **Create user** (e.g. `organizer@sru.edu.in`).
2. Copy the generated `User UID`.
3. Open **SQL Editor** and run:
   ```sql
   insert into public.admin_users (user_id, email)
   values ('<PASTE-USER-UID-HERE>', 'organizer@sru.edu.in');
   ```
4. You can now log into `/mission-control.html` with this account.

---

## Step 5: Configure Supabase Edge Functions (Optional for Rate-Limited Claim Worker)

If deploying the edge functions via the Supabase CLI:
```bash
# 1. Set the allowed origins secret (prevents cross-origin abuse)
supabase secrets set ALLOWED_ORIGIN="https://gdgsru.org,https://your-preview.pages.dev,http://localhost:8080"

# 2. Deploy functions
supabase functions deploy claim-certificate
supabase functions deploy fetch-blog-metadata
```

---

## Step 6: Connect Frontend to Supabase

Open `website/config.js` and set your credentials:
```javascript
window.SUPABASE_URL = "https://<YOUR-PROJECT-REF>.supabase.co";
window.SUPABASE_ANON_KEY = "<YOUR-SUPABASE-ANON-PUBLIC-KEY>";
```
> **Security Notice:** Use only the **Anon (public)** key in `config.js`. Never expose your `service_role` key in frontend files.

---

## Step 7: Deploy Static Frontend

Deploy the `website/` folder to your chosen static host:

### Cloudflare Pages (Recommended)
1. In Cloudflare Dashboard -> **Workers & Pages** -> **Create application** -> **Pages**.
2. Connect your Git repo or upload the `website/` directory.
3. Build command: *(leave empty)*.
4. Output directory: `website` (or `.`).
5. Cloudflare automatically applies the security rules in `_headers` and routing rewrites in `_redirects`.

### Vercel / Netlify
- For Netlify, drag and drop the `website/` folder onto [Netlify Drop](https://app.netlify.com/drop).
- For Vercel, run `vercel` inside `website/`.

---

## Post-Launch Verification Checklist

- [ ] `/` (Loads homepage with live countdown and upcoming session).
- [ ] `/events/` (Loads chapter events calendar).
- [ ] `/team/` (Loads student leadership cards from `public_team_list`).
- [ ] `/certificates/` (Select event, enter student name & verify certificate renders).
- [ ] `/verify/?code=GDGSRU-2026-...` (Check credential verification portal).
- [ ] `/mission-control.html` (Log in, test roster upload, event manager, and certificate studio).
