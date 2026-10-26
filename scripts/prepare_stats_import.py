"""Validate NBA full-season totals and prepare SQL; never connects to Supabase."""
import argparse
import csv
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import json
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = ('https://www.nba.com/stats/players/traditional?PerMode=Totals'
              '&Season=2025-26&SeasonType=Regular+Season')
FIELDS = {
    'games': 'GP', 'minutes': 'MIN', 'points': 'PTS', 'fgm': 'FGM', 'fga': 'FGA',
    'fg3m': 'FG3M', 'fg3a': 'FG3A', 'ftm': 'FTM', 'fta': 'FTA',
    'assists': 'AST', 'turnovers': 'TOV', 'offensive_rebounds': 'OREB',
    'defensive_rebounds': 'DREB', 'steals': 'STL', 'blocks': 'BLK',
    'fouls': 'PF', 'plus_minus': 'PLUS_MINUS',
}


def normalized(value):
    text = unicodedata.normalize('NFKD', value)
    return ''.join(c for c in text.lower() if c.isalnum() and not unicodedata.combining(c))


def roster():
    sql = (ROOT / 'supabase/migrations/20261026000200_seed_heat_players.sql').read_text()
    return {int(pid): name for pid, name in
            re.findall(r"\((\d+)(?:::bigint)?, '([^']+)'\)", sql)}


def read_rows(path):
    if path.suffix.lower() == '.json':
        payload = json.loads(path.read_text())
        params = payload.get('parameters', {})
        for key, expected in {'Season': '2025-26', 'SeasonType': 'Regular Season',
                              'PerMode': 'Totals', 'MeasureType': 'Base'}.items():
            if params.get(key) != expected:
                raise ValueError(f'JSON must specify {key}={expected!r}.')
        if str(params.get('TeamID')) != '0':
            raise ValueError('Use all-team season totals (TeamID=0).')
        for key in ('DateFrom', 'DateTo', 'SeasonSegment', 'GameSegment', 'Location',
                    'Outcome', 'StarterBench'):
            if params.get(key) not in (None, ''):
                raise ValueError(f'Filtered JSON is not full-season data: {key}.')
        for key in ('LastNGames', 'Month', 'Period', 'OpponentTeamID', 'PORound'):
            if str(params.get(key, 0)) != '0':
                raise ValueError(f'Filtered JSON is not full-season data: {key}.')
        tables = [s for s in payload.get('resultSets', [])
                  if s.get('name') == 'LeagueDashPlayerStats']
        if len(tables) != 1:
            raise ValueError('Expected one LeagueDashPlayerStats result set.')
        table = tables[0]
        if any(len(row) != len(table['headers']) for row in table['rowSet']):
            raise ValueError('NBA result row length differs from headers.')
        return [dict(zip(table['headers'], row)) for row in table['rowSet']]
    with path.open(newline='', encoding='utf-8-sig') as handle:
        rows = list(csv.DictReader(handle))
    aliases = {'PLAYER': 'PLAYER_NAME', 'NAME': 'PLAYER_NAME', '3PM': 'FG3M',
               '3PA': 'FG3A', '+/-': 'PLUS_MINUS'}
    return [{aliases.get(k.strip().upper(), k.strip().upper()): v
             for k, v in row.items() if k is not None} for row in rows]


def number(value, field):
    try:
        result = Decimal(str(value).replace(',', '').strip())
    except InvalidOperation as exc:
        raise ValueError(f'{field}: missing or invalid number {value!r}') from exc
    if not result.is_finite():
        raise ValueError(f'{field}: must be finite')
    if field != 'minutes' and result != result.to_integral_value():
        raise ValueError(f'{field}: expected integer total, got {value!r}')
    if field != 'plus_minus' and result < 0:
        raise ValueError(f'{field}: cannot be negative')
    return result


def select_stats(rows, players):
    names = {normalized(name): pid for pid, name in players.items()}
    # NBA display names sometimes omit the suffix used on Miami's roster page.
    names[normalized('Bobby Portis')] = 1626171
    found = {}
    for row in rows:
        if row.get('PLAYER_ID') not in (None, ''):
            pid = int(number(row['PLAYER_ID'], 'player_id'))
        else:
            pid = names.get(normalized(row.get('PLAYER_NAME', '')))
        if pid not in players:
            continue
        if pid in found:
            raise ValueError(f'Duplicate rows for {players[pid]}; use one all-team total.')
        if row.get('PLAYER_NAME') and normalized(row['PLAYER_NAME']) not in (
                normalized(players[pid]), normalized('Bobby Portis') if pid == 1626171 else ''):
            raise ValueError(f'Name/ID mismatch for player {pid}.')
        values = {field: number(row.get(column), field) for field, column in FIELDS.items()}
        if values['games'] < 1 or values['games'] > 82:
            raise ValueError(f'{players[pid]}: unexpected regular-season game count.')
        for made, attempted in [('fgm', 'fga'), ('fg3m', 'fg3a'), ('ftm', 'fta')]:
            if values[made] > values[attempted]:
                raise ValueError(f'{players[pid]}: makes exceed attempts.')
        if (values['fg3m'] > values['fgm'] or values['fg3a'] > values['fga'] or
                values['fgm'] - values['fg3m'] > values['fga'] - values['fg3a']):
            raise ValueError(f'{players[pid]}: inconsistent three-point totals.')
        if values['points'] != 2 * values['fgm'] + values['fg3m'] + values['ftm']:
            raise ValueError(f'{players[pid]}: points do not match made shots.')
        found[pid] = values
    if not found:
        raise ValueError('No roster players found; check source IDs/names and headers.')
    return found


def build_sql(found, retrieved_at):
    columns = ['player_id', 'season_start_year', 'season_type', *FIELDS,
               'source_url', 'retrieved_at']
    lines = ['-- Validated 2025–26 regular-season player totals, not lineup projections.',
             '-- Run after the initial schema and players import.', 'begin;',
             f"insert into public.player_season_stats ({', '.join(columns)}) values"]
    records = []
    for pid, stats in sorted(found.items()):
        cells = [str(pid), '2025', "'regular'", *(str(stats[f]) for f in FIELDS),
                 f"'{SOURCE_URL}'", "'" + retrieved_at.replace("'", "''") + "'"]
        records.append('  (' + ', '.join(cells) + ')')
    lines += [',\n'.join(records),
              'on conflict (player_id, season_start_year, season_type) do update set',
              ',\n'.join(f'  {c} = excluded.{c}' for c in columns[3:]) + ';',
              'commit;',
              'select * from public.heat_player_baseline_stats order by full_name;']
    return '\n'.join(lines) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path, help='NBA response JSON or totals CSV')
    parser.add_argument('--confirm-full-season-totals', action='store_true',
                        help='Required for CSV: confirm all teams, 2025–26 regular season, Totals')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.input.suffix.lower() != '.json' and not args.confirm_full_season_totals:
        parser.error('CSV needs --confirm-full-season-totals; never use per-game data.')
    try:
        players = roster()
        found = select_stats(read_rows(args.input), players)
        stamp = datetime.fromtimestamp(args.input.stat().st_mtime, timezone.utc).isoformat()
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(build_sql(found, stamp))
    except (ValueError, OSError, KeyError, TypeError) as exc:
        parser.exit(1, f'Import stopped: {exc}\n')
    missing = [name for pid, name in players.items() if pid not in found]
    print(f'Prepared {len(found)} players in {args.output}. No database was changed.')
    print('Missing from source (review; not filled with zeros): ' + ', '.join(missing))


if __name__ == '__main__':
    main()
