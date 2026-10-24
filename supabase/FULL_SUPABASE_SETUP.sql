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
  speaker text,
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
  select id, title, slug, category, summary, description, image_url, start_at, end_at, timezone, venue, speaker, online_url, registration_url, featured, pinned_next_session
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

drop function if exists public.verify_certificate(text);
create function public.verify_certificate(p_code text)
returns table(recipient_name text, event_title text, status text)
language sql stable security definer set search_path = public as $$
  select c.recipient_name,c.event_title,
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
values ('site-assets','site-assets',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=true, file_size_limit=5242880, allowed_mime_types=array['image/png','image/jpeg','image/webp'];
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

-- Security hardening and public-only leaderboard projection.
-- Harden public data access and make security boundaries explicit.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admin_users a where a.user_id = auth.uid()) $$;
revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

drop policy if exists settings_admin_read on public.site_settings;
drop policy if exists settings_admin_write on public.site_settings;
create policy settings_admin_read on public.site_settings for select to authenticated using (private.is_admin());
create policy settings_admin_write on public.site_settings for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists events_admin_read on public.events;
drop policy if exists events_admin_write on public.events;
create policy events_admin_read on public.events for select to authenticated using (private.is_admin());
create policy events_admin_write on public.events for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists team_admin_read on public.team_members;
drop policy if exists team_admin_write on public.team_members;
create policy team_admin_read on public.team_members for select to authenticated using (private.is_admin());
create policy team_admin_write on public.team_members for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists blog_admin_read on public.blog_entries;
drop policy if exists blog_admin_write on public.blog_entries;
create policy blog_admin_read on public.blog_entries for select to authenticated using (private.is_admin());
create policy blog_admin_write on public.blog_entries for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists resources_admin_read on public.resources;
drop policy if exists resources_admin_write on public.resources;
create policy resources_admin_read on public.resources for select to authenticated using (private.is_admin());
create policy resources_admin_write on public.resources for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists attendance_admin_all on public.attendance_records;
create policy attendance_admin_all on public.attendance_records for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists templates_admin_all on public.certificate_templates;
create policy templates_admin_all on public.certificate_templates for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists certificates_admin_read on public.certificates;
drop policy if exists certificates_admin_update on public.certificates;
create policy certificates_admin_read on public.certificates for select to authenticated using (private.is_admin());
create policy certificates_admin_update on public.certificates for update to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists periods_admin_read on public.leaderboard_periods;
drop policy if exists periods_admin_write on public.leaderboard_periods;
create policy periods_admin_read on public.leaderboard_periods for select to authenticated using (private.is_admin());
create policy periods_admin_write on public.leaderboard_periods for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists point_rules_admin_all on public.point_rules;
create policy point_rules_admin_all on public.point_rules for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists community_points_admin_all on public.community_points;
create policy community_points_admin_all on public.community_points for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists sponsored_admin_read on public.sponsored_leaderboards;
drop policy if exists sponsored_admin_write on public.sponsored_leaderboards;
create policy sponsored_admin_read on public.sponsored_leaderboards for select to authenticated using (private.is_admin());
create policy sponsored_admin_write on public.sponsored_leaderboards for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists sponsored_entries_admin_read on public.sponsored_leaderboard_entries;
drop policy if exists sponsored_entries_admin_write on public.sponsored_leaderboard_entries;
create policy sponsored_entries_admin_read on public.sponsored_leaderboard_entries for select to authenticated using (private.is_admin());
create policy sponsored_entries_admin_write on public.sponsored_leaderboard_entries for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists audit_admin_read on public.audit_logs;
drop policy if exists audit_admin_insert on public.audit_logs;
create policy audit_admin_read on public.audit_logs for select to authenticated using (private.is_admin());
create policy audit_admin_insert on public.audit_logs for insert to authenticated with check (private.is_admin());
drop policy if exists site_assets_admin_insert on storage.objects;
drop policy if exists site_assets_admin_update on storage.objects;
drop policy if exists site_assets_admin_delete on storage.objects;
create policy site_assets_admin_insert on storage.objects for insert to authenticated with check (bucket_id='site-assets' and private.is_admin());
create policy site_assets_admin_update on storage.objects for update to authenticated using (bucket_id='site-assets' and private.is_admin()) with check (bucket_id='site-assets' and private.is_admin());
create policy site_assets_admin_delete on storage.objects for delete to authenticated using (bucket_id='site-assets' and private.is_admin());
drop policy if exists resource_files_admin_insert on storage.objects;
drop policy if exists resource_files_admin_update on storage.objects;
drop policy if exists resource_files_admin_delete on storage.objects;
create policy resource_files_admin_insert on storage.objects for insert to authenticated with check (bucket_id='resource-files' and private.is_admin());
create policy resource_files_admin_update on storage.objects for update to authenticated using (bucket_id='resource-files' and private.is_admin()) with check (bucket_id='resource-files' and private.is_admin());
create policy resource_files_admin_delete on storage.objects for delete to authenticated using (bucket_id='resource-files' and private.is_admin());

