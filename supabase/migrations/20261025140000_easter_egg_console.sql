-- Launch-day console support: undo a winner who is not in the room, and reset the wheel.
-- Runs after 20261025130000_easter_egg_wheel.sql. Safe to run more than once.

begin;

-- Put the last winner back in the draw, free the prize, and set the wheel to idle.
create or replace function public.easter_egg_wheel_redraw()
returns table (released_number integer, released_prize text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state public.easter_egg_wheel_state%rowtype;
begin
  if not public.is_org_admin() then
    raise exception 'Only admins can redraw';
  end if;

  select * into v_state from public.easter_egg_wheel_state where id = 1 for update;
  if not found or v_state.status <> 'stopped' or v_state.winner_number is null then
    raise exception 'There is no winner to release';
  end if;

  update public.easter_egg_participants
     set has_won = false, updated_at = now()
   where wheel_number = v_state.winner_number;

  if v_state.winner_prize_id is not null then
    update public.easter_egg_prizes
       set status = 'available', won_by_number = null, won_at = null
     where id = v_state.winner_prize_id;
  end if;

  update public.easter_egg_wheel_state
     set status = 'idle', started_at = null, winner_number = null,
         winner_prize_id = null, winner_prize_title = null, updated_at = now()
   where id = 1;

  return query select v_state.winner_number, v_state.winner_prize_title;
end;
$$;

revoke execute on function public.easter_egg_wheel_redraw() from public, anon;
grant execute on function public.easter_egg_wheel_redraw() to authenticated;

-- Back to idle without touching winners (also cancels a spin that is still rolling).
create or replace function public.easter_egg_wheel_reset()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_admin() then
    raise exception 'Only admins can reset the wheel';
  end if;
  update public.easter_egg_wheel_state
     set status = 'idle', started_at = null, winner_number = null,
         winner_prize_id = null, winner_prize_title = null, updated_at = now()
   where id = 1;
end;
$$;

revoke execute on function public.easter_egg_wheel_reset() from public, anon;
grant execute on function public.easter_egg_wheel_reset() to authenticated;

commit;
