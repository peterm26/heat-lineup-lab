"""Prepare the confirmed 2025–26 Basketball Reference advanced data for Supabase."""
import argparse
from collections import defaultdict
import csv
from decimal import Decimal, InvalidOperation
import hashlib
from pathlib import Path
import re
from prepare_stats_import import normalized, roster

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://www.basketball-reference.com/leagues/NBA_2026_advanced.html'
METRICS = {
    'per': 'PER', 'ts_pct': 'TS%', 'three_point_attempt_rate': '3PAr',
    'free_throw_attempt_rate': 'FTr', 'orb_pct': 'ORB%', 'drb_pct': 'DRB%',
    'trb_pct': 'TRB%', 'ast_pct': 'AST%', 'stl_pct': 'STL%', 'blk_pct': 'BLK%',
    'tov_pct': 'TOV%', 'usg_pct': 'USG%', 'ows': 'OWS', 'dws': 'DWS',
    'ws': 'WS', 'ws_per_48': 'WS/48', 'obpm': 'OBPM', 'dbpm': 'DBPM',
    'bpm': 'BPM', 'vorp': 'VORP',
}


def decimal(value):
    if value in ('', 'NA', None):
        return None
    try:
        result = Decimal(value)
    except InvalidOperation as exc:
        raise ValueError(f'Invalid number: {value!r}') from exc
    if not result.is_finite():
        raise ValueError('Non-finite statistic')
    return result


def choose_rows(rows, players):
    names = {normalized(name): pid for pid, name in players.items()}
    names[normalized('Bobby Portis')] = 1626171
    grouped = defaultdict(list)
    for row in rows:
        pid = names.get(normalized(row.get('Player', '')))
        if pid in players:
            if None in row or any(v is None for v in row.values()):
                raise ValueError('Malformed source row')
            grouped[pid].append(row)
    selected = {}
    for pid, group in grouped.items():
        aggregate = [r for r in group if re.fullmatch(r'(?:\d+TM|TOT)', r['Team'])]
        if len(group) == 1:
            row = group[0]
        elif len(aggregate) == 1:
            row = aggregate[0]
            splits = [r for r in group if r is not row]
            for field in ('G', 'MP'):
                if int(row[field]) != sum(int(r[field]) for r in splits):
                    raise ValueError(f'{players[pid]}: inconsistent combined {field}')
            if len({r['Player-additional'] for r in group}) != 1:
                raise ValueError('Conflicting Basketball Reference IDs')
        else:
            raise ValueError(f'{players[pid]}: ambiguous team splits')
        if not re.fullmatch(r'[a-z0-9]+', row['Player-additional']):
            raise ValueError('Invalid source player ID')
        if not 1 <= int(row['G']) <= 82 or not 0 <= int(row['GS']) <= int(row['G']):
            raise ValueError('Invalid game counts')
        if int(row['MP']) < 0 or int(row['Age']) <= 0:
            raise ValueError('Invalid minutes or age')
        for field, header in METRICS.items():
            value = decimal(row[header])
            if value is None:
                continue
            if field.endswith('_pct') and field != 'ts_pct' and not 0 <= value <= 100:
                raise ValueError(f'Invalid percentage: {header}')
            if field == 'three_point_attempt_rate' and not 0 <= value <= 1:
                raise ValueError('Invalid three-point attempt rate')
            if field in ('ts_pct', 'free_throw_attempt_rate') and value < 0:
                raise ValueError(f'Invalid rate: {header}')
        selected[pid] = row
    if not selected:
        raise ValueError('No matching roster players')
    if len({r['Player-additional'] for r in selected.values()}) != len(selected):
        raise ValueError('Source player ID mapped to multiple NBA players')
    return selected


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def build_sql(selected, digest):
    columns = ['player_id', 'season_start_year', 'season_type', 'source_provider',
               'source_player_id', 'source_team_label', 'position', 'age',
               'games', 'games_started', 'minutes', *METRICS,
               'source_url', 'source_file_sha256']
    records = []
    for pid, row in sorted(selected.items()):
        values = [str(pid), '2025', "'regular'", "'basketball_reference'",
                  literal(row['Player-additional']), literal(row['Team']),
                  literal(row['Pos']), str(int(row['Age'])), str(int(row['G'])),
                  str(int(row['GS'])), str(int(row['MP']))]
        for field, header in METRICS.items():
            value = decimal(row[header])
            if value is not None and field == 'ts_pct':
                value *= 100
            values.append('NULL' if value is None else str(value))
        values += [literal(SOURCE), literal(digest)]
        records.append('  (' + ', '.join(values) + ')')
    schema = (ROOT / 'supabase/templates/advanced_stats.sql').read_text()
    return ('-- Run after the initial schema and Heat players import. Safe to re-run.\n'
            '-- Source: user-supplied advanced CSV, confirmed 2025–26 regular season.\n'
            '-- Nick Richards uses the combined row, not the sum of advanced rates.\n'
            'begin;\n\n' + schema + '\n'
            'insert into public.player_season_advanced_stats (' + ', '.join(columns) + ') values\n'
            + ',\n'.join(records)
            + '\non conflict (player_id, season_start_year, season_type, source_provider)\n'
            + 'do update set\n' + ',\n'.join(f'  {c} = excluded.{c}' for c in columns[4:])
            + ',\n  imported_at = now();\n\ncommit;\n\n'
            + 'select * from public.heat_player_advanced_baseline order by full_name;\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    raw = args.input.read_bytes()
    rows = list(csv.DictReader(raw.decode('utf-8-sig').splitlines()))
    selected = choose_rows(rows, roster())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(build_sql(selected, hashlib.sha256(raw).hexdigest()))
    print(f'Prepared {len(selected)} players; database not changed.')
    print('Missing: ' + ', '.join(name for pid, name in roster().items() if pid not in selected))


if __name__ == '__main__':
    main()
