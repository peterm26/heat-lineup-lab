# Heat Lineup Lab

An interactive Miami Heat lineup explorer built around one question:
**What changes when you replace one player with another?**

Build a five-player lineup on a Miami court, swap players from the bench, and
compare observed advanced statistics. The app uses a 2026–27 roster snapshot and
user-supplied 2025–26 regular-season player profiles.

## Features

- Drag-and-drop substitutions, with a click/tap alternative.
- NBA player portraits and a Miami half-court background.
- Shooting, creation, defense, and impact views covering 20 advanced metrics.
- Green/red indicators for favorable/unfavorable changes; role-dependent metrics
  such as usage and three-point attempt rate stay neutral.
- A swap report comparing the incoming player with the player just replaced.
- A five-player summary of strengths, possible role overlap, and evidence gaps.
- Browser-local saving, reset, bench search, and lineup export.
- Python import validation and PostgreSQL/Supabase setup scripts.

## Analytical scope

Reports use transparent statistical rules, not an AI API. They describe individual
historical profiles and possible fit questions. They do not predict team offensive
rating, defensive rating, net rating, or causal effects of a substitution.
Predictive lineup modeling is future work.

Three-point attempt rate measures shot selection, not accuracy. Defensive BPM is
a box-score estimate, not a complete defensive evaluation. Missing history remains
unavailable, and small samples are flagged. Screening thresholds are explained in
the report details.

## Run locally

Requires Python 3. From the repository root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory heat-lineup-lab/dist
```

Open **http://127.0.0.1:4173**. No frontend dependencies or build step are needed.
Use HTTP rather than opening `index.html` directly: the app uses JavaScript modules
and fetches a JSON data file.

## Structure

```text
heat-lineup-lab/
  dist/          HTML, CSS, JavaScript, player snapshot, and local assets
  tests/         Substitution, report, and metric-direction tests
  tools/         Official NBA portrait download helper
scripts/         Data validation, SQL generation, and UI snapshot export
supabase/
  migrations/    Schema, roster, advanced stats, and default lineup
  templates/     Advanced-stat schema template
data/raw/        Supplied source datasets
tests/           Python importer tests
```

See [HOW_TO_EDIT.md](HOW_TO_EDIT.md) for files to tweak and
[DOMAIN_PLAN.md](DOMAIN_PLAN.md) for demo-hosting plans.

## Database setup

The interface currently reads `heat-lineup-lab/dist/players.json`; it is not
connected to Supabase. Saved lineup choices remain in the current browser.

Run these scripts in order in Supabase's SQL Editor:

1. `supabase/migrations/20261026000100_initial_schema.sql`
2. `supabase/migrations/20261026000200_seed_heat_players.sql`
3. `supabase/migrations/20261026000400_import_advanced_stats.sql`
4. `supabase/migrations/20261026000500_default_starting_five.sql`

Migration `003` is an optional traditional-stat view. Traditional totals are not
populated by the advanced import. Row-level security is enabled without client
policies; explicit policies are needed before connecting a browser client.

The advanced import maps source player names and Basketball Reference IDs to NBA
IDs, uses Nick Richards' combined-season row once, and imports 15 profiles. Two
roster players have no row in the supplied source.

## Regenerate profiles

```sh
python3 scripts/prepare_advanced_import.py data/raw/advanced_2025_26.csv --output supabase/migrations/20261026000400_import_advanced_stats.sql
python3 scripts/export_site_profiles.py data/raw/advanced_2025_26.csv
```

The earlier Zenodo per-game snapshot is retained in `data/raw/` for reference only;
it is not used by the app or advanced import. Source URLs and fingerprints are
preserved in the generated data.

## Validation

Requires Python 3 and a recent Node.js version:

```sh
python3 -m unittest discover -s tests -v
node --test heat-lineup-lab/tests/model.test.js heat-lineup-lab/tests/reports.test.js
```

Checks cover matching IDs, combined rows versus team splits, malformed data,
missing history, duplicate prevention, substitutions, directional colors, sample
sizes, and report evidence. Synthetic test fixtures are separate from real data.

## Sources

- Advanced statistics: [Basketball Reference, 2025–26](https://www.basketball-reference.com/leagues/NBA_2026_advanced.html), supplied as a CSV export.
- Player IDs, portraits, and team logo: NBA.
- Court artwork: [Basketball Jersey Archive](https://basketballjerseyarchive.com/miami-heat-courts-t6054/).

Asset source URLs are documented in [ASSETS.md](heat-lineup-lab/ASSETS.md) and the
`sources.json` files alongside the images. This is an independent portfolio project.

## Next steps

- Publish a publicly accessible demo.
- Connect the interface to Supabase.
- Add historical lineup/possession data and evaluate a prediction model on held-out games.
- Expand shooting and defensive evidence beyond the advanced profile table.
