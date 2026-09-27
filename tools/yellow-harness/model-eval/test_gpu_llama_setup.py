"""Offline integrity and extraction checks for the pinned CUDA runtime cell."""

import importlib.util
import io
from pathlib import Path
import tarfile
import tempfile
import unittest


MODULE_PATH = Path(__file__).with_name("kaggle_gpu_llama_setup.py")
SPEC = importlib.util.spec_from_file_location("yellow_gpu_llama_setup", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class SetupTest(unittest.TestCase):
    def test_release_assets_are_pinned(self):
        self.assertEqual(MODULE.VERSION, "b11216")
        self.assertEqual(len(MODULE.ASSETS), 2)
        for name, size, sha in MODULE.ASSETS:
            self.assertTrue(name.endswith(".tar.gz"))
            self.assertGreater(size, 100_000_000)
            self.assertEqual(len(sha), 64)

    def test_data_filter_rejects_archive_traversal(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            archive = base / "hostile.tar.gz"
            with tarfile.open(archive, "w:gz") as output:
                contents = b"not allowed"
                info = tarfile.TarInfo("../escape.txt")
                info.size = len(contents)
                output.addfile(info, io.BytesIO(contents))
            with self.assertRaises(tarfile.TarError):
                MODULE.extract(archive, base / "destination")
            self.assertFalse((base / "escape.txt").exists())


if __name__ == "__main__":
    unittest.main()
