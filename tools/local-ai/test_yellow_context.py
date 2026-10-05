import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from yellow_context import ContextError, LANE_LIMITS, build_bundle, verify_bundle


class YellowContextTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temp.name)
        (self.root / ".git").mkdir()
        (self.root / ".agents" / "skills" / "yellow-rules").mkdir(parents=True)
        (self.root / "handoff" / "orders").mkdir(parents=True)
        (self.root / "src").mkdir()
        (self.root / "PROJECT.md").write_text("# Rules\nKeep money integral.\n", encoding="utf-8")
        (self.root / "AGENTS.md").write_text("# Agent\nUse an order.\n", encoding="utf-8")
        (self.root / "handoff" / "orders" / "001.md").write_text("# Order\nScope: src/a.ts\n", encoding="utf-8")
        (self.root / "DECISIONS.log").write_text(
            "D1 | unrelated\nD2 | finance context uses balanced journals\n", encoding="utf-8"
        )
        (self.root / "src" / "a.ts").write_text("export const amount = 1;\n", encoding="utf-8")
        (self.root / ".agents" / "skills" / "yellow-rules" / "SKILL.md").write_text(
            "---\nname: yellow-rules\ndescription: Preserve invariants.\n---\nFull instructions.\n",
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        self.temp.cleanup()

    def build(self, **overrides):
        args = dict(
            repo_root=self.root,
            order="handoff/orders/001.md",
            topic="finance journals",
            lane="laptop",
            includes=["src/a.ts"],
            skills=["yellow-rules"],
        )
        args.update(overrides)
        return build_bundle(**args)

    def test_bundle_is_deterministic_and_manifest_matches(self) -> None:
        first = self.build()
        second = self.build()
        self.assertEqual(first["bundle_sha256"], second["bundle_sha256"])
        self.assertEqual(first["bundle_path"], second["bundle_path"])
        bundle = pathlib.Path(first["bundle_path"]).read_bytes()
        self.assertLessEqual(len(bundle), LANE_LIMITS["phone"])
        manifest = json.loads(pathlib.Path(first["manifest_path"]).read_text(encoding="utf-8"))
        self.assertEqual(first["bundle_sha256"], manifest["bundle_sha256"])
        self.assertIn(b"Full instructions", bundle)
        self.assertIn(b"capability_request", bundle)
        self.assertIn(b"finance context uses balanced journals", bundle)

    def test_phone_packet_reserves_task_input_budget_and_filters_decisions(self) -> None:
        matched = self.build(lane="phone", includes=[], skills=[])
        packet = pathlib.Path(matched["bundle_path"]).read_bytes()
        self.assertLessEqual(len(packet), LANE_LIMITS["phone"] - 2048)
        self.assertIn(b"finance context uses balanced journals", packet)
        self.assertNotIn(b"D1 | unrelated", packet)
        self.assertIn(b"capability_request", packet)
        self.assertIn(b"Work only inside the supplied order scope", packet)

        unmatched = self.build(lane="phone", includes=[], skills=[], topic="housekeeping linen")
        unmatched_packet = pathlib.Path(unmatched["bundle_path"]).read_bytes()
        self.assertNotIn(b"finance context uses balanced journals", unmatched_packet)

    def test_rejects_repository_escape_and_secret(self) -> None:
        outside = self.root.parent / "yellow-context-outside.txt"
        outside.write_text("outside", encoding="utf-8")
        self.addCleanup(lambda: outside.unlink(missing_ok=True))
        with self.assertRaises(ContextError):
            self.build(includes=["../yellow-context-outside.txt"])
        (self.root / "src" / "secret.txt").write_text(
            "token=sk-or-v1-" + "a" * 32, encoding="utf-8"
        )
        with self.assertRaises(ContextError):
            self.build(includes=["src/secret.txt"])

    def test_rejects_oversize_instead_of_silent_truncation(self) -> None:
        (self.root / "src" / "large.txt").write_text("x" * LANE_LIMITS["phone"], encoding="utf-8")
        with self.assertRaisesRegex(ContextError, "narrow explicit inputs"):
            self.build(includes=["src/large.txt"], skills=[], lane="phone")

    def test_phone_admission_accepts_6144_bytes_and_rejects_6145(self) -> None:
        padding = self.root / "src" / "padding.txt"
        padding.write_text("x", encoding="utf-8")
        probe = self.build(includes=["src/padding.txt"], skills=[], lane="phone")
        padding_bytes = 1 + (LANE_LIMITS["phone"] - int(probe["bundle_bytes"]))
        padding.write_text("x" * padding_bytes, encoding="utf-8")
        exact = self.build(includes=["src/padding.txt"], skills=[], lane="phone")
        self.assertEqual(LANE_LIMITS["phone"], exact["bundle_bytes"])

        padding.write_text("x" * (padding_bytes + 1), encoding="utf-8")
        with self.assertRaisesRegex(ContextError, "6145 bytes"):
            self.build(includes=["src/padding.txt"], skills=[], lane="phone")

    def test_verifier_rejects_modified_or_manifestless_bundle(self) -> None:
        result = self.build()
        self.assertEqual("laptop", verify_bundle(self.root, result["bundle_path"], "laptop")["lane"])
        bundle = pathlib.Path(result["bundle_path"])
        original = bundle.read_text(encoding="utf-8")
        bundle.write_text(original + "modified\n", encoding="utf-8")
        with self.assertRaisesRegex(ContextError, "integrity"):
            verify_bundle(self.root, str(bundle), "laptop")
        bundle.write_text(original, encoding="utf-8")
        pathlib.Path(result["manifest_path"]).unlink()
        with self.assertRaisesRegex(ContextError, "manifest"):
            verify_bundle(self.root, str(bundle), "laptop")

    def test_skill_catalog_rejects_recognizable_secret(self) -> None:
        skill = self.root / ".agents" / "skills" / "yellow-rules" / "SKILL.md"
        skill.write_text("description: sk-or-v1-" + "x" * 32, encoding="utf-8")
        with self.assertRaisesRegex(ContextError, "credential material"):
            self.build(skills=[])

    @unittest.skipUnless(os.name == "nt", "Windows junction proof")
    def test_verifier_rejects_junctioned_private_context_root(self) -> None:
        result = self.build()
        context_root = self.root / ".git" / "yellow-local-ai" / "context"
        external = self.root / "external-context"
        external.mkdir()
        for source in context_root.iterdir():
            source.replace(external / source.name)
        context_root.rmdir()
        completed = subprocess.run(
            ["cmd.exe", "/c", "mklink", "/J", str(context_root), str(external)],
            capture_output=True,
            text=True,
            check=False,
        )
        if completed.returncode != 0:
            self.skipTest("Junction creation unavailable")
        try:
            with self.assertRaisesRegex(ContextError, "Symlinked inputs"):
                verify_bundle(self.root, str(context_root / pathlib.Path(result["bundle_path"]).name), "laptop")
        finally:
            subprocess.run(["cmd.exe", "/c", "rmdir", str(context_root)], check=False)


if __name__ == "__main__":
    unittest.main()
