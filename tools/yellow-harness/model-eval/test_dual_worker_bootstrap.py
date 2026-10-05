"""Local no-network contracts for the two-Kaggle-worker setup cell."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).with_name("kaggle_dual_worker_bootstrap.py")
SPEC = spec_from_file_location("yellow_dual_worker_bootstrap", SCRIPT)
assert SPEC and SPEC.loader
worker = module_from_spec(SPEC)
SPEC.loader.exec_module(worker)


class DualWorkerBootstrapTest(unittest.TestCase):
    def test_model_identity_and_runtime_are_pinned(self) -> None:
        self.assertEqual(worker.MODEL_BYTES, 16_464_440_224)
        self.assertEqual(worker.MODEL_REVISION, "4ca720788d1e01f1bff70c033e0d0028fd02e502")
        self.assertEqual(worker.LLAMA_COMMIT, "c8296709920f9c1ae168bfd5fe66f9f73637bd60")

    def test_probe_is_bounded_single_turn_and_non_thinking(self) -> None:
        command = worker.inference_command()
        for flag in ("--single-turn", "--no-display-prompt", "--reasoning", "off"):
            self.assertIn(flag, command)
        self.assertEqual(command[command.index("--n-predict") + 1], "384")
        self.assertEqual(command[command.index("--ctx-size") + 1], "2048")

    def test_existing_model_with_wrong_hash_fails_before_download(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / worker.MODEL_NAME
            path.write_bytes(b"bad")
            with patch.object(worker, "MODEL", path):
                with self.assertRaisesRegex(RuntimeError, "wrong size/hash"):
                    worker.prepare_model()

    def test_no_model_with_insufficient_space_fails_before_download(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / worker.MODEL_NAME
            with patch.object(worker, "MODEL", path), \
                 patch.object(worker, "ROOT", Path(directory)), \
                 patch.object(worker.shutil, "disk_usage", return_value=SimpleNamespace(free=1)):
                with self.assertRaisesRegex(RuntimeError, "Insufficient"):
                    worker.prepare_model()


if __name__ == "__main__":
    unittest.main()