create or replace view public.public_event_list with (security_invoker = true) as
 select id,title,slug,category,summary,description,image_url,start_at,end_at,timezone,venue,speaker,online_url,registration_url,featured,pinned_next_session from public.events where status='published';
create or replace view public.public_team_list with (security_invoker = true) as
 select id,name,role,department,leadership_order,bio,photo_url,social_links,sort_order from public.team_members where status='published';
create or replace view public.public_blog_list with (security_invoker = true) as
 select id,title,author,description,image_url,category,external_url,featured,sort_order,created_at from public.blog_entries where status='published';
create or replace view public.public_resource_list with (security_invoker = true) as
 select id,kind,title,description,category,resource_type,image_url,destination_url,access_type,limitations,eligibility,event_id,featured,sort_order,created_at from public.resources where status='published';
create or replace view public.public_sponsored_leaderboards with (security_invoker = true) as
 select lb.id as leaderboard_id,lb.title,lb.program_name,lb.period_label,e.student_name,e.points,
 dense_rank() over(partition by lb.id order by e.points desc,e.student_name asc) as rank,
 lb.sort_order as leaderboard_sort_order,e.sort_order as entry_sort_order
 from public.sponsored_leaderboards lb join public.sponsored_leaderboard_entries e on e.leaderboard_id=lb.id where lb.enabled=true and lb.published=true;
create or replace view public.public_site_settings with (security_invoker = true) as
 select key,value from public.site_settings where key in ('social_links','contact_email','secondary_contact_email','community_intro','homepage_copy','brand_logo_url');
create or replace view public.public_point_rules with (security_invoker = true) as
 select activity_type,label,points,sort_order from public.point_rules where enabled=true;

create table if not exists public.public_main_leaderboard_cache (
 id uuid primary key default gen_random_uuid(), period_id uuid not null, period_title text not null,
 student_name text not null, points integer not null check(points>=0), refreshed_at timestamptz not null default now()
);
alter table public.public_main_leaderboard_cache enable row level security;
drop policy if exists public_main_leaderboard_cache_read on public.public_main_leaderboard_cache;
create policy public_main_leaderboard_cache_read on public.public_main_leaderboard_cache for select to anon,authenticated using(true);
revoke all on table public.public_main_leaderboard_cache from anon,authenticated;
grant select on table public.public_main_leaderboard_cache to anon,authenticated;
create or replace function private.refresh_public_main_leaderboard_cache()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 delete from public.public_main_leaderboard_cache;
 insert into public.public_main_leaderboard_cache(period_id,period_title,student_name,points,refreshed_at)
 select p.id,p.title,min(cp.student_name),sum(cp.points)::integer,now()
 from public.leaderboard_periods p join public.community_points cp on cp.period_id=p.id
 where p.enabled=true and p.published=true group by p.id,p.title,cp.email_hash;
 return null;
end $$;
revoke all on function private.refresh_public_main_leaderboard_cache() from public,anon,authenticated;
drop trigger if exists refresh_main_leaderboard_after_points on public.community_points;
create trigger refresh_main_leaderboard_after_points after insert or update or delete on public.community_points for each statement execute function private.refresh_public_main_leaderboard_cache();
drop trigger if exists refresh_main_leaderboard_after_periods on public.leaderboard_periods;
create trigger refresh_main_leaderboard_after_periods after insert or update or delete on public.leaderboard_periods for each statement execute function private.refresh_public_main_leaderboard_cache();
create or replace view public.public_main_leaderboard with (security_invoker = true) as
 select period_id,period_title,student_name,points,dense_rank() over(partition by period_id order by points desc) as rank from public.public_main_leaderboard_cache;
