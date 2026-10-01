import dataclasses
import unittest
from pathlib import Path

import run_synthetic_origin as runner


def valid_facts():
    return runner.Facts(
        source_head=runner.SOURCE,
        source_dirty=False,
        image_id=runner.IMAGE_ID,
        image_os="linux",
        image_arch="amd64",
        image_user="bun",
        image_command=("bun", "run", "start"),
        image_revision=runner.SOURCE,
        owned_name_exists=False,
        old_id=runner.OLD_CID,
        old_image_id=runner.OLD_IMAGE_ID,
        old_name=runner.OLD_NAME,
        old_running=True,
        old_restart="no",
        old_revision=runner.OLD_REVISION,
        network_id=runner.NETWORK_ID,
        docker_port_owners=(),
        authority_present=True,
        authority_is_file=True,
        authority_mode=0o600,
        job_dir_exists=False,
        token_file_exists=False,
        receipt_exists=False,
        conflicting_secret_environment=False,
        socket_port_free=True,
        authority_path_safe=True,
        task_paths_safe=True,
    )


class AdmissionTests(unittest.TestCase):
    def assert_rejects_before_mutation(self, **changes):
        called = []
        facts = dataclasses.replace(valid_facts(), **changes)
        with self.assertRaises(runner.GuardError):
            runner.run_after_admission(facts, lambda: called.append("mutated"))
        self.assertEqual(called, [])

    def test_accepted_facts_reach_mutation(self):
        self.assertEqual(runner.run_after_admission(valid_facts(), lambda: "admitted"), "admitted")

    def test_wrong_image_digest_rejected_before_mutation(self):
        self.assert_rejects_before_mutation(image_id="sha256:" + "0" * 64)

    def test_wrong_source_label_rejected_before_mutation(self):
        self.assert_rejects_before_mutation(image_revision="0" * 40)

    def test_owned_name_collision_rejected_before_mutation(self):
        self.assert_rejects_before_mutation(owned_name_exists=True)

    def test_old_container_identity_change_rejected_before_mutation(self):
        self.assert_rejects_before_mutation(old_id="a" * 64)

    def test_old_container_source_change_rejected_before_mutation(self):
        self.assert_rejects_before_mutation(old_revision="b" * 40)

    def test_wrong_network_identity_rejected_before_mutation(self):
        self.assert_rejects_before_mutation(network_id="c" * 64)

    def test_published_port_collision_rejected_before_mutation(self):
        self.assert_rejects_before_mutation(docker_port_owners=("container-id",))
        self.assert_rejects_before_mutation(socket_port_free=False)

    def test_dirty_source_and_nonfresh_job_rejected_before_mutation(self):
        self.assert_rejects_before_mutation(source_dirty=True)
        self.assert_rejects_before_mutation(job_dir_exists=True)
        self.assert_rejects_before_mutation(token_file_exists=True)
        self.assert_rejects_before_mutation(receipt_exists=True)

    def test_authority_mode_and_inherited_secret_collision_rejected(self):
        self.assert_rejects_before_mutation(authority_mode=0o644)
        self.assert_rejects_before_mutation(conflicting_secret_environment=True)
        self.assert_rejects_before_mutation(authority_path_safe=False)
        self.assert_rejects_before_mutation(task_paths_safe=False)

    def test_red_admission_never_enters_cleanup(self):
        called = []
        with self.assertRaises(runner.GuardError):
            runner.validate_facts(dataclasses.replace(valid_facts(), image_id="sha256:" + "0" * 64))
        runner.cleanup_if_launched(False, lambda: called.append("cleanup"))
        self.assertEqual(called, [])

    def test_red_admission_never_unlinks_preexisting_token_file(self):
        import tempfile
        with tempfile.TemporaryDirectory() as directory:
            token_file = Path(directory) / "token.env"
            token_file.write_text("existing-private-content", encoding="utf-8")
            runner.unlink_created_private(token_file, False)
            self.assertEqual(token_file.read_text(encoding="utf-8"), "existing-private-content")


class OwnershipTests(unittest.TestCase):
    def test_cleanup_requires_exact_full_cid_name_job_source_and_image(self):
        cid = "d" * 64
        nonce = "1234abcd" * 4
        exact = (cid, runner.IMAGE_ID, "/" + runner.CONTAINER_NAME, runner.JOB, runner.SOURCE, nonce)
        self.assertTrue(runner.exact_owned_cleanup(exact, cid, nonce))
        for index, changed in (
            (0, "e" * 64),
            (1, "sha256:" + "f" * 64),
            (2, "/unrelated"),
            (3, "another-job"),
            (4, "0" * 40),
            (5, "different-nonce"),
        ):
            bad = list(exact)
            bad[index] = changed
            self.assertFalse(runner.exact_owned_cleanup(tuple(bad), cid, nonce))
        self.assertFalse(runner.exact_owned_cleanup(None, cid, nonce))
        self.assertFalse(runner.exact_owned_cleanup(("short",) + exact[1:], "short", nonce))

    def test_every_docker_command_selects_the_expected_local_socket(self):
        self.assertEqual(
            runner._docker(["ps", "-q"]),
            ["docker", "--host", "unix:///var/run/docker.sock", "ps", "-q"],
        )

    def test_symlink_paths_are_detected(self):
        import tempfile
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / "actual"
            target.mkdir()
            alias = root / "alias"
            alias.symlink_to(target, target_is_directory=True)
            self.assertFalse(runner._has_symlink_component(target / "file"))
            self.assertTrue(runner._has_symlink_component(alias / "file"))

    def test_ui_asset_must_be_same_origin_and_cannot_traverse(self):
        self.assertEqual(runner._validated_asset_path("assets/app.js"), "/assets/app.js")
        self.assertEqual(runner._validated_asset_path("/assets/app.js?v=1"), "/assets/app.js?v=1")
        for value in ("//example.invalid/app.js", "https://example.invalid/app.js", "/assets/../.env"):
            with self.assertRaises(runner.GuardError):
                runner._validated_asset_path(value)

    def test_compose_is_single_app_and_exposes_only_the_three_required_bindings(self):
        compose = (Path(__file__).parent / "compose.yml").read_text(encoding="utf-8")
        self.assertIn("image: " + runner.IMAGE_ID, compose)
        self.assertIn('"127.0.0.1:53009:3000"', compose)
        self.assertIn('name: yellow-catalogue-referee_default', compose)
        self.assertIn("YELLOW_RUNTIME_DATABASE_URL:", compose)
        self.assertIn("YELLOW_EXTENSION_REGISTRAR_DATABASE_URL:", compose)
        self.assertIn("YELLOW_TOKEN_SECRET:", compose)
        self.assertIn("yellow.synthetic-origin.nonce:", compose)
        self.assertNotIn("YELLOW_DEPLOY_DATABASE", compose)
        self.assertNotIn("build:", compose)
        self.assertNotIn("volumes:", compose)
        self.assertIn('YELLOW_FISCAL_SUBMISSION_WORKER: "0"', compose)
        self.assertIn('YELLOW_PUBLIC_DEMO_AUTOMATIC_LOGIN: "0"', compose)


if __name__ == "__main__":
    unittest.main()
