"""Small no-accelerator checks for the notebook probe contract."""

from __future__ import annotations

import importlib.util
import ast
from pathlib import Path
import unittest
from unittest.mock import patch


SOURCE = Path(__file__).with_name("hardware_probe.py")
SPEC = importlib.util.spec_from_file_location("hardware_probe", SOURCE)
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class HardwareProbeTest(unittest.TestCase):
    def test_notebook_cell_is_syntax_valid_and_bounded(self) -> None:
        source = Path(__file__).with_name("kaggle_gpu_cell.py").read_text(encoding="utf-8")
        ast.parse(source)
        self.assertNotIn("os.environ", source)
        self.assertNotIn("/kaggle/input", source)
        self.assertNotIn("http", source)
        self.assertIn("torch.ones((128,128)", source)

    def test_tpu_cell_is_syntax_valid_and_synthetic(self) -> None:
        source = Path(__file__).with_name("kaggle_tpu_cell.py").read_text(encoding="utf-8")
        ast.parse(source)
        self.assertNotIn("os.environ", source)
        self.assertNotIn("/kaggle/input", source)
        self.assertNotIn("http", source)
        self.assertIn("jax.devices()", source)
        self.assertIn("jnp.ones((128, 128)", source)

    def test_memory_parser(self) -> None:
        self.assertEqual(module.memory_bytes("MemTotal:       2048 kB\nMemFree: 1 kB"), 2097152)
        self.assertIsNone(module.memory_bytes("MemTotal: invalid kB"))
        self.assertIsNone(module.memory_bytes(""))

    def test_cpu_receipt_has_only_hardware_fields(self) -> None:
        with patch.object(module.Path, "read_text", return_value="MemTotal: 1024 kB"):
            receipt = module.cpu_snapshot()
        self.assertEqual(receipt["schema"], "yellow-hardware-probe-v1")
        self.assertEqual(receipt["ram_bytes"], 1048576)
        self.assertEqual(receipt["accelerator"], "none")
        self.assertEqual(receipt["devices"], [])
        self.assertEqual(
            set(receipt),
            {"schema", "python", "system", "cpu_count", "ram_bytes", "accelerator", "devices", "checks"},
        )


if __name__ == "__main__":
    unittest.main()
