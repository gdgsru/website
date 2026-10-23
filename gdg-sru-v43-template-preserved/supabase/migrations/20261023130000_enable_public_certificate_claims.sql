-- ==============================================================================
-- Migration: Enable Direct Public Certificate Claims (Zero-Edge-Function Setup)
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

-- 1. Ensure private.attendee_key supports name-only attendees as fallback
create or replace function private.attendee_key(p_roll text, p_email text, p_name text default null)
returns text language sql immutable set search_path = ''
as $$
  select case
    when private.norm_roll(p_roll) is not null then 'R:' || private.norm_roll(p_roll)
    when nullif(lower(btrim(coalesce(p_email, ''))), '') is not null then 'E:' || lower(btrim(p_email))
    when nullif(private.norm_name(p_name), '') is not null then 'N:' || private.norm_name(p_name)
  end
$$;

-- 2. Update list_certificate_events to show published/archived events with attendance
create or replace function public.list_certificate_events()
returns table(id uuid, title text, start_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.title, e.start_at
  from public.events e
  left join public.certificate_configs c on c.event_id = e.id
  where e.status in ('published', 'archived')
    and coalesce(c.enabled, true) = true
    and exists (
      select 1 from public.attendance_records a 
      where a.event_id = e.id and a.attendance_status = 'attended'
    )
  order by e.start_at desc nulls last;
$$;

-- 3. Update claim_certificate to verify attendance on-demand
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

  select * into e from public.events where id = p_event_id and status in ('published', 'archived');
  if not found then return null; end if;

  -- Optional custom config from Mission Control
  select * into c from public.certificate_configs where event_id = p_event_id;

  -- Verify attendance:
  -- If roll or email was provided, match against roll or email (or name).
  -- If only name was provided, match by attendee_name (requiring exactly 1 match for this event).
  select count(*) into v_match_count
  from public.attendance_records ar
  where ar.event_id = p_event_id
    and ar.attendance_status = 'attended'
    and private.norm_name(ar.attendee_name) = n
    and (
      v_raw_id is null
      or (v_roll is not null and private.norm_roll(ar.roll_no) = v_roll)
      or (v_email is not null and lower(btrim(coalesce(ar.attendee_email, ''))) = v_email)
      or (private.norm_name(v_raw_id) = n)
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
      v_raw_id is null
      or (v_roll is not null and private.norm_roll(ar.roll_no) = v_roll)
      or (v_email is not null and lower(btrim(coalesce(ar.attendee_email, ''))) = v_email)
      or (private.norm_name(v_raw_id) = n)
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

-- 4. Overload for two arguments
create or replace function public.claim_certificate(p_event_id uuid, p_name text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.claim_certificate(p_event_id, p_name, null);
$$;

-- 5. Update verify_certificate to match 3-arg attendee_key
create or replace function public.verify_certificate(p_code text)
returns table(recipient_name text, event_title text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select regexp_replace(btrim(a.attendee_name), '\s+', ' ', 'g'), e.title, 'verified'::text
  from public.attendance_records a
  join public.events e on e.id = a.event_id
  where a.attendance_status = 'attended'
    and char_length(btrim(coalesce(p_code, ''))) between 10 and 40
    and private.credential_for_key(a.event_id, private.attendee_key(a.roll_no, a.attendee_email, a.attendee_name)) = upper(btrim(p_code))
  limit 1
$$;

-- 6. Grant execute permissions to anon and authenticated users
grant execute on function public.claim_certificate(uuid, text, text) to anon, authenticated;
grant execute on function public.claim_certificate(uuid, text) to anon, authenticated;
grant execute on function public.list_certificate_events() to anon, authenticated;
grant execute on function public.verify_certificate(text) to anon, authenticated;