grant select on public.public_event_list,public.public_team_list,public.public_blog_list,public.public_resource_list,public.public_main_leaderboard,public.public_sponsored_leaderboards,public.public_site_settings,public.public_point_rules to anon,authenticated;
grant select on public.events,public.team_members,public.blog_entries,public.resources,public.site_settings,public.leaderboard_periods,public.point_rules,public.sponsored_leaderboards,public.sponsored_leaderboard_entries to anon,authenticated;
drop policy if exists point_rules_public_read on public.point_rules;
create policy point_rules_public_read on public.point_rules for select to anon,authenticated using(enabled=true);
create policy claim_challenges_deny_browser on public.certificate_claim_challenges for all to anon,authenticated using(false) with check(false);
create policy download_tokens_deny_browser on public.certificate_download_tokens for all to anon,authenticated using(false) with check(false);
drop policy if exists admin_users_self_read on public.admin_users;
create policy admin_users_self_read on public.admin_users for select to authenticated using(user_id=(select auth.uid()));
create index if not exists attendance_records_created_by_idx on public.attendance_records(created_by);
create index if not exists certificate_download_tokens_certificate_id_idx on public.certificate_download_tokens(certificate_id);
create index if not exists certificates_event_id_idx on public.certificates(event_id);
create index if not exists certificates_template_id_idx on public.certificates(template_id);
create index if not exists community_points_activity_type_idx on public.community_points(activity_type);
create index if not exists community_points_recorded_by_idx on public.community_points(recorded_by);
create index if not exists resources_event_id_idx on public.resources(event_id);
create index if not exists site_settings_updated_by_idx on public.site_settings(updated_by);
create index if not exists sponsored_leaderboard_entries_leaderboard_id_idx on public.sponsored_leaderboard_entries(leaderboard_id);

create or replace function public.record_community_activity(
 p_period_id uuid,p_student_name text,p_student_email text,p_activity_type text,p_source_ref text,p_note text default ''
) returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare r public.point_rules%rowtype; v_hash text; v_id uuid; v_count integer;
begin
 if not private.is_admin() then raise exception 'Admin access required'; end if;
 if nullif(trim(p_student_name),'') is null or nullif(trim(p_student_email),'') is null then raise exception 'Student name and email are required'; end if;
 if nullif(trim(p_source_ref),'') is null then raise exception 'A source/reference is required to prevent duplicate credit'; end if;
 if not exists(select 1 from public.leaderboard_periods where id=p_period_id and enabled=true) then raise exception 'This leaderboard period is not active for scoring'; end if;
 select * into r from public.point_rules where activity_type=p_activity_type and enabled=true;
 if not found then raise exception 'This activity type is not enabled'; end if;
 select count(*) into v_count from public.community_points where period_id=p_period_id and email_hash=encode(extensions.digest(lower(trim(p_student_email)),'sha256'),'hex') and activity_type=p_activity_type;
 if v_count>=r.max_per_period then raise exception 'This student has reached the point limit for this activity in the selected period'; end if;
 v_hash:=encode(extensions.digest(lower(trim(p_student_email)),'sha256'),'hex');
 insert into public.community_points(period_id,student_name,email_hash,activity_type,source_ref,points,note,recorded_by)
 values(p_period_id,trim(p_student_name),v_hash,p_activity_type,trim(p_source_ref),r.points,coalesce(p_note,''),auth.uid()) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.record_community_activity(uuid,text,text,text,text,text) from public,anon;
grant execute on function public.record_community_activity(uuid,text,text,text,text,text) to authenticated;
create or replace function public.issue_certificate_for_attendance(p_attendance_id uuid,p_template_id uuid)
returns text language plpgsql security definer set search_path=public,extensions as $$
declare a public.attendance_records%rowtype; e public.events%rowtype; t public.certificate_templates%rowtype; c text;
begin
 if not private.is_admin() then raise exception 'Admin access required'; end if;
 select * into a from public.attendance_records where id=p_attendance_id and attendance_status='attended';
 if not found then raise exception 'No eligible attendance record was found'; end if;
 select * into e from public.events where id=a.event_id;
 select * into t from public.certificate_templates where id=p_template_id;
 if not found then raise exception 'Certificate template not found'; end if;
 if exists(select 1 from public.certificates where attendance_id=a.id) then raise exception 'A certificate has already been issued for this attendance record'; end if;
 c:='GDGSRU-'||to_char(current_date,'YY')||'-'||upper(encode(extensions.gen_random_bytes(8),'hex'));
 insert into public.certificates(certificate_code,attendance_id,event_id,template_id,template_html,recipient_name,event_title,email_hash)
 values(c,a.id,a.event_id,t.id,t.html_template,a.attendee_name,e.title,encode(extensions.digest(lower(trim(a.attendee_email)),'sha256'),'hex'));
 return c;
