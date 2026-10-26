# Editing Heat Lineup Lab

Open this project folder in your preferred code editor.

## Interface files

| File | What to change |
| --- | --- |
| `heat-lineup-lab/dist/index.html` | Page sections, wording, court drawing, and controls |
| `heat-lineup-lab/dist/styles.css` | Colors, fonts, spacing, court-card positions, and responsive layouts |
| `heat-lineup-lab/dist/photos.css` | Player-photo sizes and the latest court-card position overrides |
| `heat-lineup-lab/dist/theme.css` | Black backgrounds, deep red buttons, gold accents, and brand colors |
| `heat-lineup-lab/dist/app.js` | Screen updates, metric groups, comparison notes, saving, and export |
| `heat-lineup-lab/dist/model.js` | Default five, position labels, and substitution rules |
| `heat-lineup-lab/dist/reports.js` | Favorable/unfavorable metric directions and the two stat-based summaries |
| `heat-lineup-lab/dist/players.json` | The current player-stat snapshot; preserve IDs and source provenance |

The default five in `model.js` are NBA IDs, ordered PG, SG, SF, PF, C.
The `.court-card.slot-0` through `.slot-4` rules in `styles.css` control their
positions on the court. The metric groups near the top of `app.js` control which
stats appear under Shooting, Creation, Defense, and Impact.

The two report boxes use transparent rules in `reports.js`, just like the
original Read the profile text; they do not call an AI service. Green and red
describe favorable and unfavorable historical indicators, not proven team impact.
Usage, three-point attempt share, free-throw rate, and cumulative season value
stay neutral because their interpretation depends on role or playing time.
Swap comparisons use the player most recently replaced at that position. The
five-player report refreshes for the whole current selection. Its expandable
details document the screening thresholds and sample-size handling.

Player headshots are stored locally in `heat-lineup-lab/dist/assets/players/`,
named by NBA ID. The selected Miami floor is in
`heat-lineup-lab/dist/assets/courts/miami-heat.png`. The page displays a rotated
half-court crop; the source PNG is unchanged. `photos.css` loads after
`styles.css`, so its portrait and court-position rules take precedence.

## Preview your edits

Open a terminal in this project folder and run:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory heat-lineup-lab/dist
```

Then open http://127.0.0.1:4173 in your browser. Refresh after saving changes.
Stop the preview with Control+C. Serve the page this way instead of opening
`index.html` directly, because the page loads a JSON file and JavaScript modules.

Local edits do not automatically update the hosted private site. Ask Codex to
publish the edited project when you want the online version updated. Preserve
`heat-lineup-lab/.openai/hosting.json`: it identifies the existing Site.

## Database and data files

- `supabase/migrations/`: the SQL scripts already prepared for Supabase.
- `supabase/templates/advanced_stats.sql`: the advanced schema template used by
  the import generator; run the complete generated migration in Supabase.
- `scripts/`: Python helpers for import validation and snapshot generation.
- `tests/` and `heat-lineup-lab/tests/`: validation checks.
- `data/raw/advanced_2025_26.csv`: the supplied advanced file used in the import.
- `data/raw/zenodo_per_game_partial_2025_26.csv`: the earlier Zenodo snapshot,
  retained for reference only; it is not used by the app or advanced import.

To regenerate the advanced import and the UI snapshot from the preserved source:

```sh
python3 scripts/prepare_advanced_import.py data/raw/advanced_2025_26.csv --output supabase/migrations/20261026000400_import_advanced_stats.sql
python3 scripts/export_site_profiles.py data/raw/advanced_2025_26.csv
```

To check code changes:

```sh
python3 -m unittest discover -s tests -v
node --test heat-lineup-lab/tests/model.test.js
```

The current app uses the snapshot, not a live Supabase connection. Saved lineup
choices stay in that browser. AI reports and collective lineup predictions are
not implemented yet.
