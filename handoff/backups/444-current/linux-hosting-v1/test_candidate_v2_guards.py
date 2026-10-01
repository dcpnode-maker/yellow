from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import time
import unittest
from unittest import mock

ROOT = Path(__file__).absolute().parent
SPEC = importlib.util.spec_from_file_location("candidate_builder_v2", ROOT / "build_and_export_candidate_v2.py")
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)


class CandidateV2BuildGuards(unittest.TestCase):
    def test_dockerfile_argument_is_absolute_and_inside_private_context(self):
        with tempfile.TemporaryDirectory() as temp:
            context = Path(temp) / "empty-context"
            context.mkdir()
            dockerfile = context / "Dockerfile"
            dockerfile.write_text("FROM example\n")
            command = builder.docker_build_command(context, "nonsecret-nonce")
            file_index = command.index("--file")
            self.assertEqual(command[file_index + 1], str(dockerfile.resolve()))
            self.assertTrue(Path(command[file_index + 1]).is_absolute())
            self.assertEqual(command[-1], str(context.resolve()))
            self.assertEqual(Path(command[file_index + 1]).parent, Path(command[-1]))

    def test_private_log_receives_both_build_stdout_and_stderr(self):
        fake_process = mock.Mock()
        fake_process.communicate.return_value = (None, None)
        fake_process.returncode = 0
        old_deadline = builder.DEADLINE
        builder.DEADLINE = time.monotonic() + 10
        try:
            with tempfile.TemporaryFile(mode="w+b") as private_log, \
                    mock.patch.object(builder.subprocess, "Popen", return_value=fake_process) as popen:
                builder.run(["docker", "build"], stdout_file=private_log)
                kwargs = popen.call_args.kwargs
                self.assertIs(kwargs["stdout"], private_log)
                self.assertIs(kwargs["stderr"], private_log)
                self.assertTrue(kwargs["start_new_session"])
        finally:
            builder.DEADLINE = old_deadline
            builder.CURRENT = None

    def test_v2_uses_fresh_private_and_public_paths_and_pinned_converter(self):
        self.assertEqual(builder.PRIVATE.name, "private-candidate-444-v2")
        self.assertEqual(builder.PUBLIC_PROOF.name, "CANDIDATE_444_IMAGE_EXPORT_PROOF_V2.json")
        self.assertEqual(builder.CONVERTER_SHA256,
                         "d4b9f325581404c5782ab81ebfedc1ca974a0bb55da24fd1dedabdbe372767f8")
        self.assertTrue(builder.APP_TAG.endswith("-v2"))
        self.assertTrue(builder.JOB.endswith("-v2"))


if __name__ == "__main__":
    unittest.main()
