"""Offline proof for the bounded Yellow continuity bridge."""

from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


ADAPTER_FILE = Path(__file__).with_name("adapter.py")
SPEC = importlib.util.spec_from_file_location("yellow_harness_continuity_adapter", ADAPTER_FILE)
assert SPEC and SPEC.loader
adapter = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(adapter)


def git(repo: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(repo), *args], text=True).strip()


class ContinuityBridgeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name) / "repo"
        self.repo.mkdir()
        git(self.repo, "init")
        git(self.repo, "config", "user.email", "test@example.invalid")
        git(self.repo, "config", "user.name", "Yellow test")
        for name in ("PROJECT.md", "AGENTS.md", "docs/CODEX.md",
                     "handoff/orders/685-test.md", "input.txt"):
            path = self.repo / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("Synthetic public fixture\n", encoding="utf-8")
        git(self.repo, "add", ".")
        git(self.repo, "commit", "-m", "fixture")
        self.head = git(self.repo, "rev-parse", "HEAD")
        self.controller_module, self.continuity = adapter.load_components()
        self.controller = self.controller_module.Controller(self.repo)
        self.manifest = {
            "id": "order-685-test",
            "base_sha": self.head,
            "order": "handoff/orders/685-test.md",
            "inputs": ["input.txt"],
            "outputs": ["answer.txt"],
            "goal": "Propose a synthetic answer",
            "capability": "code",
            "data_classification": "public_source",
        }
        self.config = Path(self.temp.name) / "routes.json"
        self.config.write_text(json.dumps({"routes": [
            {"provider": "openrouter", "model": "qwen/qwen3-coder:free"}
        ], "max_attempts": 1, "max_output_tokens": 512}), encoding="utf-8")

    def submit_ready_lease(self) -> dict:
        self.controller.register_worker("local-worker", ["code"])
        self.controller.submit(self.manifest, now=10)
        self.controller.approve(self.manifest["id"], now=11)
        lease = self.controller.claim("local-worker", now=12)
        assert lease
        return lease

    def proposal_runner(self, proposal: dict, state: dict | None = None):
        def run(root: Path, task_path: Path, config_path: Path):
            task = json.loads(task_path.read_text(encoding="utf-8"))
            directory = self.continuity.private_directory(root, task["id"])
            (directory / "proposal.json").write_text(json.dumps(proposal), encoding="utf-8")
            retained = state or {"status": "proposed", "attempts": [{"status": "proposed"}]}
            (directory / "state.json").write_text(json.dumps(retained), encoding="utf-8")
            return directory, retained
        return run

    def test_offline_preview_validates_without_claim_database_or_provider(self) -> None:
        manifest_path = Path(self.temp.name) / "task.json"
        manifest_path.write_text(json.dumps(self.manifest), encoding="utf-8")
        # setUp constructs the controller for other cases; remove its test DB so
        # this assertion measures only preview's effects.
        database = self.repo / ".git/yellow-harness/state.sqlite3"
        database.unlink(missing_ok=True)
        database.parent.rmdir()
        stdout = io.StringIO()
        with contextlib.redirect_stdout(stdout), patch.object(adapter, "run_claim") as live:
            result = adapter.main(["--repo", str(self.repo), "--manifest", str(manifest_path),
                                   "--config", str(self.config)])
        self.assertEqual(result, 0)
        self.assertFalse(live.called)
        printed = json.loads(stdout.getvalue())
        self.assertEqual(printed["mode"], "offline_preview")
        self.assertFalse(printed["network_called"])
        self.assertEqual(printed["base_sha"], self.head)
        self.assertFalse((self.repo / ".git/yellow-harness/state.sqlite3").exists())

    def test_successful_exact_proposal_completes_controller_task(self) -> None:
        lease = self.submit_ready_lease()
        proposal = {"summary": "Synthetic proposal", "files": {"answer.txt": "hello\n"},
                    "remaining": ["Coordinator review"]}
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "mock-account-key"}):
            result = adapter.run_claim(self.repo, "local-worker", self.config,
                                       self.controller_module, self.continuity,
                                       runner=self.proposal_runner(proposal))
        self.assertEqual(result["status"], "completed")
        self.assertEqual(self.controller.status(self.manifest["id"])["state"], "completed")
        self.assertEqual(self.controller.result(self.manifest["id"]),
                         {"files": proposal["files"], "summary": proposal["summary"]})
        self.assertNotIn(lease["lease_token"], json.dumps(result))
        self.assertFalse((self.repo / "answer.txt").exists())

    def test_out_of_scope_proposal_is_not_completed(self) -> None:
        self.submit_ready_lease()
        proposal = {"summary": "Hostile", "files": {"answer.txt": "ok", "escape.txt": "bad"},
                    "remaining": []}
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "mock-account-key"}):
            result = adapter.run_claim(self.repo, "local-worker", self.config,
                                       self.controller_module, self.continuity,
                                       runner=self.proposal_runner(proposal))
        self.assertEqual(result["status"], "proposal_scope_rejected")
        self.assertEqual(self.controller.status(self.manifest["id"])["state"], "leased")
        with self.assertRaises(self.controller_module.HarnessError):
            self.controller.result(self.manifest["id"])

    def test_failed_continuity_response_keeps_lease_and_attempt_receipt(self) -> None:
        self.submit_ready_lease()
        failed = {"status": "blocked", "attempts": [{"status": "failed", "error_type": "Blocked"}]}
        proposal = {"summary": "Must not be consumed", "files": {"answer.txt": "bad"}, "remaining": []}
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "mock-account-key"}):
            result = adapter.run_claim(self.repo, "local-worker", self.config,
                                       self.controller_module, self.continuity,
                                       runner=self.proposal_runner(proposal, failed))
        self.assertEqual(result["status"], "proposal_not_accepted")
        self.assertEqual(self.controller.status(self.manifest["id"])["state"], "leased")
        state_path = self.repo / ".git/yellow-continuity/order-685-test/state.json"
        self.assertEqual(json.loads(state_path.read_text(encoding="utf-8")), failed)

    def test_live_mode_requires_account_key_and_official_route(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(adapter.BridgeError):
                adapter.run_claim(self.repo, "local-worker", self.config,
                                  self.controller_module, self.continuity,
                                  runner=lambda *args: self.fail("Provider path called"))
        bad = Path(self.temp.name) / "bad-routes.json"
        bad.write_text(json.dumps({"routes": [{"provider": "openrouter", "model": "paid/model"}]}),
                       encoding="utf-8")
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "mock-account-key"}):
            with self.assertRaises(adapter.BridgeError):
                adapter.run_claim(self.repo, "local-worker", bad,
                                  self.controller_module, self.continuity,
                                  runner=lambda *args: self.fail("Provider path called"))

    def test_non_code_task_is_rejected_before_provider_call(self) -> None:
        self.manifest["capability"] = "browser"
        with self.assertRaises(adapter.BridgeError):
            adapter.preview(self.repo, self.manifest,
                            self.controller_module, self.continuity)


if __name__ == "__main__":
    unittest.main()
