# Heat Lineup Lab

An NBA lineup simulator focused on Miami's current roster, using the 2025–26
regular season as the initial statistical baseline.

## Interactive lineup builder

The website source lives in `heat-lineup-lab/`, separate from the database
migrations and import scripts. Its buildless frontend is in `heat-lineup-lab/dist/`.
It uses a verified snapshot of the supplied advanced source in `players.json`;
it does not currently read or write Supabase. `scripts/export_site_profiles.py`
regenerates that snapshot from the confirmed advanced CSV.

The interface starts with Mitchell, Thompson, Wiggins, Antetokounmpo, and Adebayo.
Drag a bench player onto a slot, or click a bench player and then a slot. Moving
a player already on court swaps the two positions without duplicating the player.
The comparison panel and five-player table expose shooting, creation, defensive,
and impact metrics. All changes compare individual historical profiles, not
predicted team performance. Notes are deterministic descriptions, not AI outputs.
Missing history remains unavailable. Save stores the chosen IDs in this browser;
Export downloads the selection as JSON. Neither modifies the Supabase default.

Tests: `node --test heat-lineup-lab/tests/model.test.js`.
Local preview: `python3 -m http.server 4173 --bind 127.0.0.1 --directory heat-lineup-lab/dist`.
The private Sites project identity is retained in
`heat-lineup-lab/.openai/hosting.json`. Preserve it for future updates.

## Ready now: advanced statistics

After running the initial schema and players import, run
`supabase/migrations/20261026000400_import_advanced_stats.sql` in Supabase's SQL
Editor. This single file creates `player_season_advanced_stats`, imports the
user-supplied advanced metrics for 15 players, and creates the
`heat_player_advanced_baseline` view. The final query shows all 17 roster players,
including two with missing history. The traditional-stats view (migration 003)
is optional and is not required by this advanced import. Nothing in this import
depends on the earlier Zenodo per-game file or on obtaining traditional totals.

The advanced source was supplied by the user as pasted CSV and confirmed as the
2025–26 regular season, from
https://www.basketball-reference.com/leagues/NBA_2026_advanced.html. The web page
returned HTTP 403 when checked; the imported values are from the supplied file,
not a fresh download. The SQL records its SHA-256 fingerprint and source URL.

The importer maps names to the existing NBA IDs, preserves Basketball Reference
IDs, and selects Nick Richards' `2TM` aggregate instead of his two team splits.
Ryan Conwell and Tre Donaldson have no rows in this source and remain missing.
Advanced statistics are never summed or averaged across the five selected players
and presented as lineup predictions. In particular, BPM/OBPM/DBPM are source
box-score impact estimates, not raw observed lineup plus/minus.

