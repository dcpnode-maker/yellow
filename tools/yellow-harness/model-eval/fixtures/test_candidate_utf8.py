"""Operator-added contract checks for gaps in the generated test proposal."""

import unittest

from harness_candidate import strict_object


class CandidateUtf8Test(unittest.TestCase):
    def test_multibyte_characters_are_counted_as_bytes(self):
        text = '{"label":"' + '\u00e9' * 600 + '"}'
        self.assertLess(len(text), 1024)
        self.assertGreater(len(text.encode('utf-8')), 1024)
        with self.assertRaises(ValueError):
            strict_object(text)

    def test_multibyte_exact_boundary_is_accepted(self):
        prefix, suffix = '{"x":"', '"}'
        count = (1024 - len((prefix + suffix).encode('utf-8'))) // 2
        text = prefix + '\u00e9' * count + suffix
        self.assertEqual(len(text.encode('utf-8')), 1024)
        self.assertEqual(strict_object(text), {"x": '\u00e9' * count})

    def test_duplicate_escaped_key_is_rejected(self):
        with self.assertRaises(ValueError):
            strict_object(r'{"a":1,"\u0061":2}')


if __name__ == '__main__':
    unittest.main()
