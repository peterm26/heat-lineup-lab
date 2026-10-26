-- Run after the initial schema. No statistics are invented or inserted here.
-- Percentage columns use 0–100, not 0–1. Zero denominators yield NULL.
create or replace view public.heat_player_baseline_stats
with (security_invoker = true) as
select
  p.id as player_id,
  p.full_name,
  2026 as roster_season_start_year,
  2025 as stats_season_start_year,
  case when s.player_id is null then 'missing_history'
       when s.games = 0 then 'no_games'
       else 'available' end as data_status,
  s.games, s.minutes, s.points,
  s.fgm, s.fga, s.fg3m, s.fg3a, s.ftm, s.fta,
  s.assists, s.turnovers, s.offensive_rebounds, s.defensive_rebounds,
  s.steals, s.blocks, s.fouls,
  s.plus_minus as season_plus_minus,
  round(s.minutes / nullif(s.games, 0), 2) as minutes_per_game,
  round(s.points::numeric / nullif(s.games, 0), 2) as points_per_game,
  round(s.assists::numeric / nullif(s.games, 0), 2) as assists_per_game,
  round(s.turnovers::numeric / nullif(s.games, 0), 2) as turnovers_per_game,
  round((s.offensive_rebounds + s.defensive_rebounds)::numeric
        / nullif(s.games, 0), 2) as rebounds_per_game,
  round(100.0 * s.fgm / nullif(s.fga, 0), 2) as fg_pct,
  round(100.0 * s.fg3m / nullif(s.fg3a, 0), 2) as three_point_pct,
  round(s.fg3a::numeric / nullif(s.games, 0), 2) as three_point_attempts_per_game,
  round(100.0 * s.fg3a / nullif(s.fga, 0), 2) as three_point_attempt_rate_pct,
  round(100.0 * (s.fgm + 0.5 * s.fg3m) / nullif(s.fga, 0), 2) as efg_pct,
  round(100.0 * s.ftm / nullif(s.fta, 0), 2) as ft_pct,
  round(s.assists::numeric / nullif(s.turnovers, 0), 2) as assist_to_turnover_ratio,
  s.source_url as stats_source_url,
  s.retrieved_at as stats_retrieved_at
from public.roster_memberships r
join public.players p on p.id = r.player_id
left join public.player_season_stats s
  on s.player_id = p.id and s.season_start_year = 2025 and s.season_type = 'regular'
where r.team_id = 1610612748 and r.season_start_year = 2026;

comment on view public.heat_player_baseline_stats is
  '2026–27 Miami roster with observed 2025–26 individual regular-season stats. Not lineup projections. Percentages are 0–100. Missing history and zero denominators stay NULL.';

select * from public.heat_player_baseline_stats order by full_name;
