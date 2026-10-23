-- Four changes:
--  1. Certificates need at least one signatory: enforced when the event's certificates are turned on, and again when a certificate is claimed.
--  2. Track cards on the home page are an editable setting (home_tracks), readable by the public.
--  3. Attendance records (names, emails, roll numbers) are deleted one year after the event ends.
--  4. Safe to run more than once.

-- 1. Signatories ---------------------------------------------------------------------------
create or replace function private.require_signatories()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.enabled and (jsonb_typeof(new.fields -> 'signatories') is distinct from 'array'
                      or jsonb_array_length(new.fields -> 'signatories') = 0) then
    raise exception 'Add at least one signatory before turning on certificates for this event' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists certificate_configs_require_signatories on public.certificate_configs;
create trigger certificate_configs_require_signatories
  before insert or update on public.certificate_configs
  for each row execute function private.require_signatories();

create or replace function public.claim_certificate(p_event_id uuid, p_name text, p_identifier text)
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
  -- Certificates are not issued until the event has at least one signatory.
  if jsonb_typeof(c.fields -> 'signatories') is distinct from 'array' or jsonb_array_length(c.fields -> 'signatories') = 0 then return null; end if;

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

-- 2. Home track cards are public settings --------------------------------------------------
drop policy if exists settings_public_allowlist_read on public.site_settings;
create policy settings_public_allowlist_read on public.site_settings for select to anon, authenticated
  using (key in ('social_links','contact_email','secondary_contact_email','community_intro','homepage_copy','brand_logo_url','team_page','home_tracks'));

create or replace view public.public_site_settings with (security_invoker = true) as
  select key, value from public.site_settings
  where key in ('social_links','contact_email','secondary_contact_email','community_intro','homepage_copy','brand_logo_url','team_page','home_tracks');
grant select on public.public_site_settings to anon, authenticated;

-- 3. Retention: one year after the event ends ------------------------------------------------
create or replace function private.purge_expired_personal_data()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer := 0;
  v_orphaned integer := 0;
begin
  delete from public.attendance_records ar
  using public.events e
  where e.id = ar.event_id
    and coalesce(e.end_at, e.start_at, ar.imported_at) < now() - interval '1 year';
  get diagnostics v_deleted = row_count;

  -- Attendance rows whose event no longer exists are also removed once they are a year old.
  delete from public.attendance_records ar
  where not exists (select 1 from public.events e where e.id = ar.event_id)
    and ar.imported_at < now() - interval '1 year';
  get diagnostics v_orphaned = row_count;
  v_deleted := v_deleted + v_orphaned;

  return v_deleted;
end;
$$;
revoke all on function private.purge_expired_personal_data() from public, anon, authenticated;

-- Schedule it daily when pg_cron is available. On projects without it, run the function by hand or add a scheduled job.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute $cmd$select cron.schedule('purge-expired-personal-data', '17 3 * * *', 'select private.purge_expired_personal_data()')$cmd$;
  else
    raise notice 'pg_cron is not available: schedule select private.purge_expired_personal_data(); daily.';
  end if;
end
$$;
