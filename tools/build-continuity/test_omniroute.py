import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock


MODULE_PATH = Path(__file__).with_name("omniroute.py")
SPEC = importlib.util.spec_from_file_location("yellow_omniroute", MODULE_PATH)
omni = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(omni)


class OmniRouteBootstrapTests(unittest.TestCase):
    def test_windows_shutdown_kills_the_exact_gateway_tree(self):
        process = mock.Mock(pid=4321)
        process.poll.return_value = None
        process.wait.return_value = 0
        with mock.patch.object(omni.os, "name", "nt"), mock.patch.object(
            omni.subprocess, "run"
        ) as run:
            omni.stop_process_tree(process)
        run.assert_called_once_with(
            ["taskkill", "/PID", "4321", "/T", "/F"],
            stdout=omni.subprocess.DEVNULL,
            stderr=omni.subprocess.DEVNULL,
            check=False,
        )
        process.wait.assert_called_once_with(timeout=8)

    def test_sqljs_wasm_is_colocated_and_idempotent(self):
        with tempfile.TemporaryDirectory() as temporary:
            state = Path(temporary)
            source_dir = state / "npm" / "node_modules" / "sql.js" / "dist"
            package = state / "npm" / "node_modules" / "omniroute"
            source_dir.mkdir(parents=True)
            package.mkdir(parents=True)
            (source_dir.parent / "package.json").write_text(
                json.dumps({"name": "sql.js", "version": omni.SQLJS_VERSION}),
                encoding="utf-8",
            )
            (source_dir / "sql-wasm.js").write_bytes(b"fixture-js")
            (source_dir / "sql-wasm.wasm").write_bytes(b"fixture-wasm")
            runtime_files = {}
            for relative in ["package.json", "dist/sql-wasm.js", "dist/sql-wasm.wasm"]:
                payload = (source_dir.parent / relative).read_bytes()
                runtime_files[relative] = (len(payload), omni.hashlib.sha256(payload).hexdigest())
            with mock.patch.object(omni, "SQLJS_RUNTIME_FILES", runtime_files):
                omni.ensure_sqljs_runtime(state)
                destination = package / "dist" / "node_modules" / "sql.js" / "dist" / "sql-wasm.wasm"
                self.assertEqual(destination.read_bytes(), b"fixture-wasm")
                omni.ensure_sqljs_runtime(state)

    def test_unexpected_existing_wasm_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as temporary:
            state = Path(temporary)
            source_dir = state / "npm" / "node_modules" / "sql.js" / "dist"
            package = state / "npm" / "node_modules" / "omniroute"
            destination = package / "dist" / "node_modules" / "sql.js" / "dist" / "sql-wasm.wasm"
            source_dir.mkdir(parents=True)
            destination.parent.mkdir(parents=True)
            (source_dir.parent / "package.json").write_text(
                json.dumps({"name": "sql.js", "version": omni.SQLJS_VERSION}), encoding="utf-8"
            )
            payload = b"fixture-wasm"
            (source_dir / "sql-wasm.js").write_bytes(b"fixture-js")
            (source_dir / "sql-wasm.wasm").write_bytes(payload)
            destination.write_bytes(b"unexpected")
            runtime_files = {}
            for relative in ["package.json", "dist/sql-wasm.js", "dist/sql-wasm.wasm"]:
                content = (source_dir.parent / relative).read_bytes()
                runtime_files[relative] = (len(content), omni.hashlib.sha256(content).hexdigest())
            with mock.patch.object(omni, "SQLJS_RUNTIME_FILES", runtime_files), \
                    self.assertRaises(omni.Blocked):
                omni.ensure_sqljs_runtime(state)
            self.assertEqual(destination.read_bytes(), b"unexpected")


if __name__ == "__main__":
    unittest.main()
