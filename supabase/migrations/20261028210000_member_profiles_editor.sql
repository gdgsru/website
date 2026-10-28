-- Member profiles: in-place editing from Mission Control
-- Adds profile columns to public.member_profiles and admin update RPC.
-- Idempotent.

alter table public.member_profiles
  add column if not exists name text,
  add column if not exists department text,
  add column if not exists cohort text,
  add column if not exists avatar text default 'avatar-01',
  add column if not exists theme text default 'google-blue',
  add column if not exists bio text,
  add column if not exists skills text[] default '{}'::text[],
  add column if not exists achievement_text text,
  add column if not exists achievement_icon text,
  add column if not exists social_links jsonb default '{}'::jsonb;

-- Update get_member_stats to include editable profile fields if present in DB
drop function if exists public.get_member_stats(text);
create or replace function public.get_member_stats(p_handle text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with m as (
    select * from public.member_profiles
    where handle = lower(btrim(coalesce(p_handle, '')))
  ),
  pts as (
    select coalesce(sum(cp.points), 0)::int as total, count(cp.id)::int as activities
    from m
    left join public.community_points cp
      on cp.email_hash = m.email_hash and cp.verified = true
  ),
  ws as (
    select e.title, e.start_at,
           private.credential_for_key(
             a.event_id,
             private.attendee_key(a.roll_no, a.attendee_email, a.attendee_name)
           ) as credential_id
    from m
    join public.attendance_records a
      on a.attendance_status = 'attended'
     and ( (m.roll_norm is not null and private.norm_roll(a.roll_no) = m.roll_norm)
        or encode(extensions.digest(lower(btrim(coalesce(a.attendee_email, ''))), 'sha256'), 'hex') = m.email_hash )
    join public.events e on e.id = a.event_id and e.status in ('published', 'archived')
    join public.certificate_configs c on c.event_id = e.id and c.enabled = true
  )
  select case
    when not exists (select 1 from m) then jsonb_build_object('found', false)
    when exists (select 1 from m where m.hidden) then jsonb_build_object('found', true, 'hidden', true)
    else jsonb_build_object(
      'found', true,
      'hidden', false,
      'name', (select name from m),
      'department', (select department from m),
      'cohort', (select cohort from m),
      'avatar', (select avatar from m),
      'theme', (select theme from m),
      'bio', (select bio from m),
      'skills', (select skills from m),
      'achievement_text', (select achievement_text from m),
      'achievement_icon', (select achievement_icon from m),
      'points', (select total from pts),
      'activities', (select activities from pts),
      'workshops', coalesce(
        (select jsonb_agg(jsonb_build_object(
                  'title', ws.title,
                  'date', ws.start_at,
                  'credential_id', ws.credential_id
                ) order by ws.start_at desc nulls last) from ws),
        '[]'::jsonb)
    )
  end;
$$;

revoke all on function public.get_member_stats(text) from public;
grant execute on function public.get_member_stats(text) to anon, authenticated;

-- Admin: update or upsert a member's profile
drop function if exists public.admin_update_member_profile(text, text, text, text, text, text, text, text[], text, text, boolean);
create or replace function public.admin_update_member_profile(
  p_handle text,
  p_name text default null,
  p_dept text default null,
  p_cohort text default null,
  p_avatar text default null,
  p_theme text default null,
  p_bio text default null,
  p_skills text[] default null,
  p_achievement_text text default null,
  p_achievement_icon text default null,
  p_hidden boolean default false
)
returns table (
  handle text,
  name text,
  department text,
  cohort text,
  avatar text,
  theme text,
  bio text,
  skills text[],
  achievement_text text,
  achievement_icon text,
  hidden boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_h text := lower(btrim(coalesce(p_handle, '')));
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if v_h !~ '^[a-z0-9_-]{2,32}$' then raise exception 'Invalid handle'; end if;

  insert into public.member_profiles (
    handle, email_hash, name, department, cohort, avatar, theme, bio, skills, achievement_text, achievement_icon, hidden, updated_at
  ) values (
    v_h,
    coalesce((select email_hash from public.member_profiles where handle = v_h), 'manual_' || v_h),
    p_name,
    p_dept,
    p_cohort,
    coalesce(p_avatar, 'avatar-01'),
    coalesce(p_theme, 'google-blue'),
    p_bio,
    coalesce(p_skills, '{}'::text[]),
    p_achievement_text,
    p_achievement_icon,
    coalesce(p_hidden, false),
    now()
  )
  on conflict (handle) do update set
    name = coalesce(excluded.name, member_profiles.name),
    department = coalesce(excluded.department, member_profiles.department),
    cohort = coalesce(excluded.cohort, member_profiles.cohort),
    avatar = coalesce(excluded.avatar, member_profiles.avatar),
    theme = coalesce(excluded.theme, member_profiles.theme),
    bio = excluded.bio,
    skills = coalesce(excluded.skills, member_profiles.skills),
    achievement_text = excluded.achievement_text,
    achievement_icon = excluded.achievement_icon,
    hidden = coalesce(excluded.hidden, member_profiles.hidden),
    updated_at = now();

  return query
  select m.handle, m.name, m.department, m.cohort, m.avatar, m.theme, m.bio, m.skills, m.achievement_text, m.achievement_icon, m.hidden, m.updated_at
  from public.member_profiles m
  where m.handle = v_h;
end;
$$;

revoke all on function public.admin_update_member_profile(text, text, text, text, text, text, text, text[], text, text, boolean) from public, anon;
grant execute on function public.admin_update_member_profile(text, text, text, text, text, text, text, text[], text, text, boolean) to authenticated;

-- Also update admin_member_overview to return the edited fields
drop function if exists public.admin_member_overview();
create or replace function public.admin_member_overview()
returns table (
  handle     text,
  name       text,
  dept       text,
  cohort     text,
  avatar     text,
  theme      text,
  bio        text,
  skills     text[],
  achieve_text text,
  achieve_icon text,
  hidden     boolean,
  points     integer,
  activities integer,
  workshops  integer,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
  select m.handle,
         m.name,
         m.department,
         m.cohort,
         m.avatar,
         m.theme,
         m.bio,
         m.skills,
         m.achievement_text,
         m.achievement_icon,
         m.hidden,
         coalesce((select sum(cp.points) from public.community_points cp
                    where cp.email_hash = m.email_hash and cp.verified = true), 0)::integer,
         (select count(*) from public.community_points cp
           where cp.email_hash = m.email_hash and cp.verified = true)::integer,
         (select count(distinct a.event_id)
            from public.attendance_records a
            join public.events e on e.id = a.event_id and e.status in ('published', 'archived')
            join public.certificate_configs c on c.event_id = e.id and c.enabled = true
           where a.attendance_status = 'attended'
             and ( (m.roll_norm is not null and private.norm_roll(a.roll_no) = m.roll_norm)
                or encode(extensions.digest(lower(btrim(coalesce(a.attendee_email, ''))), 'sha256'), 'hex') = m.email_hash )
         )::integer,
         m.updated_at
  from public.member_profiles m
  order by m.handle;
end;
$$;

revoke all on function public.admin_member_overview() from public, anon;
grant execute on function public.admin_member_overview() to authenticated;

-- Allow member_profile_overrides in public_site_settings view for instant zero-auth client-side overlay
drop view if exists public.public_site_settings;

create view public.public_site_settings with (security_invoker = false) as
  select key, value from public.site_settings
  where key in (
    'social_links', 'contact_email', 'secondary_contact_email',
    'community_intro', 'homepage_copy', 'brand_logo_url',
    'announcement_bar', 'event_categories', 'member_profile_overrides'
  );

grant select on public.public_site_settings to anon, authenticated;

notify pgrst, 'reload schema';
