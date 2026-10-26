"""Synthetic fixtures only; these are not real NBA statistics."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    'stats_import', Path(__file__).resolve().parents[1] / 'scripts/prepare_stats_import.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def example():
    row = {column: 0 for column in module.FIELDS.values()}
    row.update(PLAYER_ID=1628389, PLAYER_NAME='Bam Adebayo', GP=10, MIN=250.5,
               FGM=20, FGA=45, FG3M=5, FG3A=15, FTM=10, FTA=12, PTS=55,
               AST=15, TOV=5, PLUS_MINUS=-7)
    return row


class StatsImportTests(unittest.TestCase):
    def test_roster_ids_are_unique_and_complete(self):
        self.assertEqual(len(module.roster()), 17)

    def test_totals_keep_negative_plus_minus_and_decimal_minutes(self):
        result = module.select_stats([example()], module.roster())[1628389]
        self.assertEqual(result['plus_minus'], -7)
        self.assertEqual(str(result['minutes']), '250.5')

    def test_duplicate_team_splits_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            module.select_stats([example(), example()], module.roster())

    def test_wrong_name_for_id_is_rejected(self):
        row = example()
        row['PLAYER_NAME'] = 'Someone Else'
        with self.assertRaisesRegex(ValueError, 'mismatch'):
            module.select_stats([row], module.roster())

    def test_inconsistent_scoring_is_rejected(self):
        row = example()
        row['PTS'] = 56
        with self.assertRaisesRegex(ValueError, 'points'):
            module.select_stats([row], module.roster())

    def test_missing_totals_are_not_filled_with_zero(self):
        row = example()
        del row['TOV']
        with self.assertRaisesRegex(ValueError, 'turnovers'):
            module.select_stats([row], module.roster())

    def test_csv_display_headers_and_name_matching(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'totals.csv'
            row = example()
            del row['PLAYER_ID']
            row['PLAYER'] = row.pop('PLAYER_NAME')
            row['3PM'] = row.pop('FG3M')
            row['3PA'] = row.pop('FG3A')
            row['+/-'] = row.pop('PLUS_MINUS')
            with path.open('w', newline='') as handle:
                writer = module.csv.DictWriter(handle, fieldnames=list(row))
                writer.writeheader()
                writer.writerow(row)
            self.assertIn(1628389, module.select_stats(module.read_rows(path), module.roster()))

    def test_filtered_json_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'data.json'
            path.write_text(module.json.dumps({'parameters': {'Season': '2024-25'}}))
            with self.assertRaisesRegex(ValueError, 'Season'):
                module.read_rows(path)

    def test_sql_is_rerunnable_and_does_not_fill_missing_players(self):
        found = module.select_stats([example()], module.roster())
        sql = module.build_sql(found, '2026-10-26T00:00:00+00:00')
        self.assertIn('on conflict (player_id, season_start_year, season_type)', sql)
        self.assertIn('1628389, 2025', sql)
        self.assertNotIn('203507, 2025', sql)


if __name__ == '__main__':
    unittest.main()
