#!/usr/bin/env python3
"""Dispatch one bounded proposal to each admitted Yellow local worker in parallel."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

from yellow_context import ContextError, contains_secret, verify_bundle


NODES = {
    "laptop": {"url": "http://127.0.0.1:11434", "limit": 6 * 1024, "timeout": 360},
    "oneplus10r": {"url": "http://127.0.0.1:11435", "limit": 6 * 1024, "timeout": 180},
    "oneplus11r": {"url": "http://127.0.0.1:11436", "limit": 6 * 1024, "timeout": 180},
}


class DispatchError(RuntimeError):
    pass


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        return None


def _private_context(repo: Path, value: str) -> tuple[Path, str]:
    try:
        verify_bundle(repo, value)
    except (ContextError, FileNotFoundError) as exc:
        raise DispatchError(str(exc)) from exc
    path = Path(value).resolve(strict=True)
    text = path.read_text(encoding="utf-8")
    return path, text


def _request(url: str, payload: dict, timeout: int, api_key: str | None = None) -> dict:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    request = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST"
    )
    try:
        with urllib.request.build_opener(_NoRedirect).open(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise DispatchError(f"Worker request failed: {type(exc).__name__}") from exc


def _discover_phone_model(base: str, key: str) -> str:
    request = urllib.request.Request(
        f"{base}/v1/models", headers={"Authorization": f"Bearer {key}"}, method="GET"
    )
    try:
        with urllib.request.build_opener(_NoRedirect).open(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
        model = payload["data"][0]["id"]
    except Exception as exc:
        raise DispatchError("Phone model discovery failed without exposing credentials.") from exc
    if not isinstance(model, str) or not model:
        raise DispatchError("Phone returned no model identifier.")
    return model


def _dispatch(repo: Path, node: str, context: str, task: str) -> dict[str, object]:
    config = NODES[node]
    rendered = f"{context}\n\n# Assigned task\n{task.strip()}\n"
    wire_text = rendered if node == "laptop" else "/no_think\n" + rendered
    if contains_secret(task) or contains_secret(wire_text):
        raise DispatchError(f"Potential credential material detected in {node} input.")
    input_bytes = len(wire_text.encode("utf-8"))
    if input_bytes > config["limit"]:
        raise DispatchError(f"{node} rendered input exceeds {config['limit']} bytes.")
    started = time.monotonic()
    if node == "laptop":
        payload = _request(
            f"{config['url']}/api/generate",
            {
                "model": "qwen3.5:9b", "prompt": rendered, "stream": False, "think": False,
                "options": {"num_ctx": 4096, "num_predict": 1024, "temperature": 0.1},
            },
            config["timeout"],
        )
        response_text = payload.get("response", "")
        model = "qwen3.5:9b"
    else:
        key_file = repo / ".git" / "yellow-local-ai" / "android" / "keys" / f"{node}.api-key"
        if not key_file.is_file():
            raise DispatchError(f"Missing private key file for {node}.")
        key = key_file.read_text(encoding="utf-8").strip()
        if not key:
            raise DispatchError(f"Empty private key file for {node}.")
        model = _discover_phone_model(config["url"], key)
        payload = _request(
            f"{config['url']}/v1/chat/completions",
            {
                "model": model,
                "messages": [{"role": "user", "content": wire_text}],
                "temperature": 0.1,
                "max_tokens": 512,
                "stream": False,
            },
            config["timeout"],
            key,
        )
        try:
            response_text = payload["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise DispatchError(f"{node} returned no proposal content.") from exc
        finally:
            key = ""
    if not isinstance(response_text, str) or not response_text.strip():
        raise DispatchError(f"{node} returned an empty proposal.")
    if contains_secret(response_text):
        raise DispatchError(f"{node} returned potential credential material; response was not persisted.")
    elapsed = round(time.monotonic() - started, 3)
    return {
        "node": node,
        "model": model,
        "input_bytes": input_bytes,
        "elapsed_seconds": elapsed,
        "task_sha256": hashlib.sha256(task.encode("utf-8")).hexdigest(),
        "response": response_text.strip(),
    }


def dispatch(repo: Path, context_path: str, tasks: dict[str, str]) -> dict[str, object]:
    repo = repo.resolve(strict=True)
    packet_path, context = _private_context(repo, context_path)
    manifest = json.loads(packet_path.with_suffix(".json").read_text(encoding="utf-8"))
    if any(node != "laptop" for node in tasks) and manifest.get("lane") != "phone":
        raise DispatchError("Phone dispatch requires a phone-lane context packet.")
    if set(tasks) - set(NODES):
        raise DispatchError("Unknown worker requested.")
    if not tasks:
        raise DispatchError("At least one worker task is required.")
    results: list[dict[str, object]] = []
    failures: list[dict[str, str]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(tasks)) as pool:
        futures = {pool.submit(_dispatch, repo, node, context, task): node for node, task in tasks.items()}
        for future in concurrent.futures.as_completed(futures):
            node = futures[future]
            try:
                results.append(future.result())
            except Exception as exc:  # failure receipts intentionally exclude request data
                failures.append({"node": node, "error": str(exc)})
    result_root = repo / ".git" / "yellow-local-ai" / "results"
    result_root.mkdir(parents=True, exist_ok=True)
    receipts = []
    for result in sorted(results, key=lambda item: str(item["node"])):
        response = str(result.pop("response"))
        digest = hashlib.sha256(response.encode("utf-8")).hexdigest()
        output = result_root / f"{result['node']}-{digest}.md"
        output.write_text(response + "\n", encoding="utf-8")
        receipts.append({**result, "response_sha256": digest, "artifact": str(output)})
    receipt = {
        "schema": 1,
        "context": str(packet_path),
        "context_sha256": hashlib.sha256(context.encode("utf-8")).hexdigest(),
        "results": receipts,
        "failures": sorted(failures, key=lambda item: item["node"]),
    }
    receipt_bytes = json.dumps(receipt, indent=2, sort_keys=True) + "\n"
    receipt_hash = hashlib.sha256(receipt_bytes.encode("utf-8")).hexdigest()
    receipt_path = result_root / f"dispatch-{receipt_hash}.json"
    receipt_path.write_text(receipt_bytes, encoding="utf-8")
    return {**receipt, "receipt": str(receipt_path)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--context", required=True)
    parser.add_argument("--laptop-task")
    parser.add_argument("--oneplus10r-task")
    parser.add_argument("--oneplus11r-task")
    args = parser.parse_args()
    tasks = {
        node: task for node, task in {
            "laptop": args.laptop_task,
            "oneplus10r": args.oneplus10r_task,
            "oneplus11r": args.oneplus11r_task,
        }.items() if task
    }
    try:
        result = dispatch(args.repo, args.context, tasks)
    except DispatchError as exc:
        parser.error(str(exc))
    print(json.dumps(result, indent=2, sort_keys=True))
    return 1 if result["failures"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
