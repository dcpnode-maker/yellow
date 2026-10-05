from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import re
import shutil
import subprocess
import tempfile
import threading

ROOT = Path(__file__).parents[1]

def read(name):
    return (ROOT / name).read_text(encoding="utf-8")

def test_loopback_auth_and_single_worker():
    s = read("start-server.sh")
    assert "--host 127.0.0.1" in s
    assert "--port 8080" in s
    assert '--api-key-file "$YELLOW_ROOT/run/api-key"' in s
    assert '$(cat "$YELLOW_ROOT/run/api-key")' not in s
    assert "--parallel 1" in s
    assert "--no-ui" in s
    assert "-m \"$YELLOW_MODEL\"" in s
    assert 'while kill -0 "$server_pid"' in s
    assert 'if ! "$YELLOW_ROOT/guard.sh"' in s
    assert "worker guard stopped the running server" in s

def test_guard_and_pinned_build():
    b = read("bootstrap.sh")
    assert "LLAMA_CPP_REF" in b and "git -C \"$YELLOW_ROOT/llama.cpp\" checkout --detach \"$LLAMA_CPP_REF\"" in b
    g = read("guard.sh")
    assert "YELLOW_MIN_BATTERY" in g and "YELLOW_MAX_TEMP_C" in g
    assert "termux-battery-status" in g and "termux-thermal-sensor" in g
    assert 'YELLOW_MAX_TEMP_C:=45' in g

def test_supervisor_uses_hysteresis_and_wake_lock():
    s = read("supervise-worker.sh")
    assert 'YELLOW_MAX_TEMP_C:=45' in s
    assert 'YELLOW_RESUME_TEMP_C:=42' in s
    assert "termux-wake-lock" in s
    assert '"$YELLOW_ROOT/start-server.sh"' in s
    assert 'sleep "$YELLOW_RETRY_SECONDS"' in s
    assert "^[1-9][0-9]*$" in s

    bootstrap = read("bootstrap.sh")
    assert 'cp "$SCRIPT_DIR/supervise-worker.sh" "$YELLOW_ROOT/supervise-worker.sh"' in bootstrap
    assert 'chmod 700 "$YELLOW_ROOT/guard.sh" "$YELLOW_ROOT/start-server.sh" "$YELLOW_ROOT/supervise-worker.sh"' in bootstrap
    boot = read("install-boot-helper.sh")
    assert "supervise-worker.sh" in boot
    assert '[ -x "$YELLOW_ROOT/supervise-worker.sh" ]' in boot
    assert '"$YELLOW_ROOT/guard.sh" || exit 0' not in boot
    assert 'YELLOW_BOOT_SSH:=0' in boot
    assert 'ListenAddress=127.0.0.1' in boot
    assert 'PasswordAuthentication=no' in boot
    assert 'KbdInteractiveAuthentication=no' in boot
    assert 'AuthenticationMethods=publickey' in boot
    assert '[ -s "$HOME/.ssh/authorized_keys" ]' in boot

def test_tunnel_ports_and_manual_target():
    s = read("Invoke-PhoneTunnel.ps1")
    for port in (11435, 11436, 11437):
        assert str(port) in s
    assert "-L \"127.0.0.1:${local}:127.0.0.1:8080\"" in s
    assert "adb" not in s.lower()

def test_phone_codex_bridge_is_authenticated_and_bounded():
    bridge = read("Invoke-PhoneCodex.ps1")
    assert "YELLOW_PHONE_API_KEY" in bridge
    assert "--strict-config" in bridge and "--ephemeral" in bridge
    assert "--sandbox $Sandbox" in bridge
    assert 'requires_openai_auth = true' in bridge
    assert 'wire_api = "responses"' in bridge
    assert "secret_printed = $false" in bridge
    assert "UTF8Encoding" in bridge and "WriteAllText" in bridge
    assert "bypass" not in bridge.lower()
    assert "0.0.0.0" not in bridge
    assert "workspace-write requires a separate registered Yellow Git worktree" in bridge
    assert "git -C $repoRoot worktree list --porcelain" in bridge

