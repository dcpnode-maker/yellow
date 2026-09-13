#!/usr/bin/env python3
"""Prepare a Yellow handoff; optionally install/start the pinned Kilo CLI."""
import argparse
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys

import continuity as c

VERSION = "7.6.2"


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--install-kilo", action="store_true")
    p.add_argument("--kilo", action="store_true", help="Open interactive Kilo after preparation")
    p.add_argument("--api", action="store_true", help="Run bounded read-only API handoff task")
    a = p.parse_args()
    root = Path(c.git(Path.cwd(), "rev-parse", "--show-toplevel"))
    private = c.private_directory(root)
    head = c.git(root, "rev-parse", "HEAD")
    task = {"id": "handoff-" + head[:12], "base_sha": head,
            "order": "handoff/orders/BUILD-CONTINUITY-001.md",
            "inputs": ["docs/PROJECT-STATUS.md", "tools/build-continuity/README.md"],
            "input_ranges": {"docs/PROJECT-STATUS.md": [1, 110]},
            "outputs": [],
            "goal": "Read-only handoff: identify the current Yellow priority, published versus serving state, and next coordinator action. Preserve all founder requirements. Do not start application work or claim tests ran."}
    messages, _ = c.context_for(root, task)
    task_path = private / "handoff-task.json"
    c.atomic_json(task_path, task)
    c.atomic_json(private / "handoff-context.json", {"messages": messages})
    print("Prepared task and context in", private)
    print("Current source:", head)
    print("Kilo: /connect, choose a currently Free model with /models, then import a local session with /resume-codex if available.")
    print("This prepares context; it does not authenticate accounts or start a persistent server.")
    if a.api:
        folder, state = c.run_task(root, task_path, Path(__file__).with_name("routes.json"))
        print("API task:", state["status"], "Receipts:", folder)
        return 0 if state["status"] == "proposed" else 2
    prefix = private / "cli"
    launcher = prefix / "node_modules/@kilocode/cli/bin/kilo"
    if a.install_kilo:
        c.plain(prefix)
        prefix.mkdir(exist_ok=True, mode=0o700)
        npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
        if not npm:
            raise c.Blocked("Install Node.js with npm in this host first")
        system = {"Linux": "linux", "Darwin": "darwin", "Windows": "windows"}.get(platform.system())
        arch = {"x86_64": "x64", "AMD64": "x64", "arm64": "arm64", "aarch64": "arm64"}.get(platform.machine())
        if not system or not arch:
            raise c.Blocked("This Kilo package does not support the detected host")
        if system == "linux" and platform.libc_ver()[0] != "glibc":
            raise c.Blocked("Use Kilo's documented musl install for this host")
        suffix = "-baseline" if arch == "x64" else ""
        binary_package = f"@kilocode/cli-{system}-{arch}{suffix}@{VERSION}"
        subprocess.run([npm, "install", "--prefix", str(prefix), "--ignore-scripts", "--omit=optional", "--no-audit", "--no-fund", f"@kilocode/cli@{VERSION}", binary_package], check=True)
        node = shutil.which("node")
        if not node:
            raise c.Blocked("Node.js is not available")
        c.plain(launcher)
        subprocess.run([node, str(launcher), "--version"], check=True)
    if a.kilo:
        node = shutil.which("node")
        if not node or not launcher.is_file():
            raise c.Blocked("Run --install-kilo first")
        c.plain(launcher)
        # No automatic approval, sharing, model, billing or host settings changed.
        return subprocess.call([node, str(launcher), str(root)], cwd=root)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (c.Blocked, OSError, subprocess.CalledProcessError) as e:
        print("Blocked:", e, file=sys.stderr)
        raise SystemExit(2)
