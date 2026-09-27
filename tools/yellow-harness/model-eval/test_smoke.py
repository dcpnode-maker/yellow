"""Local contract checks that do not download model weights."""

from __future__ import annotations

import importlib.util
import ast
from pathlib import Path
import re
import unittest


SOURCE = Path(__file__).with_name("kaggle_smoke.py")
SPEC = importlib.util.spec_from_file_location("yellow_model_smoke", SOURCE)
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class ModelSmokeTest(unittest.TestCase):
    def test_model_and_output_are_fixed_and_bounded(self) -> None:
        self.assertEqual(module.MODEL_ID, "Qwen/Qwen2.5-Coder-1.5B-Instruct")
        self.assertRegex(module.REVISION, re.compile(r"^[0-9a-f]{40}$"))
        self.assertLessEqual(module.MAX_NEW_TOKENS, 256)
        self.assertIn("two assert tests", module.PROMPT)

    def test_no_source_execution_or_private_inputs(self) -> None:
        source = SOURCE.read_text(encoding="utf-8")
        tree = ast.parse(source)
        calls = (node for node in ast.walk(tree) if isinstance(node, ast.Call))
        self.assertFalse(any(
            isinstance(call.func, ast.Name) and call.func.id in {"exec", "eval"}
            for call in calls
        ))
        self.assertNotIn("/kaggle/input", source)
        self.assertNotIn("os.environ", source)
        self.assertNotIn("trust_remote_code=True", source)


if __name__ == "__main__":
    unittest.main()
