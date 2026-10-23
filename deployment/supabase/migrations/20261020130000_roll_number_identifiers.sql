-- Attendees are identified by roll number, or by email when there is no roll number.
-- The visitor types their name AND one of: roll number or registered email. Both must match.
-- Names may repeat across attendees; the identifier tells them apart.
-- Certificates are still created on demand and never stored. Credential IDs are derived from the
-- attendee's identifier (roll number, else email), so verification re-derives them from the list.
--
-- NOTE: credential IDs change with this migration. Nothing issued before it will verify again;
-- apply it before any certificate is issued.

-- 1. Storage and rules -------------------------------------------------------------------
alter table public.attendance_records add column if not exists roll_no text;

create or replace function private.norm_roll(p text)
returns text language sql immutable set search_path = ''
as $$ select nullif(upper(regexp_replace(btrim(coalesce(p, '')), '\s+', '', 'g')), '') $$;

-- The stable key for one attendee: roll number if present, otherwise email.
create or replace function private.attendee_key(p_roll text, p_email text)
returns text language sql immutable set search_path = ''
as $$
  select case
    when private.norm_roll(p_roll) is not null then 'R:' || private.norm_roll(p_roll)
    when nullif(lower(btrim(coalesce(p_email, ''))), '') is not null then 'E:' || lower(btrim(p_email))
  end
$$;

create unique index if not exists attendance_event_roll_unique
  on public.attendance_records (event_id, private.norm_roll(roll_no))
  where private.norm_roll(roll_no) is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'attendance_has_identifier') then
    -- NOT VALID: existing name-only rows stay, but they can no longer be claimed and should be re-imported.
    alter table public.attendance_records add constraint attendance_has_identifier
      check (private.attendee_key(roll_no, attendee_email) is not null) not valid;
  end if;
end $$;

-- 2. Credential IDs derived from the attendee key ----------------------------------------
create or replace function private.credential_for_key(p_event uuid, p_key text)
returns text language sql stable security definer set search_path = ''
as $$
  select 'GDGSRU-' || upper(left(md5(s.salt || '|' || p_event::text || '|' || p_key), 12))
  from private.certificate_secret s
$$;
revoke all on function private.credential_for_key(uuid, text) from public, anon, authenticated;

