-- ============================================================================
-- Migration: Event Tiers, Announcement Bar, Bevy RSVP Routing & Storage
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

-- 1. ADD NEW COLUMNS TO public.events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_tier text NOT NULL DEFAULT 'standard'
    CHECK (event_tier IN ('flagship', 'program', 'standard')),
  ADD COLUMN IF NOT EXISTS event_mode text NOT NULL DEFAULT 'in_person'
    CHECK (event_mode IN ('in_person', 'virtual', 'hybrid')),
  ADD COLUMN IF NOT EXISTS join_link text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS banner_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT 'blue'
    CHECK (accent_color IN ('blue', 'red', 'yellow', 'green')),
  ADD COLUMN IF NOT EXISTS speakers text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rsvp_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS syllabus_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discord_channel_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resource_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS calendar_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS certificates_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS program_milestones jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Populate speakers and rsvp_url from legacy columns if they already exist
UPDATE public.events SET speakers = speaker WHERE speakers IS NULL AND speaker IS NOT NULL;
UPDATE public.events SET rsvp_url = registration_url WHERE rsvp_url IS NULL AND registration_url IS NOT NULL;
UPDATE public.events SET join_link = online_url WHERE join_link IS NULL AND online_url IS NOT NULL;

-- 2. CREATE / UPDATE STORAGE BUCKET FOR EVENT BANNERS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('event-banners', 'event-banners', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'];

-- Storage policies for event-banners
DROP POLICY IF EXISTS event_banners_public_read ON storage.objects;
DROP POLICY IF EXISTS event_banners_admin_insert ON storage.objects;
DROP POLICY IF EXISTS event_banners_admin_update ON storage.objects;
DROP POLICY IF EXISTS event_banners_admin_delete ON storage.objects;

CREATE POLICY event_banners_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'event-banners');

CREATE POLICY event_banners_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-banners' AND private.is_admin());

CREATE POLICY event_banners_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'event-banners' AND private.is_admin())
  WITH CHECK (bucket_id = 'event-banners' AND private.is_admin());

CREATE POLICY event_banners_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'event-banners' AND private.is_admin());

-- 3. INITIALIZE ANNOUNCEMENT BAR SETTING
INSERT INTO public.site_settings (key, value)
VALUES (
  'announcement_bar',
  '{
    "enabled": false,
    "badge": "UPCOMING",
    "text": "Grand Chapter Launch registrations are live on Google Community Platform.",
    "button_label": "RSVP on Chapter Page ↗",
    "button_url": "https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/",
    "announcement_id": 1
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- 4. UPDATE PUBLIC VIEWS
-- Allow announcement_bar in public_site_settings
DROP VIEW IF EXISTS public.public_site_settings;

CREATE VIEW public.public_site_settings WITH (security_invoker = false) AS
  SELECT key, value FROM public.site_settings
  WHERE key IN (
    'social_links', 'contact_email', 'secondary_contact_email',
    'community_intro', 'homepage_copy', 'brand_logo_url',
    'announcement_bar', 'event_categories'
  );

GRANT SELECT ON public.public_site_settings TO anon, authenticated;

-- Refresh public_event_list view with all new event tier & RSVP fields
DROP VIEW IF EXISTS public.public_event_list;

CREATE VIEW public.public_event_list WITH (security_invoker = false) AS
  SELECT
    id, title, slug, category, summary, description,
    image_url, banner_url, start_at, end_at, timezone,
    event_tier, event_mode, accent_color,
    venue, join_link, online_url,
    speakers, speaker,
    rsvp_url, registration_url,
    syllabus_url, discord_channel_url, resource_url,
    calendar_enabled, certificates_ready, program_milestones,
    featured, pinned_next_session, status, created_at, updated_at
  FROM public.events
  WHERE status = 'published';

GRANT SELECT ON public.public_event_list TO anon, authenticated;
