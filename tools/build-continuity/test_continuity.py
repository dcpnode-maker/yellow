import copy
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import urllib.error
import threading

import continuity as c
import batch


class ContinuityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in [*c.CANONICAL, "handoff/orders/TEST.md", "input.txt"]:
            p = self.root / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text("Synthetic public fixture\n", encoding="utf-8")
        def g(*args):
            return subprocess.check_output(["git", "-C", str(self.root), *args], text=True, stderr=subprocess.DEVNULL).strip()
        g("init")
        g("add", ".")
        g("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "fixture")
        self.task = {"id": "fixture", "base_sha": g("rev-parse", "HEAD"),
                     "order": "handoff/orders/TEST.md", "inputs": ["input.txt"],
                     "outputs": ["answer.txt"], "goal": "Produce a synthetic answer"}
        self.cfg = {"max_attempts": 2, "max_output_tokens": 512, "routes": [
            {"provider": "openrouter", "model": "qwen/qwen3-coder:free"},
            {"provider": "openrouter", "model": "openrouter/free"}]}
        self.manifest = self.root / ".git/task.json"
        self.config = self.root / ".git/routes.json"
        self.manifest.write_text(json.dumps(self.task))
        self.config.write_text(json.dumps(self.cfg))
        self.answer = json.dumps({"summary": "Synthetic proposal", "files": {"answer.txt": "hello\n"}, "remaining": ["Coordinator review"]})
        self.symlink_supported = None

    def _ensure_symlink_support(self, link_path, target_path, target_is_directory=False):
        try:
            if target_is_directory:
                link_path.symlink_to(target_path, target_is_directory=True)
            else:
                link_path.symlink_to(target_path)
            self.addCleanup(link_path.unlink, missing_ok=True)
            self.symlink_supported = True
            return True
        except OSError as error:
            if getattr(error, "winerror", None) == 1314:
                self.skipTest("Symlink creation unavailable on this Windows host without Developer Mode privileges")
            raise

    def run_worker(self, caller):
        return c.run_task(self.root, self.manifest, self.config, caller=caller)

    def test_private_proposal_no_checkout_mutation_and_idempotent_resume(self):
        before = c.git(self.root, "status", "--porcelain")
        directory, state = self.run_worker(lambda *a: (self.answer, {"total_tokens": 12}))
        self.assertEqual(state["status"], "proposed")
        self.assertFalse((self.root / "answer.txt").exists())
        self.assertEqual(c.git(self.root, "status", "--porcelain"), before)
        self.assertEqual(json.loads((directory / "proposal.json").read_text())["files"]["answer.txt"], "hello\n")
        self.run_worker(lambda *a: self.fail("Completed work called twice"))

    def test_invalid_response_falls_back_with_same_instructions_and_durable_context(self):
        seen = []
        def caller(route, messages, budget):
            seen.append(copy.deepcopy(messages))
            return ("not json" if len(seen) == 1 else self.answer), {}
        _, state = self.run_worker(caller)
        self.assertEqual(state["status"], "proposed")
        self.assertEqual(len(state["attempts"]), 2)
        self.assertEqual(seen[0][:2], seen[1][:2])
        self.assertEqual(seen[1][2]["content"], "not json")

    def test_exhaustion_cannot_reset_by_restarting(self):
        _, state = self.run_worker(lambda *a: ("invalid", {}))
        self.assertEqual(state["status"], "blocked")
        self.run_worker(lambda *a: self.fail("Budget reset on resume"))

    def test_crash_reserves_call_before_network(self):
        def crash(*args):
            raise KeyboardInterrupt()
        with self.assertRaises(KeyboardInterrupt):
            self.run_worker(crash)
        _, state = self.run_worker(lambda *a: (self.answer, {}))
        self.assertEqual(len(state["attempts"]), 2)
        self.assertEqual(state["attempts"][0]["status"], "reserved")

    def test_quota_wait_survives_restart(self):
        def quota(*args):
            raise urllib.error.HTTPError("https://example.invalid", 429, "limit", {"Retry-After": "3600"}, io.BytesIO())
        _, state = self.run_worker(quota)
        self.assertEqual(state["status"], "quota_wait")
        self.run_worker(lambda *a: self.fail("Shared quota bypassed"))

    def test_access_block_does_not_try_another_model_in_same_run(self):
        calls = []
        def denied(*args):
            calls.append(1)
            raise urllib.error.HTTPError("https://example.invalid", 403, "denied", {}, io.BytesIO())
        _, state = self.run_worker(denied)
        self.assertEqual(state["status"], "access_blocked")
        self.assertEqual(len(calls), 1)

    def test_source_mutation_during_inference_rejects_proposal(self):
        def mutate(*args):
            (self.root / "input.txt").write_text("changed")
            return self.answer, {}
        directory, state = self.run_worker(mutate)
        self.assertNotEqual(state["status"], "proposed")
        self.assertFalse((directory / "proposal.json").exists())

    def test_changed_task_or_base_is_rejected(self):
        self.run_worker(lambda *a: (self.answer, {}))
        self.task["goal"] = "Different goal"
        self.manifest.write_text(json.dumps(self.task))
        with self.assertRaises(c.Blocked):
            self.run_worker(lambda *a: self.fail("Changed task called provider"))
        self.task["base_sha"] = "0" * 40
        with self.assertRaises(c.Blocked):
            c.context_for(self.root, self.task)

    def test_traversal_hidden_credentials_and_symlink_rejected(self):
        for name in ["../outside", "/outside", ".env", ".git/config", "x/../out", "x\\out", "C:/out", "x//out", "secrets/key.txt"]:
            with self.subTest(name=name), self.assertRaises(c.Blocked):
                c.safe_path(self.root, name)
        self._ensure_symlink_support(self.root / "link", self.root.parent, target_is_directory=True)
        with self.assertRaises(c.Blocked):
            c.safe_path(self.root, "link/out")

    def test_output_scope_and_paid_endpoint_rejection(self):
        with self.assertRaises(c.Blocked):
            c.parse_proposal(self.answer, [])
        for route in [{"provider": "openrouter", "model": "paid/model"},
                      {"provider": "zen", "model": "paid"},
                      {"provider": "openrouter", "model": "openrouter/free", "url": "https://attacker.invalid"}]:
            with self.assertRaises(c.Blocked):
                c.validate_route(route)

    def test_private_state_symlinks_rejected_before_any_write(self):
        with tempfile.TemporaryDirectory() as outside:
            base = self.root / ".git/yellow-continuity"
            self._ensure_symlink_support(base, outside, target_is_directory=True)
            with self.assertRaises(c.Blocked):
                self.run_worker(lambda *a: self.fail("Escaped directory called provider"))
            self.assertEqual(list(Path(outside).iterdir()), [])
            base.unlink()
            base.mkdir()
            self._ensure_symlink_support(base / self.task["id"], outside, target_is_directory=True)
            with self.assertRaises(c.Blocked):
                self.run_worker(lambda *a: self.fail("Escaped task directory called provider"))
            self.assertEqual(list(Path(outside).iterdir()), [])

    def test_private_state_file_symlink_rejected(self):
        directory = c.private_directory(self.root, self.task["id"])
        target = self.root / "sentinel.txt"
        target.write_text("preserve")
        self._ensure_symlink_support(directory / "state.json", target)
        with self.assertRaises(c.Blocked):
            self.run_worker(lambda *a: self.fail("State symlink called provider"))
        self.assertEqual(target.read_text(), "preserve")

    def test_price_recheck_and_no_credentials_in_model_payload(self):
        route = {"provider": "openrouter", "model": "qwen/qwen3-coder:free"}
        calls = []
        def transport(url, body=None, key=None):
            calls.append((url, body, key))
            if body is None:
                return {"data": [{"id": route["model"], "pricing": {"prompt": "0", "completion": "0", "request": "0"}}]}
            self.assertNotIn("test-only-key", json.dumps(body))
            self.assertEqual(body["provider"]["max_price"], {"prompt": 0, "completion": 0})
            return {"choices": [{"finish_reason": "stop", "message": {"content": self.answer}}]}
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-only-key"}):
            self.assertEqual(c.call_model(route, [{"role": "user", "content": "fixture"}], 512, transport)[0], self.answer)
            with self.assertRaises(c.Blocked):
                c.call_model(route, [], 512, lambda *a, **kw: {"data": [{"id": route["model"], "pricing": {"prompt": "0.01", "completion": "0"}}]})
        self.assertEqual(len(calls), 2)

    def test_response_truncation_is_not_accepted(self):
        with self.assertRaises(c.Blocked):
            c.call_model({"provider": "zen", "model": "big-pickle"}, [], 512,
                         lambda *a, **kw: {"choices": [{"finish_reason": "length", "message": {"content": self.answer}}]})

    def test_explicit_input_ranges_do_not_shorten_canonical_instructions(self):
        self.task["input_ranges"] = {"input.txt": [1, 1]}
        messages, hashes = c.context_for(self.root, self.task)
        source = json.loads(messages[1]["content"])["source"]
        self.assertEqual(source["input.txt"]["lines"], [1, 1])
        self.assertEqual(hashes["input.txt"], c.digest((self.root / "input.txt").read_text()))
        self.task["inputs"].append("PROJECT.md")
        self.task["input_ranges"]["PROJECT.md"] = [1, 1]
        with self.assertRaises(c.Blocked):
            c.context_for(self.root, self.task)

    def test_parallel_tasks_run_concurrently_and_reject_overlapping_scopes(self):
        second = dict(self.task, id="second", outputs=["other.txt"])
        path = self.root / ".git/second.json"
        path.write_text(json.dumps(second))
        jobs = [{"task": str(self.manifest), "config": str(self.config)},
                {"task": str(path), "config": str(self.config)}]
        barrier = threading.Barrier(2, timeout=3)
        def concurrent(route, messages, tokens):
            task = json.loads(messages[1]["content"])["task"]
            barrier.wait()
            return json.dumps({"summary": "synthetic", "files": {task["outputs"][0]: "ok"}, "remaining": []}), {}
        self.assertEqual([x["status"] for x in batch.run_batch(self.root, jobs, caller=concurrent)], ["proposed", "proposed"])
        second["outputs"] = self.task["outputs"]
        path.write_text(json.dumps(second))
        with self.assertRaises(c.Blocked):
            batch.run_batch(self.root, jobs, caller=lambda *a: self.fail("Overlapping jobs called model"))


if __name__ == "__main__":
    unittest.main()
