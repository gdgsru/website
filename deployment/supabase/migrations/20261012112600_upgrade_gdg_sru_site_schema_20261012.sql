-- Forward-only upgrade for the existing (empty) GDG SRU Supabase project.
-- The project already had an earlier schema, so archive its zero-row application
-- tables instead of dropping data or attempting to reuse incompatible columns.
-- This migration is intended to be applied once through Supabase migration tooling.

DO $$
BEGIN
  IF to_regclass('public.events') IS NOT NULL THEN ALTER TABLE public.events RENAME TO legacy_events_20261012; END IF;
  IF to_regclass('public.team_members') IS NOT NULL THEN ALTER TABLE public.team_members RENAME TO legacy_team_members_20261012; END IF;
  IF to_regclass('public.leaderboard_periods') IS NOT NULL THEN ALTER TABLE public.leaderboard_periods RENAME TO legacy_leaderboard_periods_20261012; END IF;
  IF to_regclass('public.certificates') IS NOT NULL THEN ALTER TABLE public.certificates RENAME TO legacy_certificates_20261012; END IF;
  IF to_regclass('public.audit_logs') IS NOT NULL THEN ALTER TABLE public.audit_logs RENAME TO legacy_audit_logs_20261012; END IF;
  IF to_regclass('public.member_profiles') IS NOT NULL THEN ALTER TABLE public.member_profiles RENAME TO legacy_member_profiles_20261012; END IF;
  IF to_regclass('public.blog_posts') IS NOT NULL THEN ALTER TABLE public.blog_posts RENAME TO legacy_blog_posts_20261012; END IF;
  IF to_regclass('public.point_awards') IS NOT NULL THEN ALTER TABLE public.point_awards RENAME TO legacy_point_awards_20261012; END IF;
  IF to_regclass('public.contact_messages') IS NOT NULL THEN ALTER TABLE public.contact_messages RENAME TO legacy_contact_messages_20261012; END IF;
  IF to_regclass('public.public_leaderboard_cache') IS NOT NULL THEN ALTER TABLE public.public_leaderboard_cache RENAME TO legacy_public_leaderboard_cache_20261012; END IF;
END $$;

-- Free constraint/index names needed by the new schema while preserving the old tables.
ALTER TABLE public.legacy_events_20261012 RENAME CONSTRAINT events_pkey TO legacy_events_pkey_20261012;
ALTER TABLE public.legacy_events_20261012 RENAME CONSTRAINT events_slug_key TO legacy_events_slug_key_20261012;
ALTER TABLE public.legacy_team_members_20261012 RENAME CONSTRAINT team_members_pkey TO legacy_team_members_pkey_20261012;
ALTER TABLE public.legacy_leaderboard_periods_20261012 RENAME CONSTRAINT leaderboard_periods_pkey TO legacy_leaderboard_periods_pkey_20261012;
ALTER TABLE public.legacy_certificates_20261012 RENAME CONSTRAINT certificates_pkey TO legacy_certificates_pkey_20261012;
ALTER TABLE public.legacy_certificates_20261012 RENAME CONSTRAINT certificates_verification_code_hash_key TO legacy_certificates_hash_key_20261012;
ALTER TABLE public.legacy_audit_logs_20261012 RENAME CONSTRAINT audit_logs_pkey TO legacy_audit_logs_pkey_20261012;

-- Legacy tables are archival only; disable old helper triggers and revoke browser access.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'legacy_events_20261012','legacy_team_members_20261012','legacy_leaderboard_periods_20261012',
    'legacy_certificates_20261012','legacy_audit_logs_20261012','legacy_member_profiles_20261012',
    'legacy_blog_posts_20261012','legacy_point_awards_20261012','legacy_contact_messages_20261012',
    'legacy_public_leaderboard_cache_20261012'
  ] LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', t);
  END LOOP;
END $$;

-- New application schema follows.
-- GDG SRU production schema (Supabase/PostgreSQL)
-- Run once in Supabase SQL Editor on a fresh project. Policies are intentionally created once, not a repeatable migration. Review before production use.
create extension if not exists pgcrypto with schema extensions;

