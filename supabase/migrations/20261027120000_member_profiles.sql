-- Member profiles: public handle -> private identity mapping + one small public RPC.
-- Run once in the Supabase SQL Editor. Idempotent.
--
-- Why an RPC and not a view: the RPC only answers "stats for THIS handle" and can't be
-- listed or scanned like a view. Email hashes and roll numbers never leave the database.

create table if not exists public.member_profiles (
  handle     text primary key check (handle ~ '^[a-z0-9_-]{2,32}$'),
  email_hash text not null,
  roll_norm  text,
  updated_at timestamptz not null default now()
);
create unique index if not exists member_profiles_email_hash_key on public.member_profiles (email_hash);
create index if not exists member_profiles_roll_idx on public.member_profiles (roll_norm);

-- RLS on with NO policies = anon/authenticated cannot read or write. The seed file
-- (build/members_seed.sql) is pasted into the SQL Editor, which bypasses RLS.
alter table public.member_profiles enable row level security;
revoke all on table public.member_profiles from anon, authenticated;

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
    else jsonb_build_object(
      'found', true,
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

notify pgrst, 'reload schema';
