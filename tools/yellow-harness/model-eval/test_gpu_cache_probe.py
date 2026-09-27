"""Local no-Kaggle contract test for Worker 2 cache preflight."""

import importlib.util
from pathlib import Path
import tempfile
import unittest


MODULE_PATH = Path(__file__).with_name("kaggle_gpu_cache_probe.py")
SPEC = importlib.util.spec_from_file_location("yellow_gpu_cache_probe", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class CacheProbeTest(unittest.TestCase):
    def test_bounded_temp_write_is_removed(self):
        with tempfile.TemporaryDirectory() as root:
            cache = Path(root) / "cache"
            result = MODULE.collect(cache)
            self.assertEqual(result["schema"], "yellow-gpu-cache-probe-v1")
            self.assertTrue(result["write_ok"])
            self.assertEqual(list(cache.iterdir()), [])
            self.assertGreater(result["free_bytes"], 0)


if __name__ == "__main__":
    unittest.main()
