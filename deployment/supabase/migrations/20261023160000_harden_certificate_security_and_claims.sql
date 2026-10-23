-- ==============================================================================
-- Migration: Harden Certificate Security, RLS, and Claim Permissions
-- Fixes:
-- 1. Drops ambiguous function overload claim_certificate(uuid, text) to prevent PGRST203.
-- 2. Strictly enforces certificate_configs.enabled = true (certificates cannot be claimed if closed).
-- 3. list_certificate_events() requires certificate_configs.enabled = true (strict opt-in).
-- 4. Enforces identifier verification: if an attendance record has a roll number or email,
--    the attendee MUST provide matching roll number or email (cannot bypass with name alone).
-- ==============================================================================

-- 1. Drop the ambiguous 2-arg overload
drop function if exists public.claim_certificate(uuid, text);

-- 2. Strict opt-in list_certificate_events
create or replace function public.list_certificate_events()
returns table(id uuid, title text, start_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.title, e.start_at
  from public.events e
  join public.certificate_configs c on c.event_id = e.id and c.enabled = true
  where e.status in ('published', 'archived')
    and exists (
      select 1 from public.attendance_records a 
      where a.event_id = e.id and a.attendance_status = 'attended'
    )
  order by e.start_at desc nulls last;
$$;

-- 3. Canonical, hardened claim_certificate function
create or replace function public.claim_certificate(p_event_id uuid, p_name text, p_identifier text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n text := private.norm_name(p_name);
  v_raw_id text := nullif(btrim(coalesce(p_identifier, '')), '');
  v_roll text := case when v_raw_id is not null and v_raw_id not like '%@%' then private.norm_roll(v_raw_id) end;
  v_email text := case when v_raw_id is not null and v_raw_id like '%@%' then lower(btrim(v_raw_id)) end;
  v_match_count integer;
  a public.attendance_records%rowtype;
  e public.events%rowtype;
  c public.certificate_configs%rowtype;
  t_html text;
begin
  if p_event_id is null or char_length(n) < 3 or char_length(n) > 120 then return null; end if;
  if char_length(coalesce(v_raw_id, '')) > 80 then return null; end if;

  -- 1. Verify event exists and is published/archived
  select * into e from public.events where id = p_event_id and status in ('published', 'archived');
  if not found then return null; end if;

  -- 2. Verify certificate issuing is explicitly configured and enabled
  select * into c from public.certificate_configs where event_id = p_event_id and enabled = true;
  if not found then return null; end if;

  -- 3. Verify attendance with strict identifier policy:
  -- If the attendee record in roster has a roll_no or attendee_email, v_raw_id MUST be provided and match.
  -- Name-only matching is permitted ONLY if the roster record itself lacks both roll number and email.
  select count(*) into v_match_count
  from public.attendance_records ar
  where ar.event_id = p_event_id
    and ar.attendance_status = 'attended'
    and private.norm_name(ar.attendee_name) = n
    and (
      -- Case A: Roster record has roll number -> student must provide matching roll number
      (ar.roll_no is not null and v_roll is not null and private.norm_roll(ar.roll_no) = v_roll)
      -- Case B: Roster record has email -> student must provide matching email
      or (ar.attendee_email is not null and v_email is not null and lower(btrim(ar.attendee_email)) = v_email)
      -- Case C: Name-only roster record (no roll number and no email on record)
      or (ar.roll_no is null and ar.attendee_email is null and (v_raw_id is null or private.norm_name(v_raw_id) = n))
    );

  if v_match_count <> 1 then
    return null;
  end if;

  select * into a
  from public.attendance_records ar
  where ar.event_id = p_event_id
    and ar.attendance_status = 'attended'
    and private.norm_name(ar.attendee_name) = n
    and (
      (ar.roll_no is not null and v_roll is not null and private.norm_roll(ar.roll_no) = v_roll)
      or (ar.attendee_email is not null and v_email is not null and lower(btrim(ar.attendee_email)) = v_email)
      or (ar.roll_no is null and ar.attendee_email is null and (v_raw_id is null or private.norm_name(v_raw_id) = n))
    )
  limit 1;

  -- Optional template override from Mission Control Studio
  select ct.html_template into t_html
  from public.certificate_templates ct
  where ct.id = coalesce(c.template_id, (select ct2.id from public.certificate_templates ct2 where ct2.is_active limit 1))
  limit 1;

  return jsonb_build_object(
    'recipient_name', regexp_replace(btrim(a.attendee_name), '\s+', ' ', 'g'),
    'credential_id', private.credential_for_key(p_event_id, private.attendee_key(a.roll_no, a.attendee_email, a.attendee_name)),
    'event_title', e.title,
    'event_start', e.start_at,
    'fields', coalesce(c.fields, '{}'::jsonb),
    'template_html', coalesce(t_html, '')
  );
end;
$$;

revoke all on function public.claim_certificate(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_certificate(uuid, text, text) to service_role;
grant execute on function public.list_certificate_events() to anon, authenticated;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- 5. Safe Leaderboard Cache Refresh (fixes Issue #52: prevents unfiltered delete warning)
create or replace function private.refresh_public_main_leaderboard_cache()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.public_main_leaderboard_cache where true;
  insert into public.public_main_leaderboard_cache(period_id,period_title,student_name,points,refreshed_at)
  select p.id,p.title,coalesce(nullif(btrim(cp.student_name),''),'Anonymous Member'),sum(cp.points)::integer,now()
  from public.leaderboard_periods p
  join public.community_points cp on cp.period_id=p.id
  where p.enabled and p.published and cp.verified and cp.points>0
  group by p.id,p.title,coalesce(nullif(btrim(cp.student_name),''),'Anonymous Member');
  return null;
end;
$$;

-- 6. Storage hardening: restrict site-assets to safe raster images (png, jpeg, webp) (Issue #55)
update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'site-assets';