-- Private administrator allowlist. Never expose this table to anonymous visitors.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public, auth
as $$ select exists (select 1 from public.admin_users a where a.user_id = auth.uid()) $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category text not null default 'Other',
  summary text not null default '',
  description text not null default '',
  image_url text,
  start_at timestamptz,
  end_at timestamptz,
  timezone text not null default 'Asia/Kolkata',
  venue text,
  online_url text,
  registration_url text,
  status text not null default 'draft' check (status in ('draft','published','cancelled','archived')),
  featured boolean not null default false,
  pinned_next_session boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (registration_url is null or registration_url ~* '^https?://'),
  check (online_url is null or online_url ~* '^https?://'),
  check (image_url is null or image_url ~* '^https?://'),
  check (end_at is null or start_at is null or end_at >= start_at)
);
create unique index if not exists events_one_pinned_next_session on public.events ((pinned_next_session)) where pinned_next_session = true and status = 'published';

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default '',
  department text not null default '',
  leadership_order integer not null default 100,
  bio text not null default '',
  photo_url text,
  social_links jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (photo_url is null or photo_url ~* '^https?://')
);

create table if not exists public.blog_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null default '',
  description text not null default '',
  image_url text,
  category text not null default 'General',
  external_url text not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (external_url ~* '^https?://'),
  check (image_url is null or image_url ~* '^https?://')
);

