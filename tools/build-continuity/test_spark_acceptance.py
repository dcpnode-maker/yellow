"""Execute the inspected, bounded synthetic Spark response; never fetch a model."""
import json
import unittest
from pathlib import Path


class SparkAcceptance(unittest.TestCase):
    def test_observed_code(self):
        proof = json.loads(Path(__file__).with_name("spark-proof-20260913.json").read_text())
        namespace = {"__builtins__": {"isinstance": isinstance, "list": list, "str": str, "set": set, "TypeError": TypeError}}
        exec(compile(proof["source"], "inspected-spark-proposal", "exec"), namespace)
        function = namespace["unique_names"]
        cases = [([], []), ([" a ", "A", "b"], ["a", "b"]), (["", "  ", "\n"], []),
                 (["Straße", "STRASSE"], ["Straße"]), (["Σ", "ς", "σ"], ["Σ"]),
                 (["नमस्ते", " नमस्ते ", " مرحبا "], ["नमस्ते", "مرحبا"]),
                 (["z", "a", "z", "B"], ["z", "a", "B"]), (["\tx\n", " y "], ["x", "y"])]
        for values, expected in cases:
            with self.subTest(values=values):
                before = values.copy()
                self.assertEqual(function(values), expected)
                self.assertEqual(values, before)
        for invalid in (None, "abc", ("a",), 7, ["a", 1], [None]):
            with self.subTest(invalid=invalid), self.assertRaises(TypeError):
                function(invalid)


if __name__ == "__main__":
    unittest.main()