`ts_pct` uses 0–100 (Bam's `.551` becomes `55.1`); the source percentage columns
such as `tov_pct` already use 0–100. `three_point_attempt_rate` and
`free_throw_attempt_rate` retain source ratios (Bam's `.349` stays `.349`).
Missing values stay NULL, not zero. RLS remains enabled without client policies.

To regenerate the import from a confirmed same-season advanced CSV:

```sh
python3 scripts/prepare_advanced_import.py /path/to/advanced.csv --output supabase/migrations/20261026000400_import_advanced_stats.sql
```

The SQL has been prepared locally and has not been executed against Supabase.
Run `supabase/migrations/20261026000500_default_starting_five.sql` next to save
the user-selected default: Davion Mitchell at 1, Klay Thompson at 2, Andrew Wiggins
at 3, Giannis Antetokounmpo at 4, and Bam Adebayo at 5. Its final query returns
five rows in court order with their individual advanced statistics. It is safe
to re-run for the same lineup; it stops rather than silently replacing a
different existing default. This file has not been executed against Supabase
from the workspace.

Next: display these individual advanced profiles in the lineup comparison
interface. Collective lineup predictions require a trained model and supporting
historical data, separate from these player profiles.

## First setup

1. Create a Supabase project named `heat-lineup-lab`.
2. Open its SQL Editor and create a new query.
3. Paste the complete contents of
   `supabase/migrations/20261026000100_initial_schema.sql` and run it once in a
   new project. It creates seven tables and seeds Miami and the two seasons.
4. In Table Editor, confirm the seven tables exist, `teams` contains Miami,
   and `seasons` contains 2025–26 and 2026–27. Player and lineup tables start empty.

This SQL has been prepared locally; it has not been executed against a database.
If using the Supabase CLI later, reconcile its migration history with this
Dashboard-applied migration before pushing changes.

## Data rules

- Use official NBA IDs as canonical player and team keys.
- Current roster membership is separate from last season's statistical history.
- Import full-season player totals across all teams, not per-game numbers or
  individual team splits. Do not count a traded player's aggregate row and team
  splits twice.
- An absent statistical row means missing history; never substitute all zeroes.
- Derive shooting percentages from makes and attempts; zero attempts means an
  unknown percentage, not 0% shooting. Keep source URLs and retrieval dates.
- A saved lineup is playable only when it has five members. Database constraints
  prevent duplicate players, duplicate slots, more than five slots, and players
  outside the selected team-season roster. The future app must check completeness
  before prediction; draft lineups may have fewer than five members.
- Court slots are presentation positions, not fixed basketball roles.
- Player season totals cannot establish collective lineup ratings. Historical
  lineup observations and model predictions will be stored separately later.

## Access

Row-level security is enabled with no client policies. Initial imports and
inspection use the Supabase SQL/Table Editors. Browser/API access will require
explicit policies before the interface is connected. Keep database passwords and
secret/service-role keys out of browser code and chat.

## Next milestone

The current roster import is prepared in
`supabase/migrations/20261026000200_seed_heat_players.sql`. After applying the
initial schema, run this file in the SQL Editor. Its final query should show 17
players linked to Miami's 2026–27 roster. Names and IDs were checked against the
official Heat roster and NBA player profiles on October 25, 2026. The script is
safe to re-run, but is an additive snapshot import, not a future roster-sync job.
It does not remove players or record contract status.

Neither SQL file has been executed against Supabase from this workspace.

Next, import these players' 2025–26 regular-season totals, reconcile totals
against the source, then select and save the default five. Do not seed assumed
starters or fabricated statistics. Players without NBA history remain without a
stats row until a separate fallback modeling strategy is implemented.

## Player statistics import

1. Run `supabase/migrations/20261026000300_player_baseline_view.sql` in the SQL
   Editor after the initial schema and roster import. It adds a comparison-ready
   view without inserting statistics. Until the import, it shows missing history.
2. Obtain the full 2025–26 regular-season totals table from NBA Stats, with all
   teams selected (not just Miami). Preserve the original downloaded JSON or CSV.
   The direct NBA endpoint timed out here, so actual stats have not been imported.
3. Prepare a rerunnable SQL import from an NBA JSON response:

   ```sh
   python3 scripts/prepare_stats_import.py data/nba_totals.json --output data/import_stats.sql
   ```

   Or from a CSV after confirming season, season type, all teams, and Totals:

   ```sh
   python3 scripts/prepare_stats_import.py data/nba_totals.csv --confirm-full-season-totals --output data/import_stats.sql
   ```

4. Review reported missing players. Missing source rows might be rookies, missing
   history, or an incomplete export; absence alone does not establish the cause.
5. Run the generated SQL in Supabase and review its final result table. Reconcile
   source totals for at least Bam and a player who changed teams.

The CSV requires `PLAYER_ID` or `PLAYER_NAME`/`PLAYER`, plus `GP`, `MIN`, `PTS`,
`FGM`, `FGA`, `FG3M`/`3PM`, `FG3A`/`3PA`, `FTM`, `FTA`, `AST`, `TOV`, `OREB`,
`DREB`, `STL`, `BLK`, `PF`, and `PLUS_MINUS`/`+/-`. Name matching ignores accents
and punctuation, with a specific alias for Bobby Portis. IDs take priority and
are cross-checked against names when provided. CSV files have no verifiable
season/filter metadata, so the confirmation flag is necessary. JSON metadata
checks reject common filtered or per-game requests; source selection still needs
review. Duplicate player rows are rejected instead of summing team splits.
The source file's last-modified time is used as the retrieval timestamp: preserve
the original file. Each import stores the NBA source URL.

The view exposes percentages as 0–100 and keeps zero denominators NULL. It shows
season plus/minus, not adjusted impact. Assist-to-turnover ratio is not turnover
percentage. Possession-based rates, lineup ratings, tracking stats, and predictions
require additional data and are deliberately not derived from these totals.

Validate importer behavior with `python3 -m unittest discover -s tests -v`.
The fixtures are synthetic and never inserted into the real dataset.
