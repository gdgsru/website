begin;

-- ============================================================
-- 0. Admin helper. Reads public.admin_users(user_id)
-- ============================================================
create or replace function public.is_org_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admin_users au where au.user_id = auth.uid());
$$;

-- ============================================================
-- 1. Tables
-- ============================================================

-- Shared defaults (GDG logo position etc.). Single row.
create table if not exists public.certificate_global_settings (
  id smallint primary key default 1 check (id = 1),
  default_layout jsonb not null default '{}'::jsonb,   -- {"gdg": {"x":40,"y":30,"scale":1}, ...}
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.certificate_global_settings (id) values (1) on conflict (id) do nothing;

-- One certificate-details row per event.
create table if not exists public.event_certificates (
  event_id uuid primary key references public.events(id) on delete cascade,
  event_date date,
  host_chapter text not null default '',
  cert_tag text not null default 'OFFICIAL CREDENTIAL',
  cert_title text not null default 'Certificate of Participation',
  track text not null default '',
  skills text[] not null default '{}',
  dossier_tag text not null default '',
  curriculum_status text not null default 'STATUS: COMPLETED',
  curriculum_text text not null default '',
  curriculum_bullets boolean not null default false,
  signatories jsonb not null default '[]'::jsonb,       -- [{name, role, image_path}] max 2
  layout jsonb not null default '{}'::jsonb,            -- per-element overrides
  claims_enabled boolean not null default false,
  purge_at timestamptz,                                  -- set automatically from event_date
  details_updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint ec_curriculum_len check (char_length(curriculum_text) <= 2000),
  constraint ec_title_len check (char_length(cert_title) between 1 and 80),
  constraint ec_host_len check (char_length(host_chapter) <= 120),
  constraint ec_skills_len check (cardinality(skills) <= 12),
  constraint ec_sig_len check (jsonb_typeof(signatories) = 'array' and jsonb_array_length(signatories) <= 2),
  constraint ec_claims_ready check (
    not claims_enabled or (
      event_date is not null
      and char_length(btrim(host_chapter)) > 0
      and char_length(btrim(curriculum_text)) > 0
    )
  )
);

create table if not exists public.event_partners (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  role text not null check (role in ('cohost', 'sponsor')),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  logo_path text,                                        -- key in private bucket certificate-logos
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists event_partners_event_idx on public.event_partners (event_id, role, sort_order);

-- Credential receipts: issued IDs, used for verification. No roll number or email stored.
create table if not exists public.credential_receipts (
  credential_id text primary key
    check (credential_id ~ '^GDGSRU-[A-HJ-NP-Z2-9]{8}$'),
  event_id uuid not null references public.events(id) on delete cascade,
  identity_hash text not null,                           -- sha256 of event + identity, not the identity itself
  recipient_name text not null,
  status text not null default 'verified' check (status in ('verified', 'revoked')),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  purge_at timestamptz not null,
  constraint receipts_unique_identity unique (event_id, identity_hash)
);
create index if not exists receipts_purge_idx on public.credential_receipts (purge_at);

-- Rate limiting: hashed IP only.
create table if not exists public.claim_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists claim_attempts_ip_idx on public.claim_attempts (ip_hash, created_at);

-- Audit trail: who changed what. No personal data.
create table if not exists public.cert_audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  table_name text not null,
  event_id uuid,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. Attendance: normalised match columns + purge date
-- ============================================================
alter table public.attendance_records
  add column if not exists name_norm text generated always as
    (lower(regexp_replace(btrim(coalesce(attendee_name, '')), '\s+', ' ', 'g'))) stored,
  add column if not exists roll_norm text generated always as
    (nullif(upper(regexp_replace(coalesce(roll_no, ''), '\s+', '', 'g')), '')) stored,
  add column if not exists email_norm text generated always as
    (nullif(lower(btrim(coalesce(attendee_email, ''))), '')) stored,
  add column if not exists purge_at timestamptz;

create index if not exists attendance_match_idx on public.attendance_records (event_id, name_norm);

-- ============================================================
-- 3. Retention and sync triggers
-- ============================================================

-- Retention: 1 year after the event date, in IST.
create or replace function public.event_purge_at(d date)
returns timestamptz language sql stable as $$
  select case when d is null then null
              else ((d + interval '1 year')::timestamp at time zone 'Asia/Kolkata') end;
$$;

-- Every new event gets a certificate-details row.
create or replace function public.ensure_event_certificate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.event_certificates (event_id, event_date)
  values (new.id, (new.start_at at time zone 'Asia/Kolkata')::date)
  on conflict (event_id) do nothing;
  return new;
end $$;

drop trigger if exists events_create_cert on public.events;
create trigger events_create_cert after insert on public.events
for each row execute function public.ensure_event_certificate();

-- Before write: compute purge date, stamp editor, stamp details_updated_at on content change.
create or replace function public.ec_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  skip text[] := array['claims_enabled', 'purge_at', 'details_updated_at', 'updated_by'];
begin
  new.purge_at := public.event_purge_at(new.event_date);
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'INSERT'
     or (to_jsonb(new) - skip) is distinct from (to_jsonb(old) - skip) then
    new.details_updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists ec_before_write on public.event_certificates;
create trigger ec_before_write before insert or update on public.event_certificates
for each row execute function public.ec_before_write();

-- After write: when the purge date changes (e.g. event date corrected), move attendance and receipts too.
create or replace function public.ec_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.purge_at is distinct from old.purge_at then
    update public.attendance_records set purge_at = new.purge_at where event_id = new.event_id;
    update public.credential_receipts set purge_at = new.purge_at where event_id = new.event_id;
  end if;
  return null;
end $$;

drop trigger if exists ec_after_write on public.event_certificates;
create trigger ec_after_write after update on public.event_certificates
for each row execute function public.ec_after_write();

-- Attendance rows inherit the event's purge date.
create or replace function public.attendance_set_purge()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.purge_at := coalesce(
    (select ec.purge_at from public.event_certificates ec where ec.event_id = new.event_id),
    coalesce(new.imported_at, now()) + interval '1 year'
  );
  return new;
end $$;

drop trigger if exists attendance_set_purge on public.attendance_records;
create trigger attendance_set_purge before insert or update on public.attendance_records
for each row execute function public.attendance_set_purge();

-- Max 8 partners per event.
create or replace function public.partner_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.event_partners where event_id = new.event_id) >= 8 then
    raise exception 'A certificate can show at most 8 partners';
  end if;
  return new;
end $$;

drop trigger if exists partner_limit on public.event_partners;
create trigger partner_limit before insert on public.event_partners
for each row execute function public.partner_limit();

-- Revocation timestamp.
create or replace function public.receipt_status_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'revoked' and old.status is distinct from 'revoked' then
    new.revoked_at := now();
  elsif new.status = 'verified' then
    new.revoked_at := null;
  end if;
  return new;
end $$;

drop trigger if exists receipt_status_stamp on public.credential_receipts;
create trigger receipt_status_stamp before update on public.credential_receipts
for each row execute function public.receipt_status_stamp();

-- Audit trail for certificate-related changes.
create or replace function public.cert_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.cert_audit_log (actor, action, table_name, event_id)
  values (
    auth.uid(), tg_op, tg_table_name,
    coalesce((to_jsonb(new) ->> 'event_id')::uuid, (to_jsonb(old) ->> 'event_id')::uuid)
  );
  return null;
end $$;

drop trigger if exists cert_audit_ec on public.event_certificates;
create trigger cert_audit_ec after insert or update or delete on public.event_certificates
for each row execute function public.cert_audit();

drop trigger if exists cert_audit_ep on public.event_partners;
create trigger cert_audit_ep after insert or update or delete on public.event_partners
for each row execute function public.cert_audit();

drop trigger if exists cert_audit_cr on public.credential_receipts;
create trigger cert_audit_cr after update or delete on public.credential_receipts
for each row execute function public.cert_audit();

-- ============================================================
-- 4. Migrate existing data (events + legacy config if present)
-- ============================================================
insert into public.event_certificates (event_id, event_date)
select e.id, (e.start_at at time zone 'Asia/Kolkata')::date
from public.events e
on conflict (event_id) do nothing;

do $$
begin
  if to_regclass('public.certificate_configs') is not null then
    update public.event_certificates ec set
      host_chapter    = case when coalesce(cc.fields->>'chapter', '') in ('', 'GDG Chapter Name')
                             then '' else left(cc.fields->>'chapter', 120) end,
      cert_title      = coalesce(nullif(left(cc.fields->>'cert_title', 80), ''), ec.cert_title),
      cert_tag        = coalesce(nullif(left(cc.fields->>'cert_tag', 40), ''), ec.cert_tag),
      track           = coalesce(left(cc.fields->>'track', 80), ''),
      curriculum_text = coalesce(left(cc.fields->>'syllabus', 2000), '')
    from public.certificate_configs cc
    where cc.event_id = ec.event_id;
    -- claims_enabled stays false: organisers re-enable per event after checking.
  end if;
end $$;

-- Recompute purge dates for existing attendance (trigger does the work).
update public.attendance_records set purge_at = null;

-- ============================================================
-- 5. Private storage bucket for partner and signature images
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificate-logos', 'certificate-logos', false, 1048576, array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = 1048576,
      allowed_mime_types = array['image/png', 'image/jpeg'];

-- ============================================================
-- 6. Public RPCs (used by the website without login)
-- ============================================================

-- Events where public claims are open.
create or replace function public.list_certificate_events()
returns table (id uuid, title text, event_date date)
language sql stable security definer set search_path = public
as $$
  select e.id, e.title, ec.event_date
  from public.events e
  join public.event_certificates ec on ec.event_id = e.id
  where ec.claims_enabled and ec.purge_at > now()
  order by ec.event_date desc;
$$;

-- Verification. Same name and parameter as before so the frontend keeps working.
create or replace function public.verify_certificate(p_code text)
returns table (
  credential_id text, status text, recipient_name text, event_title text,
  event_date date, issued_at timestamptz, details_updated_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select r.credential_id, r.status, r.recipient_name, e.title,
         ec.event_date, r.issued_at, ec.details_updated_at
  from public.credential_receipts r
  join public.events e on e.id = r.event_id
  join public.event_certificates ec on ec.event_id = r.event_id
  where r.credential_id = upper(btrim(p_code))
    and r.purge_at > now();
$$;

-- Import attendance roster helper ensuring atomic replacement and purge calculation.
create or replace function public.import_attendance_roster(
  p_event_id uuid,
  p_rows jsonb,
  p_replace boolean default false
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_added int := 0;
  v_updated int := 0;
  v_removed int := 0;
  v_row jsonb;
  v_purge timestamptz;
begin
  if not public.is_org_admin() then
    raise exception 'Access denied: Administrator authorization required';
  end if;

  select purge_at into v_purge from public.event_certificates where event_id = p_event_id;
  if v_purge is null then
    v_purge := now() + interval '1 year';
  end if;

  if p_replace then
    delete from public.attendance_records where event_id = p_event_id;
    get diagnostics v_removed = row_count;
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    declare
      v_name text := btrim(v_row->>'attendee_name');
      v_roll text := nullif(btrim(v_row->>'roll_no'), '');
      v_email text := nullif(lower(btrim(v_row->>'attendee_email')), '');
      v_status text := coalesce(nullif(btrim(v_row->>'attendance_status'), ''), 'attended');
      v_existing_id uuid := null;
    begin
      -- Check if attendee already exists by roll number or email (or exact name if neither provided)
      if v_roll is not null then
        select id into v_existing_id from public.attendance_records
         where event_id = p_event_id and roll_norm = upper(regexp_replace(v_roll, '\s+', '', 'g'))
         limit 1;
      elsif v_email is not null then
        select id into v_existing_id from public.attendance_records
         where event_id = p_event_id and email_norm = v_email
         limit 1;
      else
        select id into v_existing_id from public.attendance_records
         where event_id = p_event_id and name_norm = lower(regexp_replace(v_name, '\s+', ' ', 'g'))
         limit 1;
      end if;

      if v_existing_id is not null then
        update public.attendance_records
           set attendee_name = v_name,
               roll_no = coalesce(v_roll, roll_no),
               attendee_email = coalesce(v_email, attendee_email),
               attendance_status = v_status,
               purge_at = v_purge
         where id = v_existing_id;
        v_updated := v_updated + 1;
      else
        insert into public.attendance_records (
          event_id, attendee_name, roll_no, attendee_email, attendance_status, purge_at
        ) values (
          p_event_id, v_name, v_roll, v_email, v_status, v_purge
        );
        v_added := v_added + 1;
      end if;
    end;
  end loop;

  return jsonb_build_object('added', v_added, 'updated', v_updated, 'removed', v_removed);
end;
$$;

-- ============================================================
-- 7. Retention purge. Called daily by the purge Edge Function.
--    Returns storage paths of deleted images so the function can remove the files.
-- ============================================================
create or replace function public.purge_expired_certificate_data()
returns setof text language plpgsql security definer set search_path = public
as $$
declare
  files text[];
begin
  select coalesce(array_agg(f), '{}') into files from (
    select p.logo_path as f
      from public.event_partners p
      join public.event_certificates ec on ec.event_id = p.event_id
     where ec.purge_at < now() and p.logo_path is not null
    union all
    select s ->> 'image_path'
      from public.event_certificates ec, jsonb_array_elements(ec.signatories) s
     where ec.purge_at < now() and coalesce(s ->> 'image_path', '') <> ''
  ) x;

  delete from public.attendance_records where purge_at < now();
  delete from public.credential_receipts where purge_at < now();
  delete from public.event_partners p using public.event_certificates ec
   where p.event_id = ec.event_id and ec.purge_at < now();
  update public.event_certificates
     set signatories = '[]'::jsonb, claims_enabled = false
   where purge_at < now() and (claims_enabled or jsonb_array_length(signatories) > 0);
  delete from public.claim_attempts where created_at < now() - interval '2 days';

  return query select unnest(files);
end $$;

-- ============================================================
-- 8. Grants
-- ============================================================
revoke all on public.certificate_global_settings, public.event_certificates,
             public.event_partners, public.credential_receipts,
             public.claim_attempts, public.cert_audit_log,
             public.attendance_records
  from anon;

-- Receipts: admins may change status only. Everything else is set by the server.
revoke update on public.credential_receipts from authenticated;
grant update (status) on public.credential_receipts to authenticated;

grant execute on function public.verify_certificate(text) to anon, authenticated;
grant execute on function public.list_certificate_events() to anon, authenticated;
grant execute on function public.import_attendance_roster(uuid, jsonb, boolean) to authenticated;

revoke execute on function public.purge_expired_certificate_data() from public, anon, authenticated;
grant execute on function public.purge_expired_certificate_data() to service_role;

commit;
