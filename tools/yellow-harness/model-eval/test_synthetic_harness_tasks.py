"""Local contracts; no Kaggle connection or model process is used in these tests."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


SPEC = spec_from_file_location("yellow_synthetic_tasks", Path(__file__).with_name("kaggle_synthetic_harness_tasks.py"))
assert SPEC and SPEC.loader
tasks = module_from_spec(SPEC)
SPEC.loader.exec_module(tasks)


class SyntheticHarnessTaskTest(unittest.TestCase):
    def test_only_fixed_prompts_can_be_dispatched(self):
        self.assertEqual(len(tasks.TASKS), 3)
        with self.assertRaises(ValueError):
            tasks.task_command("../../private-file")

    def test_test_revision_requires_compact_fail_closed_tests(self):
        prompt = tasks.TASKS["worker2-parser-tests-v2"]
        self.assertIn("No import fallback", prompt)
        self.assertIn("never assertRaises(Exception)", prompt)
        self.assertIn("actual encoded lengths", prompt)

    def test_commands_are_bounded_non_thinking_and_single_turn(self):
        for task_id in tasks.TASKS:
            command = tasks.task_command(task_id)
            self.assertIn("--single-turn", command)
            self.assertEqual(command[command.index("--reasoning") + 1], "off")
            self.assertEqual(command[command.index("--n-predict") + 1], "1024")
            self.assertEqual(command[command.index("--ctx-size") + 1], "4096")

    def test_missing_setup_fails_before_launch(self):
        with patch.object(tasks.MODEL.__class__, "is_file", return_value=False), \
             patch.object(tasks.subprocess, "run", side_effect=AssertionError("Launched")):
            with self.assertRaisesRegex(RuntimeError, "setup must finish"):
                tasks.run_task("worker1-parser-proposal")

    def test_timeout_receipt_keeps_diagnostics_without_executing_output(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(tasks, "ROOT", Path(directory)), \
                 patch.object(tasks, "verify_model"), \
                 patch.object(tasks.subprocess, "run", side_effect=subprocess.TimeoutExpired(
                     ["llama-cli"], 300, output=b"partial", stderr=b"load progress")) as run:
                receipt = tasks.run_task("worker2-parser-tests")
            self.assertEqual(run.call_args.kwargs["stdin"], subprocess.DEVNULL)
            self.assertEqual(run.call_args.kwargs["timeout"], 300)
            self.assertEqual(receipt["status"], "timeout")
            self.assertEqual(receipt["stdout"], "partial")
            self.assertFalse(receipt["generated_code_executed"])
            self.assertFalse(receipt["source_applied"])


if __name__ == "__main__":
    unittest.main()
