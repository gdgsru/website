-- Adds an editable RSVP platform name for flagship event cards.
alter table public.events add column if not exists rsvp_platform text;
notify pgrst, 'reload schema';