-- One table powers both Resource Hub sections: kind='external' and kind='gdg'.
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('external','gdg')),
  title text not null,
  description text not null default '',
  category text not null default 'General',
  resource_type text not null default 'link' check (resource_type in ('link','presentation','video','notes','pdf','file','other')),
  image_url text,
  destination_url text,
  access_type text not null default 'free' check (access_type in ('free','free_tier','student_access','restricted')),
  limitations text not null default '',
  eligibility text not null default '',
  event_id uuid references public.events(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','published','hidden','archived')),
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (destination_url is null or destination_url ~* '^https?://'),
  check (image_url is null or image_url ~* '^https?://')
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  attendee_name text,
  attendee_email text,
  attendance_status text not null default 'attended' check (attendance_status in ('attended','absent','pending')),
  imported_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create unique index if not exists attendance_event_email_unique on public.attendance_records (event_id, lower(trim(attendee_email)));

create table if not exists public.certificate_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  html_template text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists certificate_single_active_template on public.certificate_templates (is_active) where is_active = true;

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_code text not null unique,
  attendance_id uuid unique references public.attendance_records(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  template_id uuid references public.certificate_templates(id) on delete set null,
  template_html text not null default '',
  recipient_name text not null,
  event_title text not null,
  issue_date date not null default current_date,
  email_hash text not null,
  downloaded_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists certificates_email_hash_idx on public.certificates(email_hash);

create table if not exists public.certificate_claim_challenges (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  email_hash text not null,
  code_hash text not null,
  attempts integer not null default 0 check (attempts between 0 and 10),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists certificate_challenges_lookup on public.certificate_claim_challenges(event_id, email_hash, created_at desc);

-- Short-lived one-use token proves the requester completed the email-code challenge before PII cleanup.
create table if not exists public.certificate_download_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  certificate_id uuid not null references public.certificates(id) on delete cascade,
  email_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.leaderboard_periods (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  period_type text not null check (period_type in ('semester','academic_year')),
  starts_on date not null,
  ends_on date not null,
  enabled boolean not null default true,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create unique index if not exists leaderboard_single_published_enabled on public.leaderboard_periods ((published)) where published = true and enabled = true;

create table if not exists public.point_rules (
  id uuid primary key default gen_random_uuid(),
  activity_type text not null unique,
  label text not null,
  points integer not null check (points > 0 and points <= 10000),
  max_per_period integer not null default 1 check (max_per_period > 0),
  enabled boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.community_points (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.leaderboard_periods(id) on delete restrict,
  student_name text not null,
  email_hash text not null,
  activity_type text not null references public.point_rules(activity_type) on update cascade on delete restrict,
  source_ref text not null,
  points integer not null check (points > 0 and points <= 10000),
  note text not null default '',
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(period_id, email_hash, activity_type, source_ref)
);
create index if not exists community_points_period_lookup on public.community_points(period_id, email_hash);

create table if not exists public.sponsored_leaderboards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  program_name text not null,
  period_label text not null default '',
  enabled boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.sponsored_leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  leaderboard_id uuid not null references public.sponsored_leaderboards(id) on delete cascade,
  student_name text not null,
  points integer not null default 0 check (points >= 0 and points <= 1000000),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  table_name text not null,
  record_id text,
  created_at timestamptz not null default now()
);

-- Public projections intentionally exclude emails, activity breakdowns, internal notes and claim metadata.
create or replace view public.public_event_list with (security_invoker = false) as
  select id, title, slug, category, summary, description, image_url, start_at, end_at, timezone, venue, online_url, registration_url, featured, pinned_next_session
  from public.events where status = 'published';
grant select on public.public_event_list to anon, authenticated;

create or replace view public.public_team_list with (security_invoker = false) as
  select id, name, role, department, leadership_order, bio, photo_url, social_links, sort_order
  from public.team_members where status = 'published';
grant select on public.public_team_list to anon, authenticated;

create or replace view public.public_blog_list with (security_invoker = false) as
  select id, title, author, description, image_url, category, external_url, featured, sort_order, created_at
  from public.blog_entries where status = 'published';
grant select on public.public_blog_list to anon, authenticated;

create or replace view public.public_resource_list with (security_invoker = false) as
  select id, kind, title, description, category, resource_type, image_url, destination_url, access_type, limitations, eligibility, event_id, featured, sort_order, created_at
  from public.resources where status = 'published';
grant select on public.public_resource_list to anon, authenticated;

create or replace view public.public_main_leaderboard with (security_invoker = false) as
  select period_id, period_title, student_name, points,
         dense_rank() over (partition by period_id order by points desc) as rank
  from (
    select p.id as period_id, p.title as period_title, cp.email_hash, min(cp.student_name) as student_name, sum(cp.points)::integer as points
    from public.leaderboard_periods p
    join public.community_points cp on cp.period_id = p.id
    where p.published = true
    group by p.id, p.title, cp.email_hash
  ) totals;
grant select on public.public_main_leaderboard to anon, authenticated;

create or replace view public.public_sponsored_leaderboards with (security_invoker = false) as
  select lb.id as leaderboard_id, lb.title, lb.program_name, lb.period_label, e.student_name, e.points,
         dense_rank() over (partition by lb.id order by e.points desc, e.student_name asc) as rank,
         lb.sort_order as leaderboard_sort_order, e.sort_order as entry_sort_order
  from public.sponsored_leaderboards lb join public.sponsored_leaderboard_entries e on e.leaderboard_id = lb.id
  where lb.enabled = true and lb.published = true;
grant select on public.public_sponsored_leaderboards to anon, authenticated;

-- Public site settings allowlist. Never expose all settings through an unrestricted table query.
create or replace view public.public_site_settings with (security_invoker = false) as
  select key, value from public.site_settings where key in ('social_links','contact_email','secondary_contact_email','community_intro','homepage_copy','brand_logo_url');
grant select on public.public_site_settings to anon, authenticated;

create or replace view public.public_point_rules with (security_invoker = false) as
  select activity_type, label, points, sort_order from public.point_rules where enabled = true;
grant select on public.public_point_rules to anon, authenticated;

-- Helpers and RPCs. Public verification returns only the minimum information needed.
create or replace function public.record_community_activity(
  p_period_id uuid, p_student_name text, p_student_email text,
  p_activity_type text, p_source_ref text, p_note text default ''
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare r public.point_rules%rowtype; v_hash text; v_id uuid; v_count integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if nullif(trim(p_student_name),'') is null or nullif(trim(p_student_email),'') is null then raise exception 'Student name and email are required'; end if;
  if nullif(trim(p_source_ref),'') is null then raise exception 'A source/reference is required to prevent duplicate credit'; end if;
  if not exists (select 1 from public.leaderboard_periods where id=p_period_id and enabled=true) then raise exception 'This leaderboard period is not active for scoring'; end if;
  select * into r from public.point_rules where activity_type=p_activity_type and enabled=true;
  if not found then raise exception 'This activity type is not enabled'; end if;
  select count(*) into v_count from public.community_points where period_id=p_period_id and email_hash=encode(extensions.digest(lower(trim(p_student_email)), 'sha256'),'hex') and activity_type=p_activity_type;
  if v_count >= r.max_per_period then raise exception 'This student has reached the point limit for this activity in the selected period'; end if;
  v_hash := encode(extensions.digest(lower(trim(p_student_email)), 'sha256'),'hex');
  insert into public.community_points(period_id,student_name,email_hash,activity_type,source_ref,points,note,recorded_by)
  values(p_period_id,trim(p_student_name),v_hash,p_activity_type,trim(p_source_ref),r.points,coalesce(p_note,''),auth.uid()) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.record_community_activity(uuid,text,text,text,text,text) from public, anon;
grant execute on function public.record_community_activity(uuid,text,text,text,text,text) to authenticated;

create or replace function public.issue_certificate_for_attendance(p_attendance_id uuid, p_template_id uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare a public.attendance_records%rowtype; e public.events%rowtype; t public.certificate_templates%rowtype; c text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select * into a from public.attendance_records where id=p_attendance_id and attendance_status='attended';
  if not found then raise exception 'No eligible attendance record was found'; end if;
  select * into e from public.events where id=a.event_id;
  select * into t from public.certificate_templates where id=p_template_id;
  if not found then raise exception 'Certificate template not found'; end if;
  if exists(select 1 from public.certificates where attendance_id=a.id) then raise exception 'A certificate has already been issued for this attendance record'; end if;
  c := 'GDGSRU-'||to_char(current_date,'YY')||'-'||upper(encode(extensions.gen_random_bytes(8),'hex'));
  insert into public.certificates(certificate_code,attendance_id,event_id,template_id,template_html,recipient_name,event_title,email_hash)
  values(c,a.id,a.event_id,t.id,t.html_template,a.attendee_name,e.title,encode(extensions.digest(lower(trim(a.attendee_email)),'sha256'),'hex'));
  return c;
end $$;
revoke all on function public.issue_certificate_for_attendance(uuid,uuid) from public, anon;
grant execute on function public.issue_certificate_for_attendance(uuid,uuid) to authenticated;

create or replace function public.verify_certificate(p_code text)
returns table(certificate_code text, recipient_name text, event_title text, issue_date date, status text)
language sql stable security definer set search_path = public as $$
  select c.certificate_code,c.recipient_name,c.event_title,c.issue_date,
         case when c.revoked_at is null then 'verified' else 'revoked' end
  from public.certificates c where c.certificate_code=upper(trim(p_code))
$$;
revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;

create or replace function public.mark_certificate_downloaded(p_code text, p_email text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare c public.certificates%rowtype;
begin
  select * into c from public.certificates
   where certificate_code=upper(trim(p_code))
     and email_hash=encode(extensions.digest(lower(trim(p_email)), 'sha256'),'hex')
     and revoked_at is null;
  if not found then raise exception 'Certificate could not be found for that email'; end if;
  update public.certificates set downloaded_at=coalesce(downloaded_at,now()) where id=c.id;
  return jsonb_build_object('certificate_code',c.certificate_code,'recipient_name',c.recipient_name,'event_title',c.event_title,'issue_date',c.issue_date,'template_id',c.template_id);
end $$;
revoke all on function public.mark_certificate_downloaded(text,text) from public, anon, authenticated;

-- RLS on every application table.
do $$ declare t text; begin
  foreach t in array array['admin_users','site_settings','events','team_members','blog_entries','resources','attendance_records','certificate_templates','certificates','certificate_claim_challenges','certificate_download_tokens','leaderboard_periods','point_rules','community_points','sponsored_leaderboards','sponsored_leaderboard_entries','audit_logs'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- No public/admin-account-list exposure. A signed-in admin can see only their own allowlist row.
create policy admin_users_self_read on public.admin_users for select to authenticated using (user_id=auth.uid());
create policy settings_public_allowlist_read on public.site_settings for select to anon, authenticated using (key in ('social_links','contact_email','secondary_contact_email','community_intro','homepage_copy','brand_logo_url'));
create policy settings_admin_read on public.site_settings for select to authenticated using (public.is_admin());
create policy settings_admin_write on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy events_public_read on public.events for select to anon, authenticated using (status='published');
create policy events_admin_read on public.events for select to authenticated using (public.is_admin());
create policy events_admin_write on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy team_public_read on public.team_members for select to anon, authenticated using (status='published');
create policy team_admin_read on public.team_members for select to authenticated using (public.is_admin());
create policy team_admin_write on public.team_members for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy blog_public_read on public.blog_entries for select to anon, authenticated using (status='published');
create policy blog_admin_read on public.blog_entries for select to authenticated using (public.is_admin());
create policy blog_admin_write on public.blog_entries for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy resources_public_read on public.resources for select to anon, authenticated using (status='published');
create policy resources_admin_read on public.resources for select to authenticated using (public.is_admin());
create policy resources_admin_write on public.resources for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy attendance_admin_all on public.attendance_records for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy templates_admin_all on public.certificate_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy certificates_admin_read on public.certificates for select to authenticated using (public.is_admin());
create policy certificates_admin_update on public.certificates for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy periods_public_read on public.leaderboard_periods for select to anon, authenticated using (enabled=true and published=true);
create policy periods_admin_read on public.leaderboard_periods for select to authenticated using (public.is_admin());
create policy periods_admin_write on public.leaderboard_periods for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy point_rules_admin_all on public.point_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy community_points_admin_all on public.community_points for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy sponsored_public_read on public.sponsored_leaderboards for select to anon, authenticated using (enabled=true and published=true);
create policy sponsored_admin_read on public.sponsored_leaderboards for select to authenticated using (public.is_admin());
create policy sponsored_admin_write on public.sponsored_leaderboards for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy sponsored_entries_public_read on public.sponsored_leaderboard_entries for select to anon, authenticated using (exists(select 1 from public.sponsored_leaderboards l where l.id=leaderboard_id and l.enabled=true and l.published=true));
create policy sponsored_entries_admin_read on public.sponsored_leaderboard_entries for select to authenticated using (public.is_admin());
create policy sponsored_entries_admin_write on public.sponsored_leaderboard_entries for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy audit_admin_read on public.audit_logs for select to authenticated using (public.is_admin());
create policy audit_admin_insert on public.audit_logs for insert to authenticated with check (public.is_admin());

grant usage on schema public to anon, authenticated;

-- Explicit least-privilege table grants. Row-level policies above remain the authority;
-- these grants make the intended PostgREST access explicit on fresh projects.
revoke all on table public.admin_users, public.site_settings, public.events, public.team_members,
  public.blog_entries, public.resources, public.attendance_records, public.certificate_templates,
  public.certificates, public.certificate_claim_challenges, public.certificate_download_tokens,
  public.leaderboard_periods, public.point_rules, public.community_points,
  public.sponsored_leaderboards, public.sponsored_leaderboard_entries, public.audit_logs
from anon, authenticated;

grant select on table public.admin_users to authenticated;
grant select, insert, update, delete on table public.site_settings, public.events,
  public.team_members, public.blog_entries, public.resources, public.attendance_records,
  public.certificate_templates, public.leaderboard_periods, public.sponsored_leaderboards,
  public.sponsored_leaderboard_entries to authenticated;
grant select, update on table public.certificates to authenticated;
grant select, update on table public.point_rules to authenticated;
grant select on table public.community_points to authenticated;
grant select, insert on table public.audit_logs to authenticated;
-- OTP challenges and one-use claim tokens are service-role-only; certificate issuance is RPC-only.

-- Public brand assets can be read by visitors; writes are restricted to the admin allowlist.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-assets','site-assets',true,5242880,array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set public=true, file_size_limit=5242880, allowed_mime_types=array['image/png','image/jpeg','image/webp','image/svg+xml'];
create policy site_assets_public_read on storage.objects for select to anon, authenticated using (bucket_id='site-assets');
create policy site_assets_admin_insert on storage.objects for insert to authenticated with check (bucket_id='site-assets' and public.is_admin());
create policy site_assets_admin_update on storage.objects for update to authenticated using (bucket_id='site-assets' and public.is_admin()) with check (bucket_id='site-assets' and public.is_admin());
create policy site_assets_admin_delete on storage.objects for delete to authenticated using (bucket_id='site-assets' and public.is_admin());

-- Public resource files (e.g. event slides/PDFs) should contain no private student information.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resource-files','resource-files',true,52428800,array['application/pdf','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain','video/mp4','video/webm','application/zip'])
on conflict (id) do update set public=true, file_size_limit=52428800, allowed_mime_types=array['application/pdf','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain','video/mp4','video/webm','application/zip'];
create policy resource_files_public_read on storage.objects for select to anon, authenticated using (bucket_id='resource-files');
create policy resource_files_admin_insert on storage.objects for insert to authenticated with check (bucket_id='resource-files' and public.is_admin());
create policy resource_files_admin_update on storage.objects for update to authenticated using (bucket_id='resource-files' and public.is_admin()) with check (bucket_id='resource-files' and public.is_admin());
create policy resource_files_admin_delete on storage.objects for delete to authenticated using (bucket_id='resource-files' and public.is_admin());

-- Seed predefined point rules consistent with the existing public site's scoring guide.
-- Admin records eligible activities; points come from these fixed rules, never arbitrary per-student input.
insert into public.point_rules(activity_type,label,points,max_per_period,sort_order) values
 ('regular_attendance','Regular workshop / technical session attendance',5,40,10),
 ('major_event_attendance','Major chapter event attendance',10,20,20),
 ('multi_session_attendance','Multi-session series / jam session attendance',3,40,30),
 ('multi_session_completion','Complete all sessions in a multi-session series',5,5,40),
 ('task_small','Completed small assigned event task',5,20,50),
 ('task_medium','Completed medium assigned event task',10,20,60),
 ('task_large','Completed large assigned event task',20,10,70),
 ('volunteering','Approved volunteering contribution',5,20,80),
 ('project_submission','Eligible project submission',10,10,90),
 ('project_demo','Project demonstration bonus',5,10,100),
 ('sprint_session','Sprint / jam session attendance',3,40,110),
 ('sprint_milestone','Predefined sprint / jam milestone',5,20,120),
 ('sprint_final_deliverable','Final sprint / jam deliverable',10,10,130),
 ('sprint_demo','Final sprint / jam demo bonus',5,10,140)
on conflict (activity_type) do update set label=excluded.label, points=excluded.points, max_per_period=excluded.max_per_period, sort_order=excluded.sort_order, enabled=true;

update public.point_rules set enabled=false where activity_type in ('event_attendance','assigned_event_work','sprint_progress');

-- Starter social links use the destinations that existed in the provided site files; verify them before launch.
insert into public.site_settings(key,value) values
 ('social_links', '[{"key":"gdg","label":"Google Developer Group SR University","url":"https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/","enabled":true,"sort_order":1},{"key":"linkedin","label":"LinkedIn","url":"https://www.linkedin.com/company/gdg-sru/home/","enabled":true,"sort_order":2},{"key":"discord","label":"Discord","url":"https://discord.gg/htSJMNcdZs","enabled":true,"sort_order":3},{"key":"instagram","label":"Instagram","url":"https://www.instagram.com/gdg_sru/","enabled":true,"sort_order":4},{"key":"x","label":"X","url":"https://x.com/gdgsru","enabled":true,"sort_order":5},{"key":"github","label":"GitHub","url":"https://github.com/gdgsru","enabled":true,"sort_order":6}]'::jsonb),
 ('contact_email','"gdg@sru.edu.in"'::jsonb),
 ('secondary_contact_email','"gdgoncamps.sru@gmail.com"'::jsonb),
 ('community_intro','"Build, learn, and connect with the GDG SRU student developer community."'::jsonb)
on conflict(key) do nothing;

-- Admin account setup (manual, no public sign-up):
-- 1. Disable public sign-ups in Supabase Authentication settings.
-- 2. Create/invite your one admin user from Supabase Dashboard > Authentication > Users.
-- 3. Insert that exact auth user id and email here:
-- insert into public.admin_users(user_id,email) values ('AUTH-USER-UUID','admin@example.edu');

-- IMPORTANT: Supabase Edge Function secrets (never expose to the browser) should be used for certificate email verification.
-- The final certificate claim/email code workflow is deployed separately in supabase/functions and needs provider credentials.
