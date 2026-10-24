-- Prize wheel: live state, winner pick on Stop, winners removed after they win.
-- Runs after 20261025120000_easter_egg_hunt.sql.

begin;

-- 1. Winners are removed from the draw --------------------------------------
alter table public.easter_egg_participants
  add column if not exists has_won boolean not null default false;

-- Public view of numbers still in the draw (no names, no points).
create or replace view public.easter_egg_wheel_numbers as
  select wheel_number
  from public.easter_egg_participants
  where wheel_entrant and wheel_number is not null and not has_won
  order by wheel_number;

grant select on public.easter_egg_wheel_numbers to anon, authenticated;

-- 2. Wheel state (one row) ---------------------------------------------------
create table if not exists public.easter_egg_wheel_state (
  id                 smallint primary key default 1 check (id = 1),
  status             text not null default 'idle'
                     check (status in ('idle', 'rolling', 'stopped')),
  started_at         timestamptz,
  winner_number      integer,
  winner_prize_id    uuid references public.easter_egg_prizes (id) on delete set null,
  winner_prize_title text,
  updated_at         timestamptz not null default now()
);

insert into public.easter_egg_wheel_state (id) values (1)
  on conflict (id) do nothing;

alter table public.easter_egg_wheel_state enable row level security;

drop policy if exists eews_public_read on public.easter_egg_wheel_state;
create policy eews_public_read on public.easter_egg_wheel_state
  for select to anon, authenticated using (true);

drop policy if exists eews_admin on public.easter_egg_wheel_state;
create policy eews_admin on public.easter_egg_wheel_state
  for all to authenticated
  using (public.is_org_admin()) with check (public.is_org_admin());

-- 3. Winner pick: runs on the server when the admin presses Stop -------------
create or replace function public.easter_egg_wheel_stop()
returns table (winner_number integer, prize_title text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number integer;
  v_prize  public.easter_egg_prizes%rowtype;
begin
  if not public.is_org_admin() then
    raise exception 'Only admins can stop the wheel';
  end if;

  if not exists (select 1 from public.easter_egg_wheel_state where id = 1 and status = 'rolling') then
    raise exception 'The wheel is not spinning';
  end if;

  select * into v_prize
  from public.easter_egg_prizes
  where status = 'available'
  order by position, created_at
  limit 1;
  if not found then
    raise exception 'No prizes left';
  end if;

  -- Random entrant who has not won yet. Number and prize are picked together.
  select p.wheel_number into v_number
  from public.easter_egg_participants p
  where p.wheel_entrant and p.wheel_number is not null and not p.has_won
  order by random()
  limit 1;
  if v_number is null then
    raise exception 'No entrants left in the draw';
  end if;

  update public.easter_egg_participants
     set has_won = true, updated_at = now()
   where wheel_number = v_number;

  update public.easter_egg_prizes
     set status = 'won', won_by_number = v_number, won_at = now()
   where id = v_prize.id;

  update public.easter_egg_wheel_state
     set status = 'stopped',
         winner_number = v_number,
         winner_prize_id = v_prize.id,
         winner_prize_title = v_prize.title,
         updated_at = now()
   where id = 1;

  return query select v_number, v_prize.title;
end;
$$;

revoke execute on function public.easter_egg_wheel_stop() from public, anon;
grant execute on function public.easter_egg_wheel_stop() to authenticated;

-- 4. Live updates for the projector and phones --------------------------------
do $$
begin
  alter publication supabase_realtime add table public.easter_egg_wheel_state;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

commit;
