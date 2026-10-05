"""Reviewed, complete Worker 2 v2 test output; evaluation fixture only.

Manually transcribed after inspection. One requirement, multibyte UTF-8 limits,
was omitted by the model and is covered separately in test_candidate_utf8.py.
"""

import unittest
import json
import sys
sys.path.insert(0, '.')
from harness_candidate import strict_object

class TestStrictObject(unittest.TestCase):
    def test_non_str(self):
        with self.assertRaises(TypeError):
            strict_object(123)
    def test_valid_nested(self):
        self.assertEqual(strict_object('{"a": {"b": [1, 2]}}'), {"a": {"b": [1, 2]}})
    def test_whitespace(self):
        self.assertEqual(strict_object('  {"a": 1}  '), {"a": 1})
    def test_array_reject(self):
        with self.assertRaises(ValueError):
            strict_object('[1, 2]')
    def test_scalar_reject(self):
        with self.assertRaises(ValueError):
            strict_object('123')
    def test_trailing(self):
        with self.assertRaises(ValueError):
            strict_object('{"a": 1} extra')
    def test_dup_top(self):
        with self.assertRaises(ValueError):
            strict_object('{"a": 1, "a": 2}')
    def test_dup_nested(self):
        with self.assertRaises(ValueError):
            strict_object('{"a": [{"b": 1, "b": 2}]}')
    def test_nan(self):
        with self.assertRaises(ValueError):
            strict_object('{"a": NaN}')
    def test_inf(self):
        with self.assertRaises(ValueError):
            strict_object('{"a": Infinity}')
    def test_neg_inf(self):
        with self.assertRaises(ValueError):
            strict_object('{"a": -Infinity}')
    def test_over_1024(self):
        s = '{"a": "' + 'x' * 1020 + '"}'
        if len(s.encode('utf-8')) <= 1024:
            s = '{"a": "' + 'x' * 1030 + '"}'
        with self.assertRaises(ValueError):
            strict_object(s)
    def test_exactly_1024(self):
        key = 'k'
        val_len = 1024 - len(('{"%s": "%s"}' % (key, '')).encode('utf-8'))
        val = 'x' * val_len
        s = '{"%s": "%s"}' % (key, val)
        assert len(s.encode('utf-8')) == 1024
        self.assertEqual(strict_object(s), {key: val})

if __name__ == '__main__':
    unittest.main()
