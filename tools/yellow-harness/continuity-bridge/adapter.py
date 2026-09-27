"""One-shot adapter from approved Yellow harness leases to continuity proposals.

Preview is offline and read-only. Claiming and calling a configured model require
the explicit --live flag; model output remains a proposal in controller SQLite.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
from pathlib import Path
import sys
from typing import Any, Callable


HERE = Path(__file__).resolve().parent
YELLOW_HARNESS = HERE.parent
REPO_DEFAULT = HERE.parents[2]
CONTINUITY_FILE = REPO_DEFAULT / "tools" / "build-continuity" / "continuity.py"
CONTINUITY_CONFIG = CONTINUITY_FILE.with_name("routes.json")


class BridgeError(ValueError):
    """A lease or proposal could not pass the bridge contract."""


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise BridgeError("Required local worker module is unavailable")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def load_components():
    controller = _load_module("yellow_harness_controller", YELLOW_HARNESS / "controller.py")
    continuity = _load_module("yellow_build_continuity", CONTINUITY_FILE)
    return controller, continuity


def validate_task(repo: Path, manifest: Any, controller_module: Any,
                  continuity_module: Any) -> dict[str, Any]:
    """Revalidate the controller manifest, then map only the continuity fields."""
    if not isinstance(manifest, dict):
        raise BridgeError("Task manifest is invalid")
    try:
        # _manifest is a pure validation operation. Avoid Controller.__init__ here:
        # it creates/initializes SQLite, while preview must have no persisted effects.
        validator = object.__new__(controller_module.Controller)
        validator.repo = repo.resolve(strict=True)
        accepted = validator._manifest(manifest)
        if accepted["capability"] != "code":
            raise BridgeError("Continuity bridge accepts code tasks only")
        mapped = {
            "id": accepted["id"],
            "base_sha": accepted["base_sha"],
            "order": accepted["order"],
            "inputs": accepted["inputs"],
            "outputs": accepted["outputs"],
            "goal": accepted["goal"],
        }
        # context_for is the upstream worker's authoritative input/path/base check.
        continuity_module.context_for(repo, mapped)
    except Exception as exc:
        raise BridgeError("Task validation failed") from exc
    return mapped


def _write_private_task(root: Path, continuity_module: Any, task: dict[str, Any]) -> Path:
    directory = continuity_module.private_directory(root, task["id"])
    manifest_path = continuity_module.plain(directory / "harness-task.json")
    continuity_module.atomic_json(manifest_path, task)
    return manifest_path


def preview(repo: Path, manifest: Any, controller_module: Any,
            continuity_module: Any) -> dict[str, Any]:
    task = validate_task(repo, manifest, controller_module, continuity_module)
    return {
        "mode": "offline_preview",
        "valid": True,
        "task_id": task["id"],
        "base_sha": task["base_sha"],
        "order": task["order"],
        "outputs": task["outputs"],
        "network_called": False,
    }


def run_claim(repo: Path, worker_id: str, config: Path, controller_module: Any,
              continuity_module: Any,
              runner: Callable[..., tuple[Path, dict[str, Any]]] | None = None) -> dict[str, Any]:
    """Claim one approved task and complete it only from an exact successful proposal."""
    key = os.environ.get("OPENROUTER_API_KEY")
    if not isinstance(key, str) or not key.strip():
        raise BridgeError("Live mode requires the configured OpenRouter account key")
    try:
        routes = json.loads(config.read_text(encoding="utf-8"))
        if not isinstance(routes, dict) or not isinstance(routes.get("routes"), list) or not routes["routes"]:
            raise ValueError("routes")
        for route in routes["routes"]:
            continuity_module.validate_route(route)
            if route.get("provider") != "openrouter":
                raise ValueError("provider")
    except Exception as exc:
        raise BridgeError("Live mode requires a configured official OpenRouter free route") from exc

    controller = controller_module.Controller(repo)
    try:
        # A bounded free-model fallback can take longer than the controller's
        # five-minute default lease; this remains below its one-hour maximum.
        lease = controller.claim(worker_id, ttl=900)
    except Exception as exc:
        raise BridgeError("No task lease could be acquired") from exc
    if lease is None:
        return {"mode": "live", "status": "idle"}

    manifest = lease.get("manifest")
    token = lease.get("lease_token")
    try:
        task = validate_task(repo, manifest, controller_module, continuity_module)
        if not isinstance(token, str) or not token:
            raise BridgeError("Lease validation failed")
        task_path = _write_private_task(repo, continuity_module, task)
        invoke = runner or continuity_module.run_task
        directory, state = invoke(repo, task_path, config)
        if not isinstance(state, dict) or state.get("status") != "proposed":
            return {"mode": "live", "status": "proposal_not_accepted", "task_id": task["id"]}
        proposal_path = continuity_module.plain(Path(directory) / "proposal.json")
        proposal = json.loads(proposal_path.read_text(encoding="utf-8"))
        if (not isinstance(proposal, dict)
                or set(proposal) != {"summary", "files", "remaining"}
                or not isinstance(proposal["summary"], str)
                or not isinstance(proposal["files"], dict)
                or set(proposal["files"]) != set(task["outputs"])
                or any(not isinstance(value, str) for value in proposal["files"].values())
                or not isinstance(proposal["remaining"], list)):
            return {"mode": "live", "status": "proposal_scope_rejected", "task_id": task["id"]}
        result = {"files": proposal["files"], "summary": proposal["summary"]}
        controller.complete(task["id"], worker_id, token, result)
        return {"mode": "live", "status": "completed", "task_id": task["id"]}
    except BridgeError:
        raise
    except Exception as exc:
        # Do not print provider messages, prompt text, proposal contents or lease tokens.
        raise BridgeError("Task proposal failed validation or execution") from exc


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=REPO_DEFAULT)
    parser.add_argument("--manifest", type=Path, help="Coordinator manifest for offline preview")
    parser.add_argument("--worker-id", help="Registered controller worker used only with --live")
    parser.add_argument("--config", type=Path, default=CONTINUITY_CONFIG)
    parser.add_argument("--live", action="store_true", help="Claim one task and explicitly permit the configured provider route")
    args = parser.parse_args(argv)
    try:
        controller, continuity = load_components()
        root = args.repo.resolve(strict=True)
        if args.live:
            if not args.worker_id or args.manifest:
                raise BridgeError("Live mode requires --worker-id and does not accept --manifest")
            output = run_claim(root, args.worker_id, args.config, controller, continuity)
        else:
            if args.worker_id or not args.manifest:
                raise BridgeError("Offline preview requires --manifest and does not claim work")
            manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
            output = preview(root, manifest, controller, continuity)
        print(json.dumps(output, sort_keys=True, ensure_ascii=False))
        return 0
    except (BridgeError, OSError, json.JSONDecodeError) as exc:
        print("yellow-continuity-bridge: " + (str(exc) if isinstance(exc, BridgeError) else "local validation failed"), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
