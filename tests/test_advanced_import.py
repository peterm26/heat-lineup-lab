"""Synthetic fixtures; never used in the real stats import."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import prepare_advanced_import as advanced


def row():
    value = {header: '0' for header in advanced.METRICS.values()}
    value.update(Player='Nick Richards', Team='2TM', Pos='C', Age='28', G='10',
                 GS='2', MP='100', **{'Player-additional': 'richani01', 'TS%': '.562'})
    return value


class AdvancedTests(unittest.TestCase):
    def test_combined_row_is_selected_without_averaging(self):
        combined = row()
        first = dict(combined, Team='PHO', G='4', MP='30')
        second = dict(combined, Team='CHI', G='6', MP='70')
        result = advanced.choose_rows([first, combined, second], {1630208: 'Nick Richards'})
        self.assertEqual(result[1630208]['Team'], '2TM')
        self.assertEqual(result[1630208]['TS%'], '.562')

    def test_mismatched_split_totals_are_rejected(self):
        combined = row()
        with self.assertRaisesRegex(ValueError, 'inconsistent'):
            advanced.choose_rows([combined, dict(combined, Team='PHO', G='9')],
                                 {1630208: 'Nick Richards'})

    def test_unlabelled_duplicate_rows_are_rejected(self):
        first = dict(row(), Team='PHO')
        with self.assertRaisesRegex(ValueError, 'ambiguous'):
            advanced.choose_rows([first, first], {1630208: 'Nick Richards'})

    def test_source_decimals_are_kept_or_converted_explicitly(self):
        value = row()
        value['3PAr'] = '.090'
        value['TOV%'] = '19.4'
        value['OBPM'] = '-4.9'
        chosen = advanced.choose_rows([value], {1630208: 'Nick Richards'})
        sql = advanced.build_sql(chosen, '0' * 64)
        self.assertIn('56.200, 0.090', sql)
        self.assertIn('19.4', sql)
        self.assertIn('-4.9', sql)
        self.assertIn('security_invoker = true', sql)
        self.assertIn('on conflict (player_id', sql)

    def test_missing_values_stay_null(self):
        value = row()
        value['TS%'] = ''
        sql = advanced.build_sql({1630208: value}, '0' * 64)
        self.assertIn('NULL', sql)

    def test_invalid_rate_is_rejected(self):
        value = row()
        value['3PAr'] = '9.0'
        with self.assertRaisesRegex(ValueError, 'three-point'):
            advanced.choose_rows([value], {1630208: 'Nick Richards'})


if __name__ == '__main__':
    unittest.main()
