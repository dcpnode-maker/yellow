"""Local contract checks that do not require a Kaggle runtime."""

import importlib.util
import pathlib
import unittest


MODULE_PATH = pathlib.Path(__file__).with_name("kaggle_gpu_preflight.py")
SPEC = importlib.util.spec_from_file_location("yellow_gpu_preflight", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class PreflightTest(unittest.TestCase):
    def test_schema_and_bounds(self):
        result = MODULE.collect()
        self.assertEqual(result["schema"], "yellow-gpu-preflight-v1")
        self.assertEqual(result["model_gguf_gb"], 16.5)
        self.assertIsInstance(result["download_space_ok"], bool)
        self.assertEqual(set(result["commands"]), {"cmake", "c++", "nvcc", "llama-cli", "llama-server"})
        self.assertEqual(set(result["packages"]), {"torch", "huggingface_hub", "llama_cpp"})


if __name__ == "__main__":
    unittest.main()
