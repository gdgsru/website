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
