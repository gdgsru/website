-- ==============================================================================
-- Migration: Consolidate certificate claims and verification
--
-- Replaces the claim_certificate, list_certificate_events and verify_certificate
-- definitions that were stacked across earlier migrations (20261019100000,
-- 20261019120000, 20261020130000, 20261020140000, 20261023120000, 20261023130000,
-- 20261023160000). Safe to re-run.
--
-- Deliberately NOT changed: private.norm_name, private.norm_roll,
-- private.attendee_key and private.credential_for_key. Certificate IDs already
-- issued depend on them, so changing them would invalidate those certificates.
--
-- Matching rules (applied to attendance rows with status 'attended'):
--   * Names must match after normalisation.
--   * A row with a roll number matches only the same roll number.
--   * A row with an email (and no roll number) matches only the same email.
--   * A row with neither (a name-only roster) matches on name alone.
--   * Exactly one row must match, otherwise the claim is refused.
-- ==============================================================================

drop function if exists public.claim_certificate(uuid, text);
drop function if exists public.claim_certificate(uuid, text, text);

-- ----------------------------------------------------------------------------
-- 1. Claim: returns NULL (not found), {"reason":"not_configured"}, or the
--    certificate payload. Callable only with the service role (via the
--    claim-certificate Edge Function, which applies rate limiting).
-- ----------------------------------------------------------------------------
create function public.claim_certificate(p_event_id uuid, p_name text, p_identifier text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n text := private.norm_name(p_name);
  v_raw_id text := nullif(btrim(coalesce(p_identifier, '')), '');
  v_roll text := case when v_raw_id is not null and position('@' in v_raw_id) = 0
                      then private.norm_roll(v_raw_id) end;
  v_email text := case when v_raw_id is not null and position('@' in v_raw_id) > 0
                       then lower(btrim(v_raw_id)) end;
  v_match_count integer;
  a public.attendance_records%rowtype;
  e public.events%rowtype;
  c public.certificate_configs%rowtype;
  t_html text;
begin
  if p_event_id is null or char_length(coalesce(n, '')) < 3 or char_length(n) > 120 then
    return null;
  end if;
  if char_length(coalesce(v_raw_id, '')) > 80 then
    return null;
  end if;

  select * into e from public.events
  where id = p_event_id and status in ('published', 'archived');
  if not found then return null; end if;

  select * into c from public.certificate_configs
  where event_id = p_event_id and enabled = true;
  if not found then return null; end if;

  -- Event-level check (reveals nothing about any individual): a certificate
  -- cannot be issued without at least one signatory on record.
  if jsonb_typeof(c.fields -> 'signatories') is distinct from 'array'
     or jsonb_array_length(c.fields -> 'signatories') = 0 then
    return jsonb_build_object('reason', 'not_configured');
  end if;

  select count(*) into v_match_count
  from public.attendance_records ar
  where ar.event_id = p_event_id
    and ar.attendance_status = 'attended'
    and private.norm_name(ar.attendee_name) = n
    and (
         (v_roll is not null and ar.roll_no is not null and private.norm_roll(ar.roll_no) = v_roll)
      or (v_email is not null and ar.attendee_email is not null and lower(btrim(ar.attendee_email)) = v_email)
      or (ar.roll_no is null and ar.attendee_email is null)
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
         (v_roll is not null and ar.roll_no is not null and private.norm_roll(ar.roll_no) = v_roll)
      or (v_email is not null and ar.attendee_email is not null and lower(btrim(ar.attendee_email)) = v_email)
      or (ar.roll_no is null and ar.attendee_email is null)
    )
  limit 1;

  select ct.html_template into t_html
  from public.certificate_templates ct
  where ct.id = coalesce(
    c.template_id,
    (select ct2.id from public.certificate_templates ct2 where ct2.is_active limit 1)
  )
  limit 1;

  return jsonb_build_object(
    'recipient_name', regexp_replace(btrim(a.attendee_name), '\s+', ' ', 'g'),
    'credential_id', private.credential_for_key(
      p_event_id,
      private.attendee_key(a.roll_no, a.attendee_email, a.attendee_name)
    ),
    'event_title', e.title,
    'event_start', e.start_at,
    'fields', c.fields,
    'template_html', coalesce(t_html, '')
  );
end;
$$;

revoke all on function public.claim_certificate(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_certificate(uuid, text, text) to service_role;

-- ----------------------------------------------------------------------------
-- 2. Events that currently offer certificates (enabled and with attendance).
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 3. Public verification by credential ID.
-- ----------------------------------------------------------------------------
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
    and private.credential_for_key(
          a.event_id,
          private.attendee_key(a.roll_no, a.attendee_email, a.attendee_name)
        ) = upper(btrim(p_code))
  limit 1;
$$;

grant execute on function public.list_certificate_events() to anon, authenticated;
grant execute on function public.verify_certificate(text) to anon, authenticated;