-- 3. Claim: name AND (roll number OR email) must match exactly one attended record -------
drop function if exists public.claim_certificate(uuid, text);
create function public.claim_certificate(p_event_id uuid, p_name text, p_identifier text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n text := private.norm_name(p_name);
  v_roll text := case when coalesce(p_identifier, '') like '%@%' then null else private.norm_roll(p_identifier) end;
  v_email text := case when coalesce(p_identifier, '') like '%@%' then lower(btrim(p_identifier)) end;
  v_match_count integer;
  a public.attendance_records%rowtype;
  e public.events%rowtype;
  c public.certificate_configs%rowtype;
  t_html text;
begin
  if p_event_id is null or char_length(n) < 3 or char_length(n) > 120 then return null; end if;
  if (v_roll is null and v_email is null) or char_length(coalesce(p_identifier, '')) > 80 then return null; end if;

  select * into c from public.certificate_configs where event_id = p_event_id and enabled;
  if not found then return null; end if;

  select count(*) into v_match_count
  from public.attendance_records ar
  where ar.event_id = p_event_id
    and ar.attendance_status = 'attended'
    and private.norm_name(ar.attendee_name) = n
    and ( (v_roll is not null and private.norm_roll(ar.roll_no) = v_roll)
       or (v_email is not null and lower(btrim(coalesce(ar.attendee_email, ''))) = v_email) );
  if v_match_count <> 1 then return null; end if;

  select * into a
  from public.attendance_records ar
  where ar.event_id = p_event_id
    and ar.attendance_status = 'attended'
    and private.norm_name(ar.attendee_name) = n
    and ( (v_roll is not null and private.norm_roll(ar.roll_no) = v_roll)
       or (v_email is not null and lower(btrim(coalesce(ar.attendee_email, ''))) = v_email) )
  limit 1;

  select * into e from public.events where id = p_event_id and status in ('published', 'archived');
  if not found then return null; end if;

  select ct.html_template into t_html
  from public.certificate_templates ct
  where ct.id = coalesce(c.template_id, (select ct2.id from public.certificate_templates ct2 where ct2.is_active limit 1))
  limit 1;
  if t_html is null then return null; end if;

  return jsonb_build_object(
    'recipient_name', regexp_replace(btrim(a.attendee_name), '\s+', ' ', 'g'),
    'credential_id', private.credential_for_key(p_event_id, private.attendee_key(a.roll_no, a.attendee_email)),
    'event_title', e.title,
    'event_start', e.start_at,
    'fields', c.fields,
    'template_html', t_html
  );
end;
$$;
revoke all on function public.claim_certificate(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_certificate(uuid, text, text) to service_role;

-- 4. Verify: re-derive the ID from every attended record (no stored certificates) ---------
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
    and private.credential_for_key(a.event_id, private.attendee_key(a.roll_no, a.attendee_email)) = upper(btrim(p_code))
  limit 1
$$;
revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;

drop function if exists private.credential_for(uuid, text);

-- 5. Import: name plus roll number or email per attendee; names may repeat ----------------
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

  -- Every row needs a valid name, a valid status, and a roll number or a valid email.
  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as r(attendee_name text, attendee_email text, attendance_status text, roll_no text)
    where char_length(btrim(coalesce(r.attendee_name, ''))) < 3
       or char_length(btrim(coalesce(r.attendee_name, ''))) > 120
       or coalesce(r.attendance_status, 'attended') not in ('attended', 'absent', 'pending')
       or (nullif(btrim(coalesce(r.attendee_email, '')), '') is not null
           and lower(btrim(r.attendee_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
       or (private.norm_roll(r.roll_no) is null and nullif(btrim(coalesce(r.attendee_email, '')), '') is null)
  ) then
    raise exception 'Each attendee needs a name, a roll number or email, and a valid status' using errcode = '22023';
  end if;

  -- One identifier must not belong to two people in the same upload.
  if exists (
    select 1 from jsonb_to_recordset(p_rows) as r(attendee_name text, attendee_email text, attendance_status text, roll_no text)
    where private.norm_roll(r.roll_no) is not null
    group by private.norm_roll(r.roll_no) having count(*) > 1
  ) then
    raise exception 'The upload repeats a roll number. Each roll number must be unique.' using errcode = '23505';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_rows) as r(attendee_name text, attendee_email text, attendance_status text, roll_no text)
    where nullif(lower(btrim(coalesce(r.attendee_email, ''))), '') is not null
    group by lower(btrim(r.attendee_email)) having count(*) > 1
  ) then
    raise exception 'The upload repeats an email address. Each email must be unique.' using errcode = '23505';
  end if;

  select count(*) into v_existing from public.attendance_records ar where ar.event_id = p_event_id;

  if p_replace then
    delete from public.attendance_records where event_id = p_event_id;
    insert into public.attendance_records(event_id, attendee_name, attendee_email, roll_no, attendance_status, created_by)
    select p_event_id,
           regexp_replace(btrim(r.attendee_name), '\s+', ' ', 'g'),
           nullif(lower(btrim(coalesce(r.attendee_email, ''))), ''),
           nullif(btrim(coalesce(r.roll_no, '')), ''),
           coalesce(r.attendance_status, 'attended'),
           auth.uid()
    from jsonb_to_recordset(p_rows) as r(attendee_name text, attendee_email text, attendance_status text, roll_no text);
    v_added := v_count;
    v_removed := v_existing;
  else
    -- An incoming row updates an existing attendee when the roll number or the email matches.
    update public.attendance_records ar
    set attendee_name = regexp_replace(btrim(r.attendee_name), '\s+', ' ', 'g'),
        attendee_email = coalesce(nullif(lower(btrim(coalesce(r.attendee_email, ''))), ''), ar.attendee_email),
        roll_no = coalesce(nullif(btrim(coalesce(r.roll_no, '')), ''), ar.roll_no),
        attendance_status = coalesce(r.attendance_status, 'attended'),
        imported_at = now()
    from jsonb_to_recordset(p_rows) as r(attendee_name text, attendee_email text, attendance_status text, roll_no text)
    where ar.event_id = p_event_id
      and ( (private.norm_roll(r.roll_no) is not null and private.norm_roll(ar.roll_no) = private.norm_roll(r.roll_no))
         or (nullif(btrim(coalesce(r.attendee_email, '')), '') is not null
             and lower(btrim(coalesce(ar.attendee_email, ''))) = lower(btrim(r.attendee_email))) );
    get diagnostics v_updated = row_count;

    insert into public.attendance_records(event_id, attendee_name, attendee_email, roll_no, attendance_status, created_by)
    select p_event_id,
           regexp_replace(btrim(r.attendee_name), '\s+', ' ', 'g'),
           nullif(lower(btrim(coalesce(r.attendee_email, ''))), ''),
           nullif(btrim(coalesce(r.roll_no, '')), ''),
           coalesce(r.attendance_status, 'attended'),
           auth.uid()
    from jsonb_to_recordset(p_rows) as r(attendee_name text, attendee_email text, attendance_status text, roll_no text)
    where not exists (
      select 1 from public.attendance_records ar
      where ar.event_id = p_event_id
        and ( (private.norm_roll(r.roll_no) is not null and private.norm_roll(ar.roll_no) = private.norm_roll(r.roll_no))
           or (nullif(btrim(coalesce(r.attendee_email, '')), '') is not null
               and lower(btrim(coalesce(ar.attendee_email, ''))) = lower(btrim(r.attendee_email))) )
    );
    get diagnostics v_added = row_count;
  end if;

  return jsonb_build_object('added', v_added, 'updated', v_updated, 'removed', v_removed, 'total_uploaded', v_count);
end;
$$;
revoke all on function public.import_attendance_roster(uuid, jsonb, boolean) from public, anon;
grant execute on function public.import_attendance_roster(uuid, jsonb, boolean) to authenticated;

-- 6. Public view of recent records is admin-only (unchanged); nothing else to expose.
