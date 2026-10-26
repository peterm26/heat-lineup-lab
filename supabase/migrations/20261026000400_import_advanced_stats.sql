-- Run after the initial schema and Heat players import. Safe to re-run.
-- Source: user-supplied advanced CSV, confirmed 2025–26 regular season.
-- Nick Richards uses the combined row, not the sum of advanced rates.
begin;

-- Percentages ending in _pct use 0–100. Ratios retain source decimal units.
create table if not exists public.player_season_advanced_stats (
  player_id bigint not null references public.players(id),
  season_start_year integer not null references public.seasons(start_year),
  season_type text not null check (season_type in ('regular', 'playoffs')),
  source_provider text not null check (source_provider = 'basketball_reference'),
  source_player_id text not null,
  source_team_label text not null,
  position text not null,
  age integer not null check (age > 0),
  games integer not null check (games between 1 and 82),
  games_started integer not null check (games_started between 0 and games),
  minutes integer not null check (minutes >= 0),
  per numeric,
  ts_pct numeric check (ts_pct >= 0),
  three_point_attempt_rate numeric check (three_point_attempt_rate between 0 and 1),
  free_throw_attempt_rate numeric check (free_throw_attempt_rate >= 0),
  orb_pct numeric check (orb_pct between 0 and 100),
  drb_pct numeric check (drb_pct between 0 and 100),
  trb_pct numeric check (trb_pct between 0 and 100),
  ast_pct numeric check (ast_pct between 0 and 100),
  stl_pct numeric check (stl_pct between 0 and 100),
  blk_pct numeric check (blk_pct between 0 and 100),
  tov_pct numeric check (tov_pct between 0 and 100),
  usg_pct numeric check (usg_pct between 0 and 100),
  ows numeric, dws numeric, ws numeric, ws_per_48 numeric,
  obpm numeric, dbpm numeric, bpm numeric, vorp numeric,
  source_url text not null,
  source_file_sha256 text not null check (length(source_file_sha256) = 64),
  imported_at timestamptz not null default now(),
  primary key (player_id, season_start_year, season_type, source_provider),
  unique (source_player_id, season_start_year, season_type, source_provider)
);

alter table public.player_season_advanced_stats enable row level security;

comment on table public.player_season_advanced_stats is
  'Observed individual Basketball Reference metrics. BPM is not raw plus/minus or a lineup projection. Source decimal TS% is converted to 0–100; 3PAr and FTr remain ratios.';

create or replace view public.heat_player_advanced_baseline
with (security_invoker = true) as
select p.id as nba_player_id, p.full_name,
       r.season_start_year as roster_season_start_year,
       2025 as baseline_season_start_year,
       case when a.player_id is null then 'missing_history'
            else 'available' end as data_status,
       a.source_team_label, a.position, a.age, a.games, a.games_started, a.minutes,
       a.per, a.ts_pct, a.three_point_attempt_rate, a.free_throw_attempt_rate,
       a.orb_pct, a.drb_pct, a.trb_pct, a.ast_pct, a.stl_pct, a.blk_pct,
       a.tov_pct, a.usg_pct, a.ows, a.dws, a.ws, a.ws_per_48,
       a.obpm, a.dbpm, a.bpm, a.vorp,
       a.source_provider, a.source_player_id, a.source_url,
       a.source_file_sha256, a.imported_at
from public.roster_memberships r
join public.players p on p.id = r.player_id
left join public.player_season_advanced_stats a
  on a.player_id = p.id and a.season_start_year = 2025
  and a.season_type = 'regular' and a.source_provider = 'basketball_reference'
where r.team_id = 1610612748 and r.season_start_year = 2026;

