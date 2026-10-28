-- Resolve Supabase Security Advisor & Linter warnings
-- 1. Security Definer Views -> Security Invoker Views with explicit RLS policies
-- 2. Mutable function search_path -> Fixed search_path = ''

-- ========================================================
-- 1. Fix public_site_settings (Clears CRITICAL warning)
-- ========================================================
-- Ensure RLS allows anon & authenticated to read public keys
drop policy if exists "public_read_site_settings" on public.site_settings;
create policy "public_read_site_settings" on public.site_settings
  for select to anon, authenticated
  using (key in (
    'social_links', 'contact_email', 'secondary_contact_email',
    'community_intro', 'homepage_copy', 'brand_logo_url',
    'announcement_bar', 'event_categories', 'member_profile_overrides'
  ));

-- Recreate view with security_invoker = true
drop view if exists public.public_site_settings;
create view public.public_site_settings with (security_invoker = true) as
  select key, value from public.site_settings
  where key in (
    'social_links', 'contact_email', 'secondary_contact_email',
    'community_intro', 'homepage_copy', 'brand_logo_url',
    'announcement_bar', 'event_categories', 'member_profile_overrides'
  );

grant select on public.public_site_settings to anon, authenticated;

-- ========================================================
-- 2. Fix easter_egg_wheel_numbers (Clears CRITICAL warning)
-- ========================================================
-- Ensure RLS allows public to read wheel entrant numbers
drop policy if exists "public_read_wheel_numbers" on public.easter_egg_participants;
create policy "public_read_wheel_numbers" on public.easter_egg_participants
  for select to anon, authenticated
  using (wheel_entrant and wheel_number is not null and not coalesce(has_won, false));

drop view if exists public.easter_egg_wheel_numbers;
create view public.easter_egg_wheel_numbers with (security_invoker = true) as
  select wheel_number
  from public.easter_egg_participants
  where wheel_entrant and wheel_number is not null and not coalesce(has_won, false)
  order by wheel_number;

grant select on public.easter_egg_wheel_numbers to anon, authenticated;

-- ========================================================
-- 3. Fix Function Search Path (Clears search_path warnings)
-- ========================================================
create or replace function public.event_purge_at(d date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case when d is null then null
              else ((d + interval '1 year')::timestamp at time zone 'Asia/Kolkata') end;
$$;

create or replace function public.partner_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.event_partners where event_id = new.event_id) >= 8 then
    raise exception 'A certificate can show at most 8 partners';
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
