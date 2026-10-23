-- Allow attendance rosters with names only (e.g. for informal Q&A sessions, workshops without enrollment keys).
-- Backward compatible: roll numbers and emails remain supported and preferred for formal events.

-- 1. Attendee key: supports roll number (R:...), email (E:...), or name fallback (N:...)
alter table public.attendance_records drop constraint if exists attendance_has_identifier;
drop function if exists private.attendee_key(text, text);
drop function if exists private.attendee_key(text, text, text);

create or replace function private.attendee_key(p_roll text, p_email text, p_name text default null)
returns text language sql immutable set search_path = ''
as $$
  select case
    when private.norm_roll(p_roll) is not null then 'R:' || private.norm_roll(p_roll)
    when nullif(lower(btrim(coalesce(p_email, ''))), '') is not null then 'E:' || lower(btrim(p_email))
    when nullif(private.norm_name(p_name), '') is not null then 'N:' || private.norm_name(p_name)
  end
$$;

-- Attendee must have at least a valid name, roll number, or email
alter table public.attendance_records add constraint attendance_has_identifier
  check (private.attendee_key(roll_no, attendee_email, attendee_name) is not null);

-- Unique index for name-only attendees per event to prevent duplicate entries
create unique index if not exists attendance_event_name_only_unique
  on public.attendance_records (event_id, private.norm_name(attendee_name))
  where private.norm_roll(roll_no) is null and attendee_email is null;

-- 2. Import attendance roster: allows name-only rows
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

  -- Every row needs a valid name and a valid status. Roll number and email are optional.
  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as r(attendee_name text, attendee_email text, attendance_status text, roll_no text)
    where char_length(btrim(coalesce(r.attendee_name, ''))) < 3
       or char_length(btrim(coalesce(r.attendee_name, ''))) > 120
       or coalesce(r.attendance_status, 'attended') not in ('attended', 'absent', 'pending')
       or (nullif(btrim(coalesce(r.attendee_email, '')), '') is not null
           and lower(btrim(r.attendee_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  ) then
    raise exception 'Each attendee needs a valid name (3–120 characters) and a valid status' using errcode = '22023';
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
  -- For name-only rows, prevent duplicate names within the same upload
  if exists (
    select 1 from jsonb_to_recordset(p_rows) as r(attendee_name text, attendee_email text, attendance_status text, roll_no text)
    where private.norm_roll(r.roll_no) is null and nullif(btrim(coalesce(r.attendee_email, '')), '') is null
    group by private.norm_name(r.attendee_name) having count(*) > 1
  ) then
    raise exception 'The upload repeats a name without a roll number or email. When uploading names only, each name must be unique.' using errcode = '23505';
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
    -- An incoming row updates an existing attendee when roll matches, email matches, or (for name-only) name matches.
    update public.attendance_records ar
    set attendee_name = regexp_replace(btrim(r.attendee_name), '\s+', ' ', 'g'),
        attendee_email = coalesce(nullif(lower(btrim(coalesce(r.attendee_email, ''))), ''), ar.attendee_email),
        roll_no = coalesce(nullif(btrim(coalesce(r.roll_no, '')), ''), ar.roll_no),
        attendance_status = coalesce(r.attendance_status, 'attended'),
        imported_at = now()
    from jsonb_to_recordset(p_rows) as r(attendee_name text, attendee_email text, attendance_status text, roll_no text)
    where ar.event_id = p_event_id
      and (
        (private.norm_roll(r.roll_no) is not null and private.norm_roll(ar.roll_no) = private.norm_roll(r.roll_no))
        or (nullif(btrim(coalesce(r.attendee_email, '')), '') is not null
            and lower(btrim(coalesce(ar.attendee_email, ''))) = lower(btrim(r.attendee_email)))
        or (private.norm_roll(r.roll_no) is null and nullif(btrim(coalesce(r.attendee_email, '')), '') is null
            and ar.roll_no is null and ar.attendee_email is null
            and private.norm_name(ar.attendee_name) = private.norm_name(r.attendee_name))
      );
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
        and (
          (private.norm_roll(r.roll_no) is not null and private.norm_roll(ar.roll_no) = private.norm_roll(r.roll_no))
          or (nullif(btrim(coalesce(r.attendee_email, '')), '') is not null
              and lower(btrim(coalesce(ar.attendee_email, ''))) = lower(btrim(r.attendee_email)))
          or (private.norm_roll(r.roll_no) is null and nullif(btrim(coalesce(r.attendee_email, '')), '') is null
              and ar.roll_no is null and ar.attendee_email is null
              and private.norm_name(ar.attendee_name) = private.norm_name(r.attendee_name))
        )
    );
    get diagnostics v_added = row_count;
  end if;

  return jsonb_build_object('added', v_added, 'updated', v_updated, 'removed', v_removed, 'total_uploaded', v_count);
end;
$$;
revoke all on function public.import_attendance_roster(uuid, jsonb, boolean) from public, anon;
grant execute on function public.import_attendance_roster(uuid, jsonb, boolean) to authenticated;

-- 3. Claim certificate: allows matching by name alone if the attendee was registered without roll/email
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

  select * into c from public.certificate_configs where event_id = p_event_id and enabled;
  if not found then return null; end if;
  if jsonb_typeof(c.fields -> 'signatories') is distinct from 'array' or jsonb_array_length(c.fields -> 'signatories') = 0 then return null; end if;

  -- 1) If attendee has roll no, identifier must match roll no.
  -- 2) If attendee has email, identifier must match email.
  -- 3) If attendee has neither roll nor email (name-only roster), match purely on name (or identifier matching name).
  select count(*) into v_match_count
  from public.attendance_records ar
  where ar.event_id = p_event_id
    and ar.attendance_status = 'attended'
    and private.norm_name(ar.attendee_name) = n
    and (
      (v_roll is not null and private.norm_roll(ar.roll_no) = v_roll)
      or (v_email is not null and lower(btrim(coalesce(ar.attendee_email, ''))) = v_email)
      or (ar.roll_no is null and ar.attendee_email is null and (v_raw_id is null or private.norm_name(v_raw_id) = n or v_raw_id = ''))
    );
  if v_match_count <> 1 then return null; end if;

  select * into a
  from public.attendance_records ar
  where ar.event_id = p_event_id
    and ar.attendance_status = 'attended'
    and private.norm_name(ar.attendee_name) = n
    and (
      (v_roll is not null and private.norm_roll(ar.roll_no) = v_roll)
      or (v_email is not null and lower(btrim(coalesce(ar.attendee_email, ''))) = v_email)
      or (ar.roll_no is null and ar.attendee_email is null and (v_raw_id is null or private.norm_name(v_raw_id) = n or v_raw_id = ''))
    )
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
    'credential_id', private.credential_for_key(p_event_id, private.attendee_key(a.roll_no, a.attendee_email, a.attendee_name)),
    'event_title', e.title,
    'event_start', e.start_at,
    'fields', c.fields,
    'template_html', t_html
  );
end;
$$;
revoke all on function public.claim_certificate(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_certificate(uuid, text, text) to service_role;

-- 4. Verify certificate: re-derives ID using (roll_no, attendee_email, attendee_name)
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
revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;
