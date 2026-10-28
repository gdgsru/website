-- Member profiles: admin controls for Mission Control. Run AFTER 20261027120000_member_profiles.sql. Idempotent.
--
-- Adds:
--   * member_profiles.hidden           instant takedown switch (no rebuild needed)
--   * get_member_stats()               now hidden-aware: a hidden member returns NO points or certificates
--   * admin_member_overview()          one call that feeds the Member profiles tab
--   * admin_set_member_hidden()        hide / unhide a pass
--   * admin_delete_member_profile()    remove a member's live-stats mapping
-- The table itself stays locked (RLS on, no policies, no grants). Every admin function checks
-- public.is_admin() inside, the same pattern as the rest of Mission Control.

alter table public.member_profiles
  add column if not exists hidden boolean not null default false;

-- ---------------------------------------------------------------------------------------------
-- Public: stats for one handle. Hidden members get { found: true, hidden: true } and nothing else.
-- ---------------------------------------------------------------------------------------------
create or replace function public.get_member_stats(p_handle text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with m as (
    select * from public.member_profiles
    where handle = lower(btrim(coalesce(p_handle, '')))
  ),
  pts as (
    select coalesce(sum(cp.points), 0)::int as total, count(cp.id)::int as activities
    from m
    left join public.community_points cp
      on cp.email_hash = m.email_hash and cp.verified = true
  ),
  ws as (
    select e.title, e.start_at,
           private.credential_for_key(
             a.event_id,
             private.attendee_key(a.roll_no, a.attendee_email, a.attendee_name)
           ) as credential_id
    from m
    join public.attendance_records a
      on a.attendance_status = 'attended'
     and ( (m.roll_norm is not null and private.norm_roll(a.roll_no) = m.roll_norm)
        or encode(extensions.digest(lower(btrim(coalesce(a.attendee_email, ''))), 'sha256'), 'hex') = m.email_hash )
    join public.events e on e.id = a.event_id and e.status in ('published', 'archived')
    join public.certificate_configs c on c.event_id = e.id and c.enabled = true
  )
  select case
    when not exists (select 1 from m) then jsonb_build_object('found', false)
    when exists (select 1 from m where m.hidden) then jsonb_build_object('found', true, 'hidden', true)
    else jsonb_build_object(
      'found', true,
      'hidden', false,
      'points', (select total from pts),
      'activities', (select activities from pts),
      'workshops', coalesce(
        (select jsonb_agg(jsonb_build_object(
                  'title', ws.title,
                  'date', ws.start_at,
                  'credential_id', ws.credential_id
                ) order by ws.start_at desc nulls last) from ws),
        '[]'::jsonb)
    )
  end;
$$;

revoke all on function public.get_member_stats(text) from public;
grant execute on function public.get_member_stats(text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Admin: overview of every mapped member (points, activities, workshop count, hidden flag).
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_member_overview()
returns table (
  handle     text,
  hidden     boolean,
  points     integer,
  activities integer,
  workshops  integer,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
  select m.handle,
         m.hidden,
         coalesce((select sum(cp.points) from public.community_points cp
                    where cp.email_hash = m.email_hash and cp.verified = true), 0)::integer,
         (select count(*) from public.community_points cp
           where cp.email_hash = m.email_hash and cp.verified = true)::integer,
         (select count(distinct a.event_id)
            from public.attendance_records a
            join public.events e on e.id = a.event_id and e.status in ('published', 'archived')
            join public.certificate_configs c on c.event_id = e.id and c.enabled = true
           where a.attendance_status = 'attended'
             and ( (m.roll_norm is not null and private.norm_roll(a.roll_no) = m.roll_norm)
                or encode(extensions.digest(lower(btrim(coalesce(a.attendee_email, ''))), 'sha256'), 'hex') = m.email_hash )
         )::integer,
         m.updated_at
  from public.member_profiles m
  order by m.handle;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Admin: hide / unhide a pass.
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_set_member_hidden(p_handle text, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  update public.member_profiles
     set hidden = coalesce(p_hidden, false), updated_at = now()
   where handle = lower(btrim(coalesce(p_handle, '')));
  if not found then raise exception 'No member with that handle'; end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Admin: remove a member's live-stats mapping (their static pass is unaffected until the next build).
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_delete_member_profile(p_handle text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  delete from public.member_profiles where handle = lower(btrim(coalesce(p_handle, '')));
  if not found then raise exception 'No member with that handle'; end if;
end;
$$;

revoke all on function public.admin_member_overview() from public, anon;
revoke all on function public.admin_set_member_hidden(text, boolean) from public, anon;
revoke all on function public.admin_delete_member_profile(text) from public, anon;
grant execute on function public.admin_member_overview() to authenticated;
grant execute on function public.admin_set_member_hidden(text, boolean) to authenticated;
grant execute on function public.admin_delete_member_profile(text) to authenticated;

notify pgrst, 'reload schema';
