# System Architecture & Technical Specification

**Target:** GDG on Campus SR University Web Platform  
**Architecture:** Serverless JAMstack + Supabase BaaS + Client-Side Generation Engine

---

## 1. High-Level Architecture Diagram

```mermaid
flowchart TD
    User["Public Visitors / Students"] -->|"HTTP GET"| CDN["Cloudflare Pages / Netlify / Vercel"]
    Admin["Chapter Organizers"] -->|"HTTPS Login"| MC["Mission Control (/mission-control.html)"]

    subgraph Static Frontend
        CDN --> Home["Homepage (/)"]
        CDN --> Events["Events (/events/)"]
        CDN --> Team["Team (/team/)"]
        CDN --> Blog["Blog (/blog/)"]
        CDN --> Cert["Certificates (/certificates/)"]
        CDN --> Verify["Verify (/verify/)"]
        CDN --> Leaderboard["Leaderboard (/leaderboard/)"]
        CDN --> Perks["Resources (/resources/)"]
    end

    subgraph Supabase Cloud Backend
        Auth["Supabase Auth (Admin Users)"]
        DB[("PostgreSQL 15 Database")]
        Storage["Storage Buckets (site-assets, resource-files)"]
        Edge["Edge Functions (claim-certificate)"]
    end

    Home & Events & Team & Blog & Leaderboard -->|"Public SELECT (anon key)"| DB
    Cert -->|"RPC: list_certificate_events & claim"| DB
    Verify -->|"SELECT public_certificate_verification"| DB
    MC -->|"Authenticated Read/Write (JWT)"| DB
    MC -->|"Uploads"| Storage
    MC -->|"Auth Session"| Auth
```

---

## 2. Database Schema & Entity Relationships

```mermaid
erDiagram
    ADMIN_USERS {
        uuid user_id PK
        text email
        timestamptz created_at
    }

    SITE_SETTINGS {
        text key PK
        jsonb value
        timestamptz updated_at
        uuid updated_by
    }

    EVENTS {
        uuid id PK
        text title
        text slug UK
        text category
        text summary
        text description
        text venue
        text status
        timestamptz start_at
        timestamptz end_at
        boolean pinned_next_session
    }

    ATTENDANCE_RECORDS {
        uuid id PK
        uuid event_id FK
        text student_name
        text student_identifier
        text identifier_type
        timestamptz verified_at
    }

    CERTIFICATES {
        uuid id PK
        uuid event_id FK
        text credential_id UK
        text student_name
        text student_identifier
        jsonb fields
        timestamptz issued_at
        text status
    }

    CERTIFICATE_CONFIGS {
        uuid event_id PK, FK
        jsonb fields
        text template_html
        timestamptz updated_at
    }

    TEAM_MEMBERS {
        uuid id PK
        text name
        text role
        text department
        text status
        integer leadership_order
        text photo_url
        jsonb social_links
    }

    BLOG_ENTRIES {
        uuid id PK
        uuid series_id FK
        text title
        text slug UK
        text author
        text external_url
        text status
    }

    BLOG_SERIES {
        uuid id PK
        text title
        text slug UK
        text color
        text status
        integer sort_order
    }

    EVENTS ||--o{ ATTENDANCE_RECORDS : "records"
    EVENTS ||--o{ CERTIFICATES : "issues"
    EVENTS ||--o| CERTIFICATE_CONFIGS : "configures"
    BLOG_SERIES ||--o{ BLOG_ENTRIES : "contains"
```

---

## 3. Security Definers & Access Control

1. **`private.is_admin()` / `public.is_admin()`:**
   - Security Definer function checking if `auth.uid()` matches an ID in `public.admin_users`.
   - Execution privilege granted **strictly to authenticated users**.
   - **Never used in policies that apply to `anon`**.
2. **Row Level Security (RLS):**
   - Enabled on every table.
   - Public read policies are constrained to `status = 'published'` or `visible = true`.
   - Write operations (`INSERT`, `UPDATE`, `DELETE`) require `private.is_admin() = true`.
3. **Public Views (Security Invoker):**
   - `public_site_settings`: Exposes only whitelisted public keys (`social_links`, `contact_email`, `homepage_copy`, `brand_logo_url`, `team_page`).
   - `public_team_list`: Exposes only published team members with safe fields.
   - `public_event_list`: Exposes only published events.
   - `public_blog_list`: Exposes only published blogs.
   - `public_certificate_verification`: Exposes only `credential_id`, `event_title`, `recipient_name`, `issued_at`, and `status`.

---

## 4. Certificate Generation Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Attendee as Student / Attendee
    participant Portal as /certificates/ Portal
    participant DB as Supabase PostgreSQL
    participant Engine as GDGCert Engine (Browser)

    Attendee->>Portal: Opens /certificates/
    Portal->>DB: rpc('list_certificate_events')
    DB-->>Portal: List of published events with certificates enabled
    Portal->>Attendee: Displays event dropdown
    Attendee->>Portal: Selects event & enters name (e.g. "K. Shravan Kumar")
    Portal->>DB: Checks attendance roster (RPC / table check)
    alt Attendee NOT in Attendance Roster
        DB-->>Portal: Record not found
        Portal-->>Attendee: Shows "Name not found in attendance list for this event"
    else Attendee Found in Roster
        DB-->>Portal: Confirmed attendance + fetches certificate_configs for event
        Portal->>Engine: GDGCert.buildDocument(template, context)
        Engine->>Engine: Replaces placeholders (name, track, tags, dossier, QR, signatures)
        Engine->>Engine: Sanitizes HTML & injects strict iframe CSP
        Engine-->>Portal: Renders live certificate in preview iframe
        Portal-->>Attendee: Certificate displayed with Download PNG / PDF / Copy actions
    end
```
