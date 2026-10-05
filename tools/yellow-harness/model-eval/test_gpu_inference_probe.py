"""Local contract checks for the bounded, synthetic GPU coding trial."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import subprocess
from types import SimpleNamespace
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).with_name("kaggle_gpu_inference_probe.py")
SPEC = spec_from_file_location("yellow_gpu_inference_probe", SCRIPT)
assert SPEC and SPEC.loader
probe = module_from_spec(SPEC)
SPEC.loader.exec_module(probe)

SAMPLE_SPEC = spec_from_file_location(
    "yellow_qwen38_sample_output", SCRIPT.with_name("qwen38_sample_output.py")
)
assert SAMPLE_SPEC and SAMPLE_SPEC.loader
sample = module_from_spec(SAMPLE_SPEC)
SAMPLE_SPEC.loader.exec_module(sample)


class GpuInferenceProbeTest(unittest.TestCase):
    def test_two_gpu_memory_values_are_parsed(self) -> None:
        completed = SimpleNamespace(returncode=0, stdout="123 MiB\n456 MiB\n")
        with patch.object(probe.subprocess, "run", return_value=completed):
            self.assertEqual(probe.memory_mb(), [])
        completed.stdout = "123\n456\n"
        with patch.object(probe.subprocess, "run", return_value=completed):
            self.assertEqual(probe.memory_mb(), [123, 456])

    def test_missing_model_or_binary_blocks_before_process_launch(self) -> None:
        with patch.object(probe.BINARY.__class__, "is_file", return_value=False), \
             patch.object(probe.subprocess, "run", side_effect=AssertionError("Launched")):
            with self.assertRaisesRegex(RuntimeError, "unavailable"):
                probe.run_probe()

    def test_single_turn_and_bounded_timeout_preserve_partial_diagnostics(self) -> None:
        timeout = subprocess.TimeoutExpired(["llama-cli"], 600,
                                            output=b"partial answer",
                                            stderr=b"load progress")
        with patch.object(probe.BINARY.__class__, "is_file", return_value=True), \
             patch.object(probe.MODEL.__class__, "stat",
                          return_value=SimpleNamespace(st_size=123)), \
             patch.object(probe, "memory_mb", return_value=[0, 0]), \
             patch.object(probe.subprocess, "run", side_effect=timeout) as run:
            result = probe.run_probe()
        command = run.call_args.args[0]
        self.assertIn("--single-turn", command)
        self.assertEqual(run.call_args.kwargs["stdin"], subprocess.DEVNULL)
        self.assertEqual(result["status"], "timeout")
        self.assertEqual(result["returncode"], None)
        self.assertEqual(result["stdout"], "partial answer")
        self.assertEqual(result["stderr"], "load progress")


class Qwen38SampleRubricTest(unittest.TestCase):
    def test_empty_and_sorted_disjoint(self) -> None:
        self.assertEqual(sample.coalesce_nights([]), [])
        self.assertEqual(sample.coalesce_nights([(8, 9), (1, 2)]), [(1, 2), (8, 9)])

    def test_overlap_and_adjacency(self) -> None:
        self.assertEqual(sample.coalesce_nights([(5, 7), (1, 2), (3, 4)]), [(1, 7)])
        self.assertEqual(sample.coalesce_nights([(1, 6), (4, 8)]), [(1, 8)])

    def test_does_not_mutate_input(self) -> None:
        stays = [(5, 7), (1, 2), (3, 4)]
        before = stays.copy()
        sample.coalesce_nights(stays)
        self.assertEqual(stays, before)

    def test_rejects_reversed_stay(self) -> None:
        with self.assertRaises(ValueError):
            sample.coalesce_nights([(1, 2), (9, 8)])


if __name__ == "__main__":
    unittest.main()