end $$;
revoke all on function public.issue_certificate_for_attendance(uuid,uuid) from public,anon;
grant execute on function public.issue_certificate_for_attendance(uuid,uuid) to authenticated;
drop function if exists public.is_admin();

-- Avoid redundant SELECT policy checks while preserving published public reads.
drop policy if exists settings_admin_write on public.site_settings;
create policy settings_admin_insert on public.site_settings for insert to authenticated with check (private.is_admin());
create policy settings_admin_update on public.site_settings for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy settings_admin_delete on public.site_settings for delete to authenticated using (private.is_admin());
drop policy if exists events_admin_write on public.events;
create policy events_admin_insert on public.events for insert to authenticated with check (private.is_admin());
create policy events_admin_update on public.events for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy events_admin_delete on public.events for delete to authenticated using (private.is_admin());
drop policy if exists team_admin_write on public.team_members;
create policy team_admin_insert on public.team_members for insert to authenticated with check (private.is_admin());
create policy team_admin_update on public.team_members for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy team_admin_delete on public.team_members for delete to authenticated using (private.is_admin());
drop policy if exists blog_admin_write on public.blog_entries;
create policy blog_admin_insert on public.blog_entries for insert to authenticated with check (private.is_admin());
create policy blog_admin_update on public.blog_entries for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy blog_admin_delete on public.blog_entries for delete to authenticated using (private.is_admin());
drop policy if exists resources_admin_write on public.resources;
create policy resources_admin_insert on public.resources for insert to authenticated with check (private.is_admin());
create policy resources_admin_update on public.resources for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy resources_admin_delete on public.resources for delete to authenticated using (private.is_admin());
drop policy if exists periods_admin_write on public.leaderboard_periods;
create policy periods_admin_insert on public.leaderboard_periods for insert to authenticated with check (private.is_admin());
create policy periods_admin_update on public.leaderboard_periods for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy periods_admin_delete on public.leaderboard_periods for delete to authenticated using (private.is_admin());
drop policy if exists sponsored_admin_write on public.sponsored_leaderboards;
create policy sponsored_admin_insert on public.sponsored_leaderboards for insert to authenticated with check (private.is_admin());
create policy sponsored_admin_update on public.sponsored_leaderboards for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy sponsored_admin_delete on public.sponsored_leaderboards for delete to authenticated using (private.is_admin());
drop policy if exists sponsored_entries_admin_write on public.sponsored_leaderboard_entries;
create policy sponsored_entries_admin_insert on public.sponsored_leaderboard_entries for insert to authenticated with check (private.is_admin());
create policy sponsored_entries_admin_update on public.sponsored_leaderboard_entries for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy sponsored_entries_admin_delete on public.sponsored_leaderboard_entries for delete to authenticated using (private.is_admin());
drop policy if exists point_rules_admin_all on public.point_rules;
create policy point_rules_admin_read on public.point_rules for select to authenticated using (private.is_admin());
create policy point_rules_admin_update on public.point_rules for update to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists community_points_admin_all on public.community_points;
create policy community_points_admin_read on public.community_points for select to authenticated using (private.is_admin());
drop policy if exists community_points_admin_delete on public.community_points;
create policy community_points_admin_delete on public.community_points for delete to authenticated using (private.is_admin());

-- ===== Team cards and departments (same as migrations/20261020100000_team_card_fields_and_departments.sql) =====
-- Team cards become fully admin-managed.
-- Before: member id, level, accent colour, photo framing, back-of-card line and the
-- department blurbs lived in site/assets/js/app.js. After: every card detail is a column
-- Mission Control can edit, and departments + team page copy are rows/settings.
-- Safe to run more than once.

