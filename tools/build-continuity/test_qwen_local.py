"""Static proof that resource gates precede any native process launch or pull."""
from pathlib import Path
import unittest


def test_qwen_launcher_guards():
    source = Path(__file__).with_name("qwen-local.ps1").read_text(encoding="utf-8")
    ram = source.index("if ($freeRamGiB -lt 4)")
    disk = source.index("if ($freeDiskGiB -lt 5)")
    start = source.index("Start-Process -FilePath $ollamaExe")
    pull = source.index('$endpoint/api/pull')
    assert ram < start and disk < start
    assert disk < pull
    assert "-TimeoutSec 600" in source
    assert "num_ctx=2048" in source
    assert "keep_alive=0" in source
    assert "think=$false" in source


class QwenStaticGuards(unittest.TestCase):
    def test_guard_placement(self):
        test_qwen_launcher_guards()


if __name__ == "__main__":
    unittest.main()