insert into public.player_season_advanced_stats (player_id, season_start_year, season_type, source_provider, source_player_id, source_team_label, position, age, games, games_started, minutes, per, ts_pct, three_point_attempt_rate, free_throw_attempt_rate, orb_pct, drb_pct, trb_pct, ast_pct, stl_pct, blk_pct, tov_pct, usg_pct, ows, dws, ws, ws_per_48, obpm, dbpm, bpm, vorp, source_url, source_file_sha256) values
  (202691, 2025, 'regular', 'basketball_reference', 'thompkl01', 'DAL', 'SF', 35, 69, 8, 1497, 11.4, 54.100, 0.724, 0.065, 1.3, 8.8, 5.1, 9.5, 1.0, 1.2, 7.8, 22.7, -0.3, 0.9, 0.5, 0.018, 0.2, -1.5, -1.4, 0.2, 'https://www.basketball-reference.com/leagues/NBA_2026_advanced.html', 'd2e05a08e8f971f8efa9a61d2558479ef432d4d83bf470021e8f241eaa4e1f84'),
  (203501, 2025, 'regular', 'basketball_reference', 'hardati02', 'DEN', 'SG', 33, 80, 6, 2127, 13.5, 62.400, 0.706, 0.252, 0.9, 9.5, 5.4, 6.9, 1.0, 0.4, 4.7, 18.5, 3.5, 1.0, 4.4, 0.100, 1.3, -1.9, -0.7, 0.7, 'https://www.basketball-reference.com/leagues/NBA_2026_advanced.html', 'd2e05a08e8f971f8efa9a61d2558479ef432d4d83bf470021e8f241eaa4e1f84'),
  (203507, 2025, 'regular', 'basketball_reference', 'antetgi01', 'MIL', 'PF', 31, 36, 36, 1039, 32.6, 65.800, 0.075, 0.597, 10.7, 27.4, 19.2, 38.7, 1.6, 2.3, 13.2, 37.0, 3.9, 1.1, 5.0, 0.231, 7.7, 1.8, 9.5, 3.0, 'https://www.basketball-reference.com/leagues/NBA_2026_advanced.html', 'd2e05a08e8f971f8efa9a61d2558479ef432d4d83bf470021e8f241eaa4e1f84'),
  (203952, 2025, 'regular', 'basketball_reference', 'wiggian01', 'MIA', 'SF', 30, 68, 68, 2063, 15.1, 58.600, 0.406, 0.197, 5.7, 10.8, 8.3, 12.3, 1.7, 3.0, 10.3, 19.7, 2.2, 2.3, 4.6, 0.106, 0.7, 0.5, 1.2, 1.7, 'https://www.basketball-reference.com/leagues/NBA_2026_advanced.html', 'd2e05a08e8f971f8efa9a61d2558479ef432d4d83bf470021e8f241eaa4e1f84'),
  (1626171, 2025, 'regular', 'basketball_reference', 'portibo01', 'MIL', 'PF', 30, 67, 9, 1619, 17.1, 58.700, 0.395, 0.091, 6.3, 23.5, 14.9, 10.5, 1.2, 0.7, 7.8, 23.1, 1.6, 1.2, 2.8, 0.083, 1.5, -1.6, 0.0, 0.8, 'https://www.basketball-reference.com/leagues/NBA_2026_advanced.html', 'd2e05a08e8f971f8efa9a61d2558479ef432d4d83bf470021e8f241eaa4e1f84'),
  (1628389, 2025, 'regular', 'basketball_reference', 'adebaba01', 'MIA', 'C', 28, 73, 73, 2365, 18.7, 55.100, 0.349, 0.369, 6.5, 25.7, 16.1, 14.1, 1.7, 1.8, 8.3, 25.0, 2.8, 3.6, 6.4, 0.129, 1.5, 0.4, 2.0, 2.4, 'https://www.basketball-reference.com/leagues/NBA_2026_advanced.html', 'd2e05a08e8f971f8efa9a61d2558479ef432d4d83bf470021e8f241eaa4e1f84'),
  (1630208, 2025, 'regular', 'basketball_reference', 'richani01', '2TM', 'C', 28, 48, 6, 701, 11.9, 56.200, 0.090, 0.502, 11.8, 25.6, 18.7, 3.2, 0.7, 4.1, 19.4, 18.2, -0.2, 0.8, 0.6, 0.040, -4.9, -1.2, -6.1, -0.7, 'https://www.basketball-reference.com/leagues/NBA_2026_advanced.html', 'd2e05a08e8f971f8efa9a61d2558479ef432d4d83bf470021e8f241eaa4e1f84'),
  (1630558, 2025, 'regular', 'basketball_reference', 'mitchda01', 'MIA', 'PG', 27, 70, 70, 2000, 12.1, 58.200, 0.428, 0.122, 1.6, 8.0, 4.8, 29.1, 1.6, 0.5, 16.1, 13.6, 2.6, 1.7, 4.3, 0.104, -1.3, 0.4, -0.9, 0.6, 'https://www.basketball-reference.com/leagues/NBA_2026_advanced.html', 'd2e05a08e8f971f8efa9a61d2558479ef432d4d83bf470021e8f241eaa4e1f84'),
  (1630696, 2025, 'regular', 'basketball_reference', 'smithdr01', 'MIA', 'SG', 28, 70, 1, 1141, 14.5, 53.200, 0.397, 0.323, 5.6, 10.2, 7.9, 20.0, 4.1, 1.6, 12.9, 15.2, 1.2, 1.9, 3.0, 0.127, -1.5, 3.6, 2.2, 1.2, 'https://www.basketball-reference.com/leagues/NBA_2026_advanced.html', 'd2e05a08e8f971f8efa9a61d2558479ef432d4d83bf470021e8f241eaa4e1f84'),
  (1631107, 2025, 'regular', 'basketball_reference', 'jovicni01', 'MIA', 'PF', 22, 47, 1, 808, 9.5, 48.000, 0.532, 0.322, 3.2, 16.5, 9.8, 16.5, 1.5, 1.9, 15.4, 21.4, -0.9, 1.0, 0.0, 0.001, -3.5, -0.1, -3.5, -0.3, 'https://www.basketball-reference.com/leagues/NBA_2026_advanced.html', 'd2e05a08e8f971f8efa9a61d2558479ef432d4d83bf470021e8f241eaa4e1f84'),
  (1631323, 2025, 'regular', 'basketball_reference', 'fontesi01', 'MIA', 'SF', 30, 70, 9, 1173, 13.8, 57.900, 0.696, 0.217, 4.9, 13.8, 9.3, 11.6, 1.5, 0.7, 8.7, 19.6, 1.4, 1.2, 2.6, 0.106, 0.7, -0.2, 0.5, 0.7, 'https://www.basketball-reference.com/leagues/NBA_2026_advanced.html', 'd2e05a08e8f971f8efa9a61d2558479ef432d4d83bf470021e8f241eaa4e1f84'),
  (1641796, 2025, 'regular', 'basketball_reference', 'larsspe01', 'MIA', 'SG', 24, 70, 54, 1849, 13.1, 60.500, 0.343, 0.413, 3.8, 9.9, 6.8, 16.8, 1.2, 0.8, 13.3, 16.8, 2.6, 1.5, 4.1, 0.106, -1.2, 0.0, -1.2, 0.4, 'https://www.basketball-reference.com/leagues/NBA_2026_advanced.html', 'd2e05a08e8f971f8efa9a61d2558479ef432d4d83bf470021e8f241eaa4e1f84'),
  (1642066, 2025, 'regular', 'basketball_reference', 'gardnmy01', 'MIA', 'SF', 24, 45, 7, 411, 15.2, 60.600, 0.520, 0.211, 9.8, 21.1, 15.4, 14.0, 2.3, 1.7, 11.2, 15.0, 0.8, 0.6, 1.4, 0.163, -1.1, 1.9, 0.9, 0.3, 'https://www.basketball-reference.com/leagues/NBA_2026_advanced.html', 'd2e05a08e8f971f8efa9a61d2558479ef432d4d83bf470021e8f241eaa4e1f84'),
  (1642352, 2025, 'regular', 'basketball_reference', 'johnske10', 'MIA', 'SF', 24, 32, 0, 280, 15.2, 58.200, 0.423, 0.279, 9.6, 13.4, 11.5, 3.9, 2.5, 2.5, 10.0, 18.9, 0.3, 0.4, 0.6, 0.110, -1.3, 0.0, -1.3, 0.1, 'https://www.basketball-reference.com/leagues/NBA_2026_advanced.html', 'd2e05a08e8f971f8efa9a61d2558479ef432d4d83bf470021e8f241eaa4e1f84'),
  (1642884, 2025, 'regular', 'basketball_reference', 'goldivl01', 'MIA', 'C', 24, 9, 0, 24, 14.7, 78.800, 0.000, 0.250, 12.9, 26.1, 19.4, 15.9, 0.0, 11.1, 40.3, 12.6, 0.0, 0.0, 0.1, 0.121, -5.0, 4.5, -0.5, 0.0, 'https://www.basketball-reference.com/leagues/NBA_2026_advanced.html', 'd2e05a08e8f971f8efa9a61d2558479ef432d4d83bf470021e8f241eaa4e1f84')
