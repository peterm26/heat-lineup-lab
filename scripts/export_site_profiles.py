"""Export the supplied advanced source as a static UI snapshot, not predictions."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
from prepare_advanced_import import choose_rows, METRICS, SOURCE
from prepare_stats_import import roster

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('input', type=Path)
args = parser.parse_args()
raw = args.input.read_bytes()
players = roster()
selected = choose_rows(list(csv.DictReader(raw.decode('utf-8-sig').splitlines())), players)
output = []
for pid, name in players.items():
    row = selected.get(pid)
    stats = None
    if row:
        stats = {key: (None if row[header] in ('', 'NA') else float(row[header]))
                 for key, header in METRICS.items()}
        if stats['ts_pct'] is not None:
            stats['ts_pct'] = round(stats['ts_pct'] * 100, 4)
        stats.update(games=int(row['G']), games_started=int(row['GS']), minutes=int(row['MP']))
    output.append({'id': pid, 'name': name, 'position': row['Pos'] if row else 'G',
                   'source_team': row['Team'] if row else None, 'stats': stats})
payload = {'roster_season': '2026–27', 'baseline_season': '2025–26',
           'source_url': SOURCE, 'source_sha256': hashlib.sha256(raw).hexdigest(),
           'players': output}
target = Path(__file__).resolve().parents[1] / 'heat-lineup-lab/dist/players.json'
target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
print(f'Exported {len(output)} profiles; {len(selected)} with history.')
