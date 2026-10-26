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
