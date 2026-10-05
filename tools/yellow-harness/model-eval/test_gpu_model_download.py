"""No-network model download metadata test."""

import importlib.util
from pathlib import Path
import tempfile
import unittest


MODULE_PATH = Path(__file__).with_name("kaggle_gpu_model_download.py")
SPEC = importlib.util.spec_from_file_location("yellow_gpu_model_download", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ModelDownloadTest(unittest.TestCase):
    def test_pinned_public_asset_and_hasher(self):
        self.assertEqual(len(MODULE.REVISION), 40)
        self.assertEqual(len(MODULE.EXPECTED_SHA256), 64)
        self.assertGreater(MODULE.EXPECTED_BYTES, 16_000_000_000)
        with tempfile.TemporaryDirectory() as root:
            sample = Path(root) / "sample"
            sample.write_bytes(b"yellow-public-test")
            self.assertEqual(MODULE.sha256(sample),
                             "d7cc00e9bf9e5f85be633f1953f882493f58014bd2873127677b728a8f381465")


if __name__ == "__main__":
    unittest.main()