on conflict (player_id, season_start_year, season_type, source_provider)
do update set
  source_player_id = excluded.source_player_id,
  source_team_label = excluded.source_team_label,
  position = excluded.position,
  age = excluded.age,
  games = excluded.games,
  games_started = excluded.games_started,
  minutes = excluded.minutes,
  per = excluded.per,
  ts_pct = excluded.ts_pct,
  three_point_attempt_rate = excluded.three_point_attempt_rate,
  free_throw_attempt_rate = excluded.free_throw_attempt_rate,
  orb_pct = excluded.orb_pct,
  drb_pct = excluded.drb_pct,
  trb_pct = excluded.trb_pct,
  ast_pct = excluded.ast_pct,
  stl_pct = excluded.stl_pct,
  blk_pct = excluded.blk_pct,
  tov_pct = excluded.tov_pct,
  usg_pct = excluded.usg_pct,
  ows = excluded.ows,
  dws = excluded.dws,
  ws = excluded.ws,
  ws_per_48 = excluded.ws_per_48,
  obpm = excluded.obpm,
  dbpm = excluded.dbpm,
  bpm = excluded.bpm,
  vorp = excluded.vorp,
  source_url = excluded.source_url,
  source_file_sha256 = excluded.source_file_sha256,
  imported_at = now();

commit;

select * from public.heat_player_advanced_baseline order by full_name;
