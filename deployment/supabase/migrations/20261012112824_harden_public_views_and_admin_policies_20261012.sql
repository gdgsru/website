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
 select id,title,slug,category,summary,description,image_url,start_at,end_at,timezone,venue,online_url,registration_url,featured,pinned_next_session from public.events where status='published';
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
