-- Run after the initial schema, players, and advanced-stats import.
-- User-selected default: Mitchell / Thompson / Wiggins / Antetokounmpo / Adebayo.
-- Re-running preserves the same lineup without duplicating it.
begin;

do $$
declare
  starting_lineup_id uuid;
  baseline_year integer;
  existing_player bigint;
  court_position integer;
  desired_players bigint[] := array[1630558, 202691, 203952, 203507, 1628389];
begin
  select id, baseline_season_start_year
    into starting_lineup_id, baseline_year
  from public.lineups
  where team_id = 1610612748 and roster_season_start_year = 2026 and is_default
  for update;

  if starting_lineup_id is null then
    insert into public.lineups (
      name, team_id, roster_season_start_year, baseline_season_start_year, is_default
    ) values ('Heat starting five', 1610612748, 2026, 2025, true)
    returning id into starting_lineup_id;
  elsif baseline_year <> 2025 then
    raise exception 'Existing default uses a different stats season; no changes made.';
  end if;

  for court_position in 1..5 loop
    select player_id into existing_player
    from public.lineup_players
    where lineup_id = starting_lineup_id and court_slot = court_position;

    if existing_player is not null and existing_player <> desired_players[court_position] then
      raise exception 'Existing default differs at slot %. No changes made.', court_position;
    end if;

    insert into public.lineup_players (
      lineup_id, team_id, roster_season_start_year, court_slot, player_id
    ) values (
      starting_lineup_id, 1610612748, 2026, court_position, desired_players[court_position]
    ) on conflict (lineup_id, court_slot) do nothing;
  end loop;
end $$;

commit;

-- Expected: five rows in court order, with each player's observed advanced stats.
-- These are individual historical profiles, not projected collective results.
select lp.court_slot,
       case lp.court_slot when 1 then 'PG' when 2 then 'SG' when 3 then 'SF'
                          when 4 then 'PF' when 5 then 'C' end as court_position,
       l.name as lineup_name,
       a.*
from public.lineups l
join public.lineup_players lp on lp.lineup_id = l.id
join public.heat_player_advanced_baseline a on a.nba_player_id = lp.player_id
where l.team_id = 1610612748 and l.roster_season_start_year = 2026 and l.is_default
order by lp.court_slot;