-- 1. Card fields on team_members ------------------------------------------------------
alter table public.team_members
  add column if not exists member_code text not null default '',
  add column if not exists card_subtitle text not null default '',
  add column if not exists level text not null default 'member',
  add column if not exists accent text not null default 'b',
  add column if not exists photo_position text not null default '50% 100%',
  add column if not exists season text not null default '2026';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'team_members_level_check') then
    alter table public.team_members add constraint team_members_level_check
      check (level in ('lead','organizer','member','advisor'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'team_members_accent_check') then
    alter table public.team_members add constraint team_members_accent_check
      check (accent in ('b','r','y','g'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'team_members_photo_position_check') then
    alter table public.team_members add constraint team_members_photo_position_check
      check (photo_position ~ '^[0-9]{1,3}% [0-9]{1,3}%$');
  end if;
end $$;

create unique index if not exists team_members_member_code_key
  on public.team_members (lower(member_code)) where member_code <> '';

-- 2. Departments (section headings, blurbs, order) ------------------------------------
create table if not exists public.team_departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,               -- matches team_members.department
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  heading text not null default '',        -- shown as the section title (falls back to name)
  description text not null default '',    -- sentence under the section title
  blurb text not null default '',          -- short line on the hero map node
  kind text not null default 'department' check (kind in ('leadership','department','advisory')),
  sort_order integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.team_departments enable row level security;

drop policy if exists team_departments_public_read on public.team_departments;
drop policy if exists team_departments_admin_read on public.team_departments;
drop policy if exists team_departments_admin_insert on public.team_departments;
drop policy if exists team_departments_admin_update on public.team_departments;
drop policy if exists team_departments_admin_delete on public.team_departments;
create policy team_departments_public_read on public.team_departments for select to anon, authenticated using (visible = true);
create policy team_departments_admin_read on public.team_departments for select to authenticated using (private.is_admin());
create policy team_departments_admin_insert on public.team_departments for insert to authenticated with check (private.is_admin());
create policy team_departments_admin_update on public.team_departments for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy team_departments_admin_delete on public.team_departments for delete to authenticated using (private.is_admin());

revoke all on table public.team_departments from anon, authenticated;
grant select on table public.team_departments to anon;
grant select, insert, update, delete on table public.team_departments to authenticated;

insert into public.team_departments (name, slug, heading, description, blurb, kind, sort_order) values
  ('Executive','leadership','Chapter leadership','The students shaping what this chapter becomes.','The organizers who set direction.','leadership',0),
  ('Technical Programs','technical-programs','Technical Programs','Builds, cloud, AI and open-source learning.','Builds, cloud, AI and open-source learning','department',10),
  ('Program Operations','program-operations','Program Operations','Events, logistics and volunteer coordination.','Events, logistics and volunteer coordination','department',20),
  ('Outreach & PR','outreach-pr','Outreach & PR','Community, partnerships and communications.','Community, partnerships and communications','department',30),
  ('Research & Publications','research-publications','Research & Publications','Technical research and documentation.','Technical research and documentation','department',40),
  ('Design & Media','design-media','Design & Media','Visual identity and media.','Visual identity and media','department',50),
  ('Advisory Board','advisory','Advisory board','Faculty and student advisors supporting the chapter.','Faculty and student guidance','advisory',90)
on conflict (name) do nothing;

-- 3. Team page copy ---------------------------------------------------------------------
insert into public.site_settings (key, value) values
  ('team_page', '{"eyebrow":"GDG SRU / TEAM 2026—27","title_top":"Meet the","title_accent":"team.","lead":"The people behind the community.","cta_label":"Meet everyone","map_label":"THE TEAM","map_season":"GDG SRU · 2026—27","core_small":"GDG SRU","core_big":"One team."}'::jsonb)
on conflict (key) do nothing;

drop policy if exists settings_public_allowlist_read on public.site_settings;
create policy settings_public_allowlist_read on public.site_settings for select to anon, authenticated
  using (key in ('social_links','contact_email','secondary_contact_email','community_intro','homepage_copy','brand_logo_url','team_page'));

create or replace view public.public_site_settings with (security_invoker = true) as
  select key, value from public.site_settings
  where key in ('social_links','contact_email','secondary_contact_email','community_intro','homepage_copy','brand_logo_url','team_page');

-- 4. Public views (new columns are appended, existing ones keep their order) ------------
create or replace view public.public_team_list with (security_invoker = true) as
  select id, name, role, department, leadership_order, bio, photo_url, social_links, sort_order,
         member_code, card_subtitle, level, accent, photo_position, season
  from public.team_members where status = 'published';

create or replace view public.public_team_departments with (security_invoker = true) as
  select name, slug, heading, description, blurb, kind, sort_order
  from public.team_departments where visible = true;

grant select on public.public_team_list, public.public_team_departments, public.public_site_settings to anon, authenticated;


-- ==============================================================================
-- 5. On-Demand Certificate Engine & Studio Configuration
-- ==============================================================================

create table if not exists public.certificate_configs (
  event_id uuid primary key references public.events(id) on delete cascade,
  template_id uuid references public.certificate_templates(id) on delete set null,
  fields jsonb not null default '{}'::jsonb,
  template_html text not null default '',
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.certificate_configs enable row level security;

drop policy if exists cert_configs_admin_all on public.certificate_configs;
create policy cert_configs_admin_all on public.certificate_configs for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

grant select, insert, update, delete on public.certificate_configs to authenticated;

-- Ensure attendance_records has roll_no, attendee_email, attendee_name, attendance_status
alter table public.attendance_records
  add column if not exists roll_no text,
  add column if not exists attendee_email text,
  add column if not exists attendee_name text,
  add column if not exists attendance_status text not null default 'attended';

create index if not exists attendance_records_event_roll_idx on public.attendance_records(event_id, roll_no);
create index if not exists attendance_records_event_email_idx on public.attendance_records(event_id, attendee_email);
create index if not exists attendance_records_event_name_idx on public.attendance_records(event_id, attendee_name);

-- Private schema for internal rate limiting and normalization
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean language sql stable security definer
set search_path = public, auth
as $$ select exists (select 1 from public.admin_users a where a.user_id = auth.uid()) $$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

create or replace function private.norm_roll(r text)
returns text language sql immutable set search_path = ''
as $$
  select nullif(upper(regexp_replace(btrim(coalesce(r, '')), '[^a-zA-Z0-9]', '', 'g')), '');
$$;

create or replace function private.norm_name(n text)
returns text language sql immutable set search_path = ''
as $$
  select nullif(lower(regexp_replace(btrim(coalesce(n, '')), '\s+', ' ', 'g')), '');
$$;

create or replace function private.attendee_key(p_roll text, p_email text, p_name text default null)
returns text language sql immutable set search_path = ''
as $$
  select case
    when private.norm_roll(p_roll) is not null then 'R:' || private.norm_roll(p_roll)
    when nullif(lower(btrim(coalesce(p_email, ''))), '') is not null then 'E:' || lower(btrim(p_email))
    when nullif(private.norm_name(p_name), '') is not null then 'N:' || private.norm_name(p_name)
  end
$$;

create or replace function private.credential_for_key(p_event_id uuid, p_key text)
returns text language sql immutable set search_path = ''
as $$
  select 'GDGSRU-2026-' || upper(substr(encode(extensions.digest(p_event_id::text || ':' || coalesce(p_key, ''), 'sha256'), 'hex'), 1, 12));
$$;

-- Rate limiting table
create table if not exists private.certificate_claim_rate_limits (
  ip_hash text not null,
  window_start timestamptz not null,
  attempt_count integer not null default 1,
  primary key (ip_hash, window_start)
);

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

-- Canonical list_certificate_events
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

-- Canonical, hardened claim_certificate
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

  select * into c from public.certificate_configs where event_id = p_event_id and enabled = true;
  if not found then return null; end if;

  select count(*) into v_match_count
  from public.attendance_records ar
  where ar.event_id = p_event_id
    and ar.attendance_status = 'attended'
    and private.norm_name(ar.attendee_name) = n
    and (
      (ar.roll_no is not null and v_roll is not null and private.norm_roll(ar.roll_no) = v_roll)
      or (ar.attendee_email is not null and v_email is not null and lower(btrim(ar.attendee_email)) = v_email)
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

-- Canonical verify_certificate
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

-- Permissions
drop function if exists public.claim_certificate(uuid, text);
revoke all on function public.claim_certificate(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_certificate(uuid, text, text) to service_role;
grant execute on function public.list_certificate_events() to anon, authenticated;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- ==============================================================================
-- 6. Blog Series Table & Public Read RLS Policy
-- ==============================================================================

create table if not exists public.blog_series (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  description text not null default '' check (char_length(description) <= 300),
  color text not null default 'b' check (color in ('b', 'g', 'y', 'r')),
  status text not null default 'published' check (status in ('published', 'draft', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.blog_entries add column if not exists series_id uuid references public.blog_series(id) on delete set null;
create index if not exists blog_entries_series_idx on public.blog_entries(series_id);

alter table public.blog_series enable row level security;

drop policy if exists blog_series_public_read on public.blog_series;
create policy blog_series_public_read on public.blog_series for select to anon, authenticated
  using (status = 'published');

drop policy if exists blog_series_admin_write on public.blog_series;
create policy blog_series_admin_write on public.blog_series for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

revoke all on public.blog_series from anon;
grant select on public.blog_series to anon;
grant select, insert, update, delete on public.blog_series to authenticated;
