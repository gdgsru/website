-- Migration: add speaker field to events table and refresh public_event_list view
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- This allows the "Speaker" slot in the event feature card to be set from admin
-- instead of always showing "Announced soon".

-- 1. Add the column (idempotent).
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS speaker text DEFAULT NULL;

COMMENT ON COLUMN public.events.speaker IS 'Speaker name(s) shown in the event feature card on the events page.';

-- 2. Refresh both versions of the public_event_list view to include speaker.
CREATE OR REPLACE VIEW public.public_event_list WITH (security_invoker = false) AS
  SELECT id, title, slug, category, summary, description, image_url,
         start_at, end_at, timezone, venue, speaker, online_url,
         registration_url, featured, pinned_next_session
  FROM public.events WHERE status = 'published';

-- Re-grant (CREATE OR REPLACE drops and re-creates, so grants must be re-applied).
GRANT SELECT ON public.public_event_list TO anon, authenticated;
