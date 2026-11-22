-- Public, read-only access to the basketball dataset and shared default lineup.
-- Run in Supabase SQL Editor after migrations 001, 002, 004, and 005.
-- No insert/update/delete policies are added. Personal lineup saves stay local.
begin;

grant usage on schema public to anon, authenticated;
grant select on public.players, public.roster_memberships,
  public.player_season_advanced_stats, public.lineups, public.lineup_players
  to anon, authenticated;

drop policy if exists heat_roster_read on public.roster_memberships;
create policy heat_roster_read on public.roster_memberships for select
to anon, authenticated using (team_id = 1610612748 and season_start_year = 2026);

drop policy if exists heat_players_read on public.players;
create policy heat_players_read on public.players for select to anon, authenticated
using (exists (select 1 from public.roster_memberships r
  where r.player_id = players.id and r.team_id = 1610612748 and r.season_start_year = 2026));

drop policy if exists heat_advanced_read on public.player_season_advanced_stats;
create policy heat_advanced_read on public.player_season_advanced_stats for select
to anon, authenticated using (season_start_year = 2025 and season_type = 'regular'
  and source_provider = 'basketball_reference'
  and exists (select 1 from public.roster_memberships r
    where r.player_id = player_season_advanced_stats.player_id
    and r.team_id = 1610612748 and r.season_start_year = 2026));

drop policy if exists heat_default_read on public.lineups;
create policy heat_default_read on public.lineups for select to anon, authenticated
using (team_id = 1610612748 and roster_season_start_year = 2026
  and baseline_season_start_year = 2025 and is_default);

drop policy if exists heat_default_members_read on public.lineup_players;
create policy heat_default_members_read on public.lineup_players for select
to anon, authenticated using (exists (select 1 from public.lineups l
  where l.id = lineup_players.lineup_id and l.team_id = 1610612748
  and l.roster_season_start_year = 2026 and l.baseline_season_start_year = 2025
  and l.is_default));

alter view public.heat_player_advanced_baseline set (security_invoker = true);
grant select on public.heat_player_advanced_baseline to anon, authenticated;

create or replace view public.heat_default_lineup
with (security_invoker = true) as
select l.id as lineup_id, l.name, lp.court_slot, lp.player_id as nba_player_id
from public.lineups l
join public.lineup_players lp on lp.lineup_id = l.id
where l.team_id = 1610612748 and l.roster_season_start_year = 2026
  and l.baseline_season_start_year = 2025 and l.is_default;
grant select on public.heat_default_lineup to anon, authenticated;
notify pgrst, 'reload schema';
commit;

-- Check the actual anonymous role, not just the SQL Editor's admin access.
begin;
set local role anon;
select nba_player_id, full_name, data_status
from public.heat_player_advanced_baseline order by full_name;
select * from public.heat_default_lineup order by court_slot;
rollback;
