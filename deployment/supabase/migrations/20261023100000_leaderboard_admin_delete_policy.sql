-- Allow authenticated admins to delete mistakenly entered community points entries.
-- The existing trigger refresh_main_leaderboard_after_points automatically recalculates leaderboard totals.
drop policy if exists community_points_admin_delete on public.community_points;
create policy community_points_admin_delete on public.community_points for delete to authenticated using (private.is_admin());
