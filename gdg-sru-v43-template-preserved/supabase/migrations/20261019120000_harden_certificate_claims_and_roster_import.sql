-- Harden the on-demand certificate workflow.
-- Generated certificates remain stateless: this migration does NOT store a certificate per person.
-- It adds atomic attendance imports, duplicate-name protection, and short-lived hashed-IP throttling.

begin;

create schema if not exists private;

-- ------------------------------ rate limiting (no raw IP or certificate data stored)
create table if not exists private.certificate_claim_rate_limits (
  ip_hash text not null check (ip_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  primary key (ip_hash, window_start)
);
alter table private.certificate_claim_rate_limits enable row level security;
revoke all on private.certificate_claim_rate_limits from public, anon, authenticated;

-- The Edge Function supplies a SHA-256 hash of client IP + a server-side secret salt.
-- Default limit: 120 attempts per network address per 10-minute window; the Edge Function may choose a configured limit.
create or replace function public.consume_certificate_claim_attempt(p_ip_hash text, p_max_attempts integer default 120)
returns table(allowed boolean, attempts integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window timestamptz;
  v_attempts integer;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid rate-limit key' using errcode = '22023';
  end if;
  if p_max_attempts is null or p_max_attempts < 10 or p_max_attempts > 1000 then
    raise exception 'Rate-limit threshold must be between 10 and 1000' using errcode = '22023';
  end if;

  v_window := to_timestamp(floor(extract(epoch from v_now) / 600) * 600);

  insert into private.certificate_claim_rate_limits as r(ip_hash, window_start, attempt_count)
  values (p_ip_hash, v_window, 1)
  on conflict (ip_hash, window_start)
  do update set attempt_count = r.attempt_count + 1
  returning attempt_count into v_attempts;

  -- Bounded housekeeping, once every six hours (rate-limit rows are not attendance/certificate records).
  if mod(extract(epoch from v_window)::bigint, 21600) = 0 then
    delete from private.certificate_claim_rate_limits
    where window_start < v_window - interval '24 hours';
  end if;

  return query
  select v_attempts <= p_max_attempts,
         v_attempts,
         greatest(1, ceil(extract(epoch from (v_window + interval '10 minutes' - v_now))::numeric)::integer);
end;
$$;
revoke all on function public.consume_certificate_claim_attempt(text, integer) from public, anon, authenticated;
grant execute on function public.consume_certificate_claim_attempt(text, integer) to service_role;

-- ------------------------------ event list: published and archived events may issue certificates
create or replace function public.list_certificate_events()
returns table(id uuid, title text, start_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.title, e.start_at
  from public.events e
  join public.certificate_configs c on c.event_id = e.id and c.enabled
  where e.status in ('published', 'archived')
    and exists (
      select 1 from public.attendance_records a
      where a.event_id = e.id and a.attendance_status = 'attended'
    )
  order by e.start_at desc nulls last
$$;
revoke all on function public.list_certificate_events() from public;
grant execute on function public.list_certificate_events() to anon, authenticated;

-- ------------------------------ claims: callable only by the trusted Edge Function
-- Name-only claiming cannot distinguish two people with the same normalized name.
-- Only a single matching attended row is eligible; ambiguous names fail closed.
create or replace function public.claim_certificate(p_event_id uuid, p_name text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n text := private.norm_name(p_name);
  v_match_count integer;
  a public.attendance_records%rowtype;
  e public.events%rowtype;
  c public.certificate_configs%rowtype;
  t_html text;
begin
  if p_event_id is null or char_length(n) < 3 or char_length(n) > 120 then
    return null;
  end if;

  select * into c
  from public.certificate_configs
  where event_id = p_event_id and enabled;
  if not found then return null; end if;

  select count(*) into v_match_count
  from public.attendance_records ar
  where ar.event_id = p_event_id
    and ar.attendance_status = 'attended'
    and private.norm_name(ar.attendee_name) = n;

  if v_match_count <> 1 then return null; end if;

  select * into a
  from public.attendance_records ar
  where ar.event_id = p_event_id
    and ar.attendance_status = 'attended'
    and private.norm_name(ar.attendee_name) = n
  limit 1;

  select * into e from public.events where id = p_event_id and status in ('published', 'archived');
  if not found then return null; end if;

  select ct.html_template into t_html
  from public.certificate_templates ct
  where ct.id = coalesce(
    c.template_id,
    (select ct2.id from public.certificate_templates ct2 where ct2.is_active limit 1)
  )
  limit 1;
  if t_html is null then return null; end if;

  return jsonb_build_object(
    'recipient_name', regexp_replace(btrim(a.attendee_name), '\s+', ' ', 'g'),
    'credential_id', private.credential_for(p_event_id, a.attendee_name),
    'event_title', e.title,
    'event_start', e.start_at,
    'fields', c.fields,
    'template_html', t_html
  );
end;
$$;
revoke all on function public.claim_certificate(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_certificate(uuid, text) to service_role;

-- Certificate verification should continue to work when issuing has been closed for an event.
-- It checks the attendance-backed credential ID and does not require certificate_configs.enabled.
drop function if exists public.verify_certificate(text);
create function public.verify_certificate(p_code text)
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
    and private.credential_for(a.event_id, a.attendee_name) = upper(btrim(p_code))
  limit 1
$$;
revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- ------------------------------ atomic attendance roster import
-- Called by the admin UI once per upload. All operations happen in a single transaction.
create or replace function public.import_attendance_roster(
  p_event_id uuid,
  p_rows jsonb,
  p_replace boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_existing integer := 0;
  v_added integer := 0;
  v_updated integer := 0;
  v_removed integer := 0;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_event_id is null or not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'Choose a valid event' using errcode = '22023';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Attendance rows must be a JSON array' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_rows);
  if v_count < 1 or v_count > 10000 then
    raise exception 'Upload between 1 and 10000 attendee rows' using errcode = '22023';
  end if;

  -- Reject malformed records rather than silently creating partial rosters.
  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as r(attendee_name text, attendee_email text, attendance_status text)
    where char_length(btrim(coalesce(r.attendee_name, ''))) < 3
       or char_length(btrim(coalesce(r.attendee_name, ''))) > 120
       or coalesce(r.attendance_status, 'attended') not in ('attended', 'absent', 'pending')
       or (nullif(btrim(coalesce(r.attendee_email, '')), '') is not null
           and lower(btrim(r.attendee_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  ) then
    raise exception 'One or more attendee rows have an invalid name, email, or status' using errcode = '22023';
  end if;

  -- A name-only public form needs one unique normalized name per event.
  if exists (
    select private.norm_name(r.attendee_name)
    from jsonb_to_recordset(p_rows) as r(attendee_name text, attendee_email text, attendance_status text)
    group by private.norm_name(r.attendee_name)
    having count(*) > 1
  ) then
    raise exception 'The upload contains duplicate names. Make attendee names unique before importing.' using errcode = '23505';
  end if;

  select count(*) into v_existing
  from public.attendance_records ar
  where ar.event_id = p_event_id;

  if p_replace then
    -- Replacement is atomic: if any new row violates a constraint, the deletion rolls back too.
    delete from public.attendance_records where event_id = p_event_id;
    insert into public.attendance_records(
      event_id, attendee_name, attendee_email, attendance_status, created_by
    )
    select p_event_id,
           regexp_replace(btrim(r.attendee_name), '\s+', ' ', 'g'),
           nullif(lower(btrim(coalesce(r.attendee_email, ''))), ''),
           coalesce(r.attendance_status, 'attended'),
           auth.uid()
    from jsonb_to_recordset(p_rows) as r(attendee_name text, attendee_email text, attendance_status text);
    v_added := v_count;
    v_removed := v_existing;
  else
    -- Do not silently update an existing name if the current roster has become ambiguous.
    if exists (
      select 1
      from public.attendance_records ar
      join (
        select distinct private.norm_name(r.attendee_name) as norm
        from jsonb_to_recordset(p_rows) as r(attendee_name text, attendee_email text, attendance_status text)
      ) incoming on private.norm_name(ar.attendee_name) = incoming.norm
      where ar.event_id = p_event_id
      group by private.norm_name(ar.attendee_name)
      having count(*) > 1
    ) then
      raise exception 'The current roster contains duplicate normalized names. Replace it with a clean unique-name CSV.' using errcode = '23505';
    end if;

    update public.attendance_records ar
    set attendee_name = regexp_replace(btrim(r.attendee_name), '\s+', ' ', 'g'),
        attendee_email = coalesce(nullif(lower(btrim(coalesce(r.attendee_email, ''))), ''), ar.attendee_email),
        attendance_status = coalesce(r.attendance_status, 'attended'),
        imported_at = now()
    from jsonb_to_recordset(p_rows) as r(attendee_name text, attendee_email text, attendance_status text)
    where ar.event_id = p_event_id
      and private.norm_name(ar.attendee_name) = private.norm_name(r.attendee_name);
    get diagnostics v_updated = row_count;

    insert into public.attendance_records(
      event_id, attendee_name, attendee_email, attendance_status, created_by
    )
    select p_event_id,
           regexp_replace(btrim(r.attendee_name), '\s+', ' ', 'g'),
           nullif(lower(btrim(coalesce(r.attendee_email, ''))), ''),
           coalesce(r.attendance_status, 'attended'),
           auth.uid()
    from jsonb_to_recordset(p_rows) as r(attendee_name text, attendee_email text, attendance_status text)
    where not exists (
      select 1 from public.attendance_records ar
      where ar.event_id = p_event_id
        and private.norm_name(ar.attendee_name) = private.norm_name(r.attendee_name)
    );
    get diagnostics v_added = row_count;
  end if;

  return jsonb_build_object('added', v_added, 'updated', v_updated, 'removed', v_removed, 'total_uploaded', v_count);
end;
$$;
revoke all on function public.import_attendance_roster(uuid, jsonb, boolean) from public, anon;
grant execute on function public.import_attendance_roster(uuid, jsonb, boolean) to authenticated;


-- ------------------------------ transactional template activation
create or replace function public.activate_certificate_template(p_template_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('gdg-sru-certificate-template-activation'));
  if not exists (select 1 from public.certificate_templates where id = p_template_id) then
    raise exception 'Template not found' using errcode = '22023';
  end if;
  update public.certificate_templates set is_active = false where is_active = true and id <> p_template_id;
  update public.certificate_templates set is_active = true, updated_at = now() where id = p_template_id;
end;
$$;
revoke all on function public.activate_certificate_template(uuid) from public, anon;
grant execute on function public.activate_certificate_template(uuid) to authenticated;

commit;
