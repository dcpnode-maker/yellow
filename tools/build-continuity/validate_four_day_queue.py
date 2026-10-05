#!/usr/bin/env python3
"""Validate the bounded four-day Yellow worker queue without executing it."""

from __future__ import annotations

import argparse
import json
from pathlib import Path, PurePosixPath


LANES = {
    "codex-coordinator",
    "free-review-swarm",
    "independent-review",
    "local-10r",
    "local-11r",
    "local-phones",
    "native-test",
    "omni-free",
    "release-owner",
    "spark",
}
STATES = {
    "accepted",
    "blocked",
    "blocked-dependency",
    "complete-awaiting-review",
    "prepared",
    "prepared-unlaunched",
    "running",
    "waiting-capability",
    "waiting-endpoint",
}
READ_ONLY_RISKS = {"read-only", "release", "architecture", "integration", "high", "operational-proof"}


class QueueError(ValueError):
    pass


def _relative_file(root: Path, value: object, label: str) -> Path:
    if not isinstance(value, str) or not value:
        raise QueueError(f"{label} must be a non-empty repository path")
    path = PurePosixPath(value)
    if path.is_absolute() or "\\" in value or any(part in {"", ".", ".."} for part in path.parts):
        raise QueueError(f"{label} must be a canonical relative path")
    target = root.joinpath(*path.parts)
    if not target.is_file():
        raise QueueError(f"{label} does not exist: {value}")
    return target


def _overlap(left: str, right: str) -> bool:
    return left == right or left.startswith(right + ":") or right.startswith(left + ":")


def validate_queue(root: Path, payload: object) -> dict[str, int]:
    root = root.resolve(strict=True)
    if not isinstance(payload, dict) or set(payload) != {"schema", "order", "writer_limit", "days"}:
        raise QueueError("queue must contain exactly schema, order, writer_limit and days")
    if payload["schema"] != 1 or payload["writer_limit"] != 1:
        raise QueueError("schema must be 1 and writer_limit must be exactly 1")
    _relative_file(root, payload["order"], "queue order")
    days = payload["days"]
    if not isinstance(days, list) or [day.get("day") for day in days if isinstance(day, dict)] != [1, 2, 3, 4]:
        raise QueueError("queue must contain days 1 through 4 exactly once and in order")

    tasks: dict[str, dict] = {}
    for day in days:
        if set(day) != {"day", "goal", "tasks"} or not isinstance(day["goal"], str) or not day["goal"].strip():
            raise QueueError("each day requires only day, goal and tasks")
        if not isinstance(day["tasks"], list) or not day["tasks"]:
            raise QueueError("each day requires at least one task")
        for task in day["tasks"]:
            expected = {"id", "lane", "state", "risk", "depends_on", "order", "writes", "validation"}
            if not isinstance(task, dict) or set(task) != expected:
                raise QueueError("each task must use the exact queue task schema")
            task_id = task["id"]
            if not isinstance(task_id, str) or not task_id or task_id in tasks:
                raise QueueError("task IDs must be unique non-empty strings")
            if task["lane"] not in LANES or task["state"] not in STATES:
                raise QueueError(f"unknown lane or state for {task_id}")
            if not isinstance(task["risk"], str) or not task["risk"]:
                raise QueueError(f"missing risk for {task_id}")
            if not isinstance(task["depends_on"], list) or len(set(task["depends_on"])) != len(task["depends_on"]):
                raise QueueError(f"invalid dependencies for {task_id}")
            if not isinstance(task["writes"], list) or len(set(task["writes"])) != len(task["writes"]):
                raise QueueError(f"invalid write scopes for {task_id}")
            if not isinstance(task["validation"], list) or not task["validation"] or any(not isinstance(item, str) or not item for item in task["validation"]):
                raise QueueError(f"missing validation for {task_id}")
            _relative_file(root, task["order"], f"order for {task_id}")
            for scope in task["writes"]:
                if not isinstance(scope, str) or not scope or scope.startswith(('.', '/', '\\')) or ".." in scope.split(":"):
                    raise QueueError(f"invalid write scope for {task_id}")
            tasks[task_id] = task

    for task_id, task in tasks.items():
        missing = set(task["depends_on"]) - set(tasks)
        if missing or task_id in task["depends_on"]:
            raise QueueError(f"missing or self dependency for {task_id}")

    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(task_id: str) -> None:
        if task_id in visiting:
            raise QueueError("dependency cycle detected")
        if task_id in visited:
            return
        visiting.add(task_id)
        for dependency in tasks[task_id]["depends_on"]:
            visit(dependency)
        visiting.remove(task_id)
        visited.add(task_id)

    for task_id in tasks:
        visit(task_id)

    ancestors: dict[str, set[str]] = {}

    def collect(task_id: str) -> set[str]:
        if task_id not in ancestors:
            result: set[str] = set(tasks[task_id]["depends_on"])
            for dependency in tasks[task_id]["depends_on"]:
                result.update(collect(dependency))
            ancestors[task_id] = result
        return ancestors[task_id]

    for task_id in tasks:
        collect(task_id)
    writer_ids = [task_id for task_id, task in tasks.items() if task["writes"]]
    for index, left_id in enumerate(writer_ids):
        for right_id in writer_ids[index + 1 :]:
            ordered = left_id in ancestors[right_id] or right_id in ancestors[left_id]
            overlaps = any(_overlap(left, right) for left in tasks[left_id]["writes"] for right in tasks[right_id]["writes"])
            if overlaps and not ordered:
                raise QueueError(f"unordered overlapping writer scopes: {left_id} and {right_id}")

    return {"days": len(days), "tasks": len(tasks), "writers": len(writer_ids), "dependencies": sum(len(task["depends_on"]) for task in tasks.values())}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("queue", type=Path)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    try:
        result = validate_queue(args.repo, json.loads(args.queue.read_text(encoding="utf-8")))
    except (OSError, json.JSONDecodeError, QueueError) as exc:
        parser.error(str(exc))
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

