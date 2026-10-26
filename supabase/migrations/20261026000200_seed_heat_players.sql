-- Run AFTER 20261026000100_initial_schema.sql in Supabase SQL Editor.
-- Roster checked against https://www.nba.com/heat/roster on October 25, 2026.
-- IDs checked against NBA player profile URLs: https://www.nba.com/player/{id}.
-- Includes the two-way players listed on the official roster.
-- Re-running updates names and skips existing memberships; it does not delete data.
begin;

with roster (id, full_name) as (
  values
    (1628389::bigint, 'Bam Adebayo'),
    (203507, 'Giannis Antetokounmpo'),
    (1643553, 'Ryan Conwell'),
    (1643621, 'Tre Donaldson'),
    (1631323, 'Simone Fontecchio'),
    (1642066, 'Myron Gardner'),
    (1642884, 'Vladislav Goldin'),
    (203501, 'Tim Hardaway Jr.'),
    (1642352, 'Keshad Johnson'),
    (1631107, 'Nikola Jović'),
    (1641796, 'Pelle Larsson'),
    (1630558, 'Davion Mitchell'),
    (1626171, 'Bobby Portis Jr.'),
    (1630208, 'Nick Richards'),
    (1630696, 'Dru Smith'),
    (202691, 'Klay Thompson'),
    (203952, 'Andrew Wiggins')
), saved_players as (
  insert into public.players (id, full_name)
  select id, full_name from roster
  on conflict (id) do update set full_name = excluded.full_name
  returning id
)
insert into public.roster_memberships (
  team_id, season_start_year, player_id, source_url
)
select 1610612748, 2026, id, 'https://www.nba.com/heat/roster'
from saved_players
on conflict (team_id, season_start_year, player_id) do nothing;

commit;

-- Expected in a fresh project: 17 named players, each linked to MIA / 2026–27.
select p.id, p.full_name, t.abbreviation, s.label as roster_season
from public.roster_memberships r
join public.players p on p.id = r.player_id
join public.teams t on t.id = r.team_id
join public.seasons s on s.start_year = r.season_start_year
where r.team_id = 1610612748 and r.season_start_year = 2026
order by p.full_name;
