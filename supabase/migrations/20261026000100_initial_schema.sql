-- Run once in a new Supabase project's SQL Editor.
-- Initial data entry is through the SQL Editor; client access is not enabled yet.
begin;

create table public.teams (
  id bigint primary key, -- Official NBA team ID
  abbreviation text not null unique,
  name text not null
);

create table public.seasons (
  start_year integer primary key,
  label text not null unique
);

create table public.players (
  id bigint primary key, -- Official NBA player ID, not a provider-specific ID
  full_name text not null
);

-- A season roster snapshot, separate from the team a player played for last year.
create table public.roster_memberships (
  team_id bigint not null references public.teams(id),
  season_start_year integer not null references public.seasons(start_year),
  player_id bigint not null references public.players(id),
  source_url text not null,
  retrieved_at timestamptz not null default now(),
  primary key (team_id, season_start_year, player_id)
);

-- Full-season totals across all teams; never mix team splits with aggregate rows.
-- Percentages will be calculated from these counts, with zero denominators -> NULL.
-- Tracking data and historical lineup results will get separate tables later.
create table public.player_season_stats (
  player_id bigint not null references public.players(id),
  season_start_year integer not null references public.seasons(start_year),
  season_type text not null check (season_type in ('regular', 'playoffs')),
  games integer not null check (games >= 0),
  minutes numeric not null check (minutes >= 0),
  points integer not null check (points >= 0),
  fgm integer not null check (fgm >= 0),
  fga integer not null check (fga >= fgm),
  fg3m integer not null check (fg3m >= 0 and fg3m <= fgm),
  fg3a integer not null check (fg3a >= fg3m and fg3a <= fga),
  ftm integer not null check (ftm >= 0),
  fta integer not null check (fta >= ftm),
  assists integer not null check (assists >= 0),
  turnovers integer not null check (turnovers >= 0),
  offensive_rebounds integer not null check (offensive_rebounds >= 0),
  defensive_rebounds integer not null check (defensive_rebounds >= 0),
  steals integer not null check (steals >= 0),
  blocks integer not null check (blocks >= 0),
  fouls integer not null check (fouls >= 0),
  plus_minus integer not null,
  source_url text not null,
  retrieved_at timestamptz not null default now(),
  primary key (player_id, season_start_year, season_type),
  check (fgm - fg3m <= fga - fg3a)
);

-- Slots may be filled incrementally. Only lineups with five members are playable.
create table public.lineups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  team_id bigint not null references public.teams(id),
  roster_season_start_year integer not null references public.seasons(start_year),
  baseline_season_start_year integer not null references public.seasons(start_year),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, team_id, roster_season_start_year)
);

create unique index one_default_per_team_season
  on public.lineups (team_id, roster_season_start_year) where is_default;

create table public.lineup_players (
  lineup_id uuid not null,
  team_id bigint not null,
  roster_season_start_year integer not null,
  court_slot smallint not null check (court_slot between 1 and 5),
  player_id bigint not null,
  primary key (lineup_id, court_slot),
  unique (lineup_id, player_id),
  foreign key (lineup_id, team_id, roster_season_start_year)
    references public.lineups (id, team_id, roster_season_start_year) on delete cascade,
  foreign key (team_id, roster_season_start_year, player_id)
    references public.roster_memberships (team_id, season_start_year, player_id)
);

-- Default-deny browser/API access until we implement the application's policies.
alter table public.teams enable row level security;
alter table public.seasons enable row level security;
alter table public.players enable row level security;
alter table public.roster_memberships enable row level security;
alter table public.player_season_stats enable row level security;
alter table public.lineups enable row level security;
alter table public.lineup_players enable row level security;

insert into public.teams (id, abbreviation, name)
values (1610612748, 'MIA', 'Miami Heat');

insert into public.seasons (start_year, label)
values (2025, '2025–26'), (2026, '2026–27');

commit;
