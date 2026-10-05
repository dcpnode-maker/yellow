"""Offline acceptance checks for the Yellow harness controller."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest


MODULE = Path(__file__).with_name("controller.py")
SPEC = importlib.util.spec_from_file_location("yellow_harness_controller", MODULE)
assert SPEC and SPEC.loader
controller_module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(controller_module)
Controller = controller_module.Controller
HarnessError = controller_module.HarnessError


def git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo), *args], check=True, text=True, capture_output=True
    )
    return result.stdout.strip()


class ControllerTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name) / "repo"
        self.repo.mkdir()
        git(self.repo, "init")
        git(self.repo, "config", "user.email", "test@example.invalid")
        git(self.repo, "config", "user.name", "Yellow test")
        (self.repo / "handoff" / "orders").mkdir(parents=True)
        (self.repo / "src").mkdir()
        (self.repo / "handoff" / "orders" / "001.md").write_text(
            "# Order 001\n\nScope: src/example.ts\n", encoding="utf-8"
        )
        (self.repo / "src" / "example.ts").write_text("export const value = 1;\n", encoding="utf-8")
        git(self.repo, "add", ".")
        git(self.repo, "commit", "-m", "baseline")
        self.head = git(self.repo, "rev-parse", "HEAD")
        self.controller = Controller(self.repo, Path(self.temp.name) / "state.sqlite3")
        self.manifest = {
            "id": "task-one",
            "base_sha": self.head,
            "order": "handoff/orders/001.md",
            "inputs": ["src/example.ts"],
            "outputs": ["src/example.ts"],
            "goal": "Propose a small change; do not execute it.",
            "capability": "code",
            "data_classification": "public_source",
        }

    def test_approval_claim_heartbeat_complete_and_idempotency(self) -> None:
        self.controller.register_worker("gpu-one", ["code"])
        self.assertEqual(self.controller.submit(self.manifest, now=100)["state"], "awaiting_approval")
        self.assertIsNone(self.controller.claim("gpu-one", now=101))
        self.controller.approve("task-one", now=102)
        lease = self.controller.claim("gpu-one", now=103, ttl=30)
        self.assertIsNotNone(lease)
        assert lease
        self.assertEqual(lease["manifest"], self.manifest)
        self.assertEqual(self.controller.heartbeat("task-one", "gpu-one", lease["lease_token"], now=120, ttl=60), 180)
        result = {"files": {"src/example.ts": "export const value = 2;\n"}, "summary": "Proposal only"}
        first = self.controller.complete("task-one", "gpu-one", lease["lease_token"], result, now=130)
        again = self.controller.complete("task-one", "gpu-one", lease["lease_token"], result, now=200)
        self.assertEqual(first, again)
        self.assertEqual(self.controller.result("task-one"), result)
        self.assertEqual((self.repo / "src" / "example.ts").read_text(), "export const value = 1;\n")
        with self.assertRaises(HarnessError):
            self.controller.complete("task-one", "gpu-one", lease["lease_token"],
                                     {**result, "summary": "Different"}, now=201)

    def test_expired_lease_cannot_steal_completion(self) -> None:
        self.controller.register_worker("worker-a", ["code"])
        self.controller.register_worker("worker-b", ["code"])
        self.controller.submit(self.manifest, now=100)
        self.controller.approve("task-one", now=101)
        old = self.controller.claim("worker-a", now=102, ttl=30)
        new = self.controller.claim("worker-b", now=132, ttl=30)
        assert old and new
        self.assertNotEqual(old["lease_token"], new["lease_token"])
        result = {"files": {"src/example.ts": "new"}, "summary": "done"}
        with self.assertRaises(HarnessError):
            self.controller.complete("task-one", "worker-a", old["lease_token"], result, now=133)
        self.assertEqual(self.controller.complete("task-one", "worker-b", new["lease_token"],
                                                  result, now=133)["state"], "completed")

    def test_capability_and_unknown_worker(self) -> None:
        self.controller.register_worker("research", ["research"])
        self.controller.submit(self.manifest, now=1)
        self.controller.approve("task-one", now=2)
        self.assertIsNone(self.controller.claim("research", now=3))
        with self.assertRaises(HarnessError):
            self.controller.claim("invented", now=3)

    def test_traversal_secret_class_and_changed_base_rejected(self) -> None:
        for variant in (
            {"inputs": ["../secret.txt"]},
            {"outputs": ["C:/outside.txt"]},
            {"outputs": ["src//oops.ts"]},
            {"data_classification": "guest_data"},
            {"base_sha": "0" * 40},
            {"order": "src/example.ts"},
        ):
            with self.subTest(variant=variant), self.assertRaises(HarnessError):
                self.controller.submit({**self.manifest, **variant}, now=1)

    def test_overlap_and_result_scope_rejected(self) -> None:
        self.controller.register_worker("coder", ["code"])
        self.controller.submit(self.manifest, now=1)
        with self.assertRaises(HarnessError):
            self.controller.submit({**self.manifest, "id": "task-two"}, now=2)
        self.controller.approve("task-one", now=3)
        lease = self.controller.claim("coder", now=4)
        assert lease
        with self.assertRaises(HarnessError):
            self.controller.complete("task-one", "coder", lease["lease_token"],
                                     {"files": {"src/other.ts": "x"}, "summary": "bad"}, now=5)

    def test_queue_survives_new_process_object_and_id_cannot_be_reused(self) -> None:
        self.controller.register_worker("coder", ["code"])
        self.controller.submit(self.manifest, now=1)
        reopened = Controller(self.repo, Path(self.temp.name) / "state.sqlite3")
        self.assertEqual(reopened.status("task-one")["state"], "awaiting_approval")
        with self.assertRaises(HarnessError):
            reopened.submit(self.manifest, now=2)
        reopened.approve("task-one", now=3)
        self.assertIsNotNone(reopened.claim("coder", now=4))

    def test_uncommitted_input_and_oversized_result_rejected(self) -> None:
        (self.repo / "src" / "uncommitted.ts").write_text("x", encoding="utf-8")
        with self.assertRaises(HarnessError):
            self.controller.submit({**self.manifest, "inputs": ["src/uncommitted.ts"]}, now=1)
        self.controller.register_worker("coder", ["code"])
        self.controller.submit(self.manifest, now=1)
        self.controller.approve("task-one", now=2)
        lease = self.controller.claim("coder", now=3)
        assert lease
        with self.assertRaises(HarnessError):
            self.controller.complete(
                "task-one", "coder", lease["lease_token"],
                {"files": {"src/example.ts": "x" * 512_001}, "summary": "large"}, now=4,
            )

    def test_competing_workers_cannot_claim_same_task(self) -> None:
        self.controller.register_worker("worker-a", ["code"])
        self.controller.register_worker("worker-b", ["code"])
        self.controller.submit(self.manifest, now=1)
        self.controller.approve("task-one", now=2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            leases = list(pool.map(lambda worker: self.controller.claim(worker, now=3),
                                   ["worker-a", "worker-b"]))
        self.assertEqual(sum(lease is not None for lease in leases), 1)

    def test_symlink_input_rejected_when_host_supports_links(self) -> None:
        link = self.repo / "src" / "outside.ts"
        target = Path(self.temp.name) / "outside.ts"
        target.write_text("private", encoding="utf-8")
        try:
            link.symlink_to(target)
        except (OSError, NotImplementedError):
            self.skipTest("Host does not permit test symlinks")
        with self.assertRaises(HarnessError):
            self.controller.submit({**self.manifest, "inputs": ["src/outside.ts"]}, now=1)


if __name__ == "__main__":
    unittest.main()