def test_phone_aider_bridge_is_worktree_and_file_bounded():
    bridge = read("Invoke-PhoneAider.ps1")
    assert "separate Git worktree" in bridge
    assert "conservative 6 KiB admission limit" in bridge
    assert "UTF8.GetByteCount($Prompt)" in bridge
    assert "registered Yellow Git worktree" in bridge
    assert "git -C $repoRoot worktree list --porcelain" in bridge
    assert "--no-auto-commits" in bridge and "--no-dirty-commits" in bridge
    assert "'--map-tokens', '0'" in bridge
    assert "'--no-gitignore'" in bridge and "'--no-add-gitignore-files'" in bridge
    assert "'--thinking-tokens', '0'" in bridge and "'--timeout', '180'" in bridge
    assert "'--no-check-model-accepts-settings'" in bridge and '"/no_think`nWork only' in bridge
    assert ".git\\yellow-local-ai\\aider-history" in bridge
    assert "git diff --check" in bridge
    assert "OPENAI_API_KEY" in bridge and "secret_printed = $false" in bridge
    assert "StringComparison]::OrdinalIgnoreCase" in bridge
    assert "0.0.0.0" not in bridge and "bypass" not in bridge.lower()

def test_laptop_fake_endpoint_orchestration():
    powershell = shutil.which("pwsh") or shutil.which("powershell")
    assert powershell, "PowerShell is required for the laptop orchestration proof"

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.headers.get("Authorization") != "Bearer fixture-phone-key":
                self.send_response(401)
                self.end_headers()
                return
            if self.path == "/health":
                payload = {"status": "ok"}
            elif self.path == "/v1/models":
                payload = {"data": [{"id": "fixture-gguf"}]}
            else:
                self.send_response(404)
                self.end_headers()
                return
            body = json.dumps(payload).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_args):
            pass

    tunnel = subprocess.run(
        [
            powershell, "-NoProfile", "-File", str(ROOT / "Invoke-PhoneTunnel.ps1"),
            "-Worker", "oneplus10r", "-SshTarget", "fixture@phone", "-DryRun",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    tunnel_result = json.loads(tunnel.stdout)
    assert tunnel_result["local_endpoint"] == "http://127.0.0.1:11435"
    assert tunnel_result["remote_endpoint"] == "127.0.0.1:8080"
    assert tunnel_result["public_bind"] is False

    server = ThreadingHTTPServer(("127.0.0.1", 11435), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as key_file:
            key_file.write("fixture-phone-key\n")
            key_path = Path(key_file.name)
        try:
            probe = subprocess.run(
                [
                    powershell, "-NoProfile", "-File", str(ROOT / "Invoke-PhoneWorkerProbe.ps1"),
                    "-Worker", "oneplus10r", "-ApiKeyFile", str(key_path),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
        finally:
            key_path.unlink(missing_ok=True)
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)

    assert "fixture-phone-key" not in probe.stdout
    result = json.loads(probe.stdout)
    assert result == {
        "action": "phone-worker-probe",
        "worker": "oneplus10r",
        "endpoint": "http://127.0.0.1:11435",
        "health_status": 200,
        "models_status": 200,
        "authenticated": True,
        "public_bind": False,
        "secret_printed": False,
    }

def test_no_credentials_or_lan_bind():
    for path in ROOT.glob("*.sh"):
        s = path.read_text(encoding="utf-8")
        assert "0.0.0.0" not in s
        assert not re.search(r"(OPENAI_API_KEY|HF_TOKEN|sshpass|BEGIN [A-Z ]+PRIVATE KEY)", s)

def test_docs_state_limits():
    d = read("README.md")
    assert "does not pool RAM" in d
    assert "Manual pairing" in d
    assert "charge limit of 80%" in d
    assert "45 C" in d and "42 C" in d
    assert "Codex worker bridge" in d
    assert "Aider bridge" in d

if __name__ == "__main__":
    tests = [value for name, value in globals().items() if name.startswith("test_")]
    for test in tests:
        test()
    print(f"{len(tests)} Android worker tests passed")
