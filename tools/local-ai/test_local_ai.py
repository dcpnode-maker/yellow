import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parent


class LocalAiLauncherTests(unittest.TestCase):
    def test_local_lanes_are_sandboxed_without_bypass(self) -> None:
        script = (ROOT / "yellow-ai.ps1").read_text(encoding="utf-8")
        self.assertIn("'workspace-write'", script)
        self.assertIn("'read-only'", script)
        self.assertNotIn("dangerously-bypass", script)
        self.assertIn("127.0.0.1:11434", script)
        self.assertIn("qwen3.5:9b", script)
        self.assertIn("OLLAMA_IGPU_ENABLE", script)
        self.assertIn("OLLAMA_VULKAN", script)

    def test_host_manifest_is_exact_and_non_destructive(self) -> None:
        script = (ROOT / "yellow-host.ps1").read_text(encoding="utf-8")
        for container_id in (
            "9f507e09cc38",
            "781c68656c43",
            "dbe35dabd624",
            "e17219ecd7aa",
        ):
            self.assertIn(container_id, script)
        self.assertNotIn("docker rm", script)
        self.assertNotIn("docker volume", script)
        self.assertIn("$null = & docker info", script)
        self.assertIn("return [bool]($LASTEXITCODE -eq 0)", script)

    def test_phone_installer_does_not_print_pairing_secret(self) -> None:
        script = (ROOT / "yellow-phone.ps1").read_text(encoding="utf-8")
        self.assertIn("RedirectStandardInput", script)
        self.assertNotIn("Write-Output $PairingCode", script)
        self.assertIn("127.0.0.1", script)
        self.assertNotIn("0.0.0.0", script)

    def test_workers_are_independent_and_ports_are_unique(self) -> None:
        payload = json.loads((ROOT / "workers.json").read_text(encoding="utf-8"))
        workers = payload["workers"]
        self.assertEqual(3, len(workers))
        self.assertEqual({11435, 11436, 11437}, {w["laptop_port"] for w in workers})
        by_id = {worker["id"]: worker for worker in workers}
        self.assertEqual("independently-accepted-supervised-proposal-worker", by_id["oneplus-10r"]["status"])
        self.assertEqual("independently-accepted-supervised-proposal-worker", by_id["oneplus-11r"]["status"])
        self.assertEqual("awaiting-pairing", by_id["oneplus-nord5"]["status"])
        self.assertEqual("127.0.0.1", by_id["oneplus-11r"]["ssh_host"])

    def test_dispatcher_is_private_bounded_and_parallel(self) -> None:
        script = (ROOT / "dispatch_local_workers.py").read_text(encoding="utf-8")
        self.assertIn("ThreadPoolExecutor", script)
        self.assertIn('"laptop": {"url": "http://127.0.0.1:11434"', script)
        self.assertIn('"oneplus10r": {"url": "http://127.0.0.1:11435"', script)
        self.assertIn('"oneplus11r": {"url": "http://127.0.0.1:11436"', script)
        self.assertIn("yellow-local-ai\" / \"results", script)
        self.assertNotIn("print(key", script)


if __name__ == "__main__":
    unittest.main()
