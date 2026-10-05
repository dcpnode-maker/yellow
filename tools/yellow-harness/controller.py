"""Offline, proposal-only coordinator for Yellow development workers.

No network listener or model-controlled shell execution is provided here. A future
remote transport must authenticate workers and preserve these state transitions.
"""

from __future__ import annotations

import argparse
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import subprocess
import sys
import time
from typing import Any


LABEL = re.compile(r"^[a-z][a-z0-9._-]{0,63}$")
SHA = re.compile(r"^[0-9a-f]{40}$")
MAX_RESULT_BYTES = 512_000


class HarnessError(ValueError):
    """A task, worker or state transition failed a controller precondition."""


def _git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode:
        raise HarnessError("Git repository or requested revision is unavailable")
    return result.stdout.strip()


def _label(value: Any, field: str) -> str:
    if not isinstance(value, str) or not LABEL.fullmatch(value):
        raise HarnessError(f"{field} must be a lowercase label")
    return value


def _json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


class Controller:
    def __init__(self, repo: Path | str, db_path: Path | str | None = None):
        self.repo = Path(repo).resolve(strict=True)
        _git(self.repo, "rev-parse", "--show-toplevel")
        if db_path is None:
            git_path = _git(self.repo, "rev-parse", "--git-path", "yellow-harness/state.sqlite3")
            path = Path(git_path)
            self.db_path = path if path.is_absolute() else self.repo / path
        else:
            self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        db = sqlite3.connect(self.db_path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("PRAGMA busy_timeout=10000")
        return db

    @contextmanager
    def _session(self):
        db = self._connect()
        try:
            with db:
                yield db
        finally:
            db.close()

    def _initialize(self) -> None:
        with self._session() as db:
            db.executescript(
                """
                CREATE TABLE IF NOT EXISTS workers (
                    id TEXT PRIMARY KEY,
                    capabilities TEXT NOT NULL,
                    enabled INTEGER NOT NULL CHECK(enabled IN (0,1))
                );
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    manifest TEXT NOT NULL,
                    state TEXT NOT NULL CHECK(state IN
                      ('awaiting_approval','ready','leased','completed')),
                    created_at INTEGER NOT NULL,
                    worker_id TEXT,
                    lease_hash TEXT,
                    lease_deadline INTEGER,
                    result TEXT,
                    result_hash TEXT
                );
                CREATE INDEX IF NOT EXISTS jobs_state_created
                    ON jobs(state, created_at, id);
                CREATE TABLE IF NOT EXISTS events (
                    seq INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id TEXT NOT NULL REFERENCES jobs(id),
                    kind TEXT NOT NULL,
                    at INTEGER NOT NULL,
                    actor TEXT NOT NULL
                );
                """
            )

    def _safe_path(self, raw: Any, *, exists: bool) -> str:
        if not isinstance(raw, str) or not raw or "\\" in raw or "\x00" in raw:
            raise HarnessError("Paths must be nonempty POSIX-style relative paths")
        parts = raw.split("/")
        if any(part in ("", ".", "..") for part in parts) or ":" in parts[0]:
            raise HarnessError("Absolute, drive and traversal paths are forbidden")
        candidate = self.repo.joinpath(*parts)
        cursor = self.repo
        for part in parts:
            cursor = cursor / part
            if cursor.is_symlink():
                raise HarnessError("Symlink paths are forbidden")
        resolved = candidate.resolve(strict=False)
        if os.path.commonpath([self.repo, resolved]) != str(self.repo):
            raise HarnessError("Path escapes repository")
        if exists and not candidate.is_file():
            raise HarnessError("Order and input files must exist")
        return raw

    def _manifest(self, data: Any) -> dict[str, Any]:
        if not isinstance(data, dict) or set(data) != {
            "id", "base_sha", "order", "inputs", "outputs", "goal",
            "capability", "data_classification",
        }:
            raise HarnessError("Task manifest fields do not match the worker contract")
        task_id = _label(data["id"], "id")
        capability = _label(data["capability"], "capability")
        head = _git(self.repo, "rev-parse", "HEAD")
        if not isinstance(data["base_sha"], str) or not SHA.fullmatch(data["base_sha"]):
            raise HarnessError("base_sha must be a full commit hash")
        if data["base_sha"] != head:
            raise HarnessError("base_sha differs from current HEAD")
        if data["data_classification"] != "public_source":
            raise HarnessError("Only public-source coding tasks are admitted")
        goal = data["goal"]
        if not isinstance(goal, str) or not 1 <= len(goal) <= 4000:
            raise HarnessError("goal must contain 1 to 4000 characters")
        order = self._safe_path(data["order"], exists=True)
        if not order.startswith("handoff/orders/") or not order.endswith(".md"):
            raise HarnessError("order must be a repository order Markdown file")
        inputs, outputs = data["inputs"], data["outputs"]
        if not isinstance(inputs, list) or not 1 <= len(inputs) <= 64:
            raise HarnessError("inputs must contain 1 to 64 files")
        if not isinstance(outputs, list) or not 1 <= len(outputs) <= 64:
            raise HarnessError("outputs must contain 1 to 64 files")
        clean_inputs = [self._safe_path(item, exists=True) for item in inputs]
        clean_outputs = [self._safe_path(item, exists=False) for item in outputs]
        if len(set(clean_inputs)) != len(clean_inputs) or len(set(clean_outputs)) != len(clean_outputs):
            raise HarnessError("Duplicate input or output path")
        # The exact base SHA must contain everything a remote worker may read.
        for path in [order, *clean_inputs]:
            _git(self.repo, "cat-file", "-e", f"{head}:{path}")
        return {
            "id": task_id, "base_sha": head, "order": order,
            "inputs": clean_inputs, "outputs": clean_outputs,
            "goal": goal, "capability": capability,
            "data_classification": "public_source",
        }

    def register_worker(self, worker_id: str, capabilities: list[str]) -> None:
        worker_id = _label(worker_id, "worker id")
        if not capabilities or len(capabilities) > 32:
            raise HarnessError("Worker needs 1 to 32 capabilities")
        clean = sorted({_label(item, "capability") for item in capabilities})
        with self._session() as db:
            db.execute(
                "INSERT INTO workers(id,capabilities,enabled) VALUES(?,?,1) "
                "ON CONFLICT(id) DO UPDATE SET capabilities=excluded.capabilities,enabled=1",
                (worker_id, _json(clean)),
            )

    def submit(self, data: Any, *, now: int | None = None) -> dict[str, Any]:
        manifest = self._manifest(data)
        at = int(time.time()) if now is None else now
        with self._session() as db:
            db.execute("BEGIN IMMEDIATE")
            active = db.execute(
                "SELECT manifest FROM jobs WHERE state IN ('awaiting_approval','ready','leased')"
            ).fetchall()
            targets = set(manifest["outputs"])
            for row in active:
                if targets.intersection(json.loads(row["manifest"])["outputs"]):
                    raise HarnessError("Output path overlaps an unfinished task")
            try:
                db.execute(
                    "INSERT INTO jobs(id,manifest,state,created_at) VALUES(?,?,'awaiting_approval',?)",
                    (manifest["id"], _json(manifest), at),
                )
            except sqlite3.IntegrityError as exc:
                raise HarnessError("Task id already exists") from exc
            db.execute(
                "INSERT INTO events(job_id,kind,at,actor) VALUES(?,'submitted',?,'coordinator')",
                (manifest["id"], at),
            )
        return self.status(manifest["id"])

    def approve(self, task_id: str, *, now: int | None = None) -> dict[str, Any]:
        at = int(time.time()) if now is None else now
        with self._session() as db:
            updated = db.execute(
                "UPDATE jobs SET state='ready' WHERE id=? AND state='awaiting_approval'",
                (task_id,),
            ).rowcount
            if updated != 1:
                raise HarnessError("Task is missing or not awaiting approval")
            db.execute(
                "INSERT INTO events(job_id,kind,at,actor) VALUES(?,'approved',?,'coordinator')",
                (task_id, at),
            )
        return self.status(task_id)

    def claim(self, worker_id: str, *, now: int | None = None, ttl: int = 300) -> dict[str, Any] | None:
        worker_id = _label(worker_id, "worker id")
        if not 30 <= ttl <= 3600:
            raise HarnessError("Lease TTL must be 30 to 3600 seconds")
        at = int(time.time()) if now is None else now
        with self._session() as db:
            db.execute("BEGIN IMMEDIATE")
            worker = db.execute(
                "SELECT capabilities FROM workers WHERE id=? AND enabled=1", (worker_id,)
            ).fetchone()
            if worker is None:
                raise HarnessError("Worker is unknown or disabled")
            expired = db.execute(
                "SELECT id FROM jobs WHERE state='leased' AND lease_deadline<=?", (at,)
            ).fetchall()
            for row in expired:
                db.execute(
                    "UPDATE jobs SET state='ready',worker_id=NULL,lease_hash=NULL,lease_deadline=NULL "
                    "WHERE id=?", (row["id"],)
                )
                db.execute(
                    "INSERT INTO events(job_id,kind,at,actor) VALUES(?,'lease_expired',?,'controller')",
                    (row["id"], at),
                )
            caps = set(json.loads(worker["capabilities"]))
            rows = db.execute(
                "SELECT id,manifest FROM jobs WHERE state='ready' ORDER BY created_at,id"
            ).fetchall()
            for row in rows:
                manifest = json.loads(row["manifest"])
                if manifest["capability"] not in caps:
                    continue
                token = secrets.token_hex(32)
                db.execute(
                    "UPDATE jobs SET state='leased',worker_id=?,lease_hash=?,lease_deadline=? WHERE id=?",
                    (worker_id, hashlib.sha256(token.encode()).hexdigest(), at + ttl, row["id"]),
                )
                db.execute(
                    "INSERT INTO events(job_id,kind,at,actor) VALUES(?,'claimed',?,?)",
                    (row["id"], at, worker_id),
                )
                return {"manifest": manifest, "lease_token": token, "lease_deadline": at + ttl}
        return None

    def _lease(self, db: sqlite3.Connection, task_id: str, worker_id: str, token: str,
               at: int, *, allow_completed: bool = False) -> sqlite3.Row:
        row = db.execute("SELECT * FROM jobs WHERE id=?", (task_id,)).fetchone()
        digest = hashlib.sha256(token.encode()).hexdigest() if isinstance(token, str) else ""
        if row is None or row["worker_id"] != worker_id or not secrets.compare_digest(
            row["lease_hash"] or "", digest
        ):
            raise HarnessError("Worker or lease token does not match")
        if row["state"] == "completed" and allow_completed:
            return row
        if row["state"] != "leased" or row["lease_deadline"] <= at:
            raise HarnessError("Lease is not active")
        return row

    def heartbeat(self, task_id: str, worker_id: str, token: str, *, now: int | None = None,
                  ttl: int = 300) -> int:
        if not 30 <= ttl <= 3600:
            raise HarnessError("Lease TTL must be 30 to 3600 seconds")
        at = int(time.time()) if now is None else now
        with self._session() as db:
            db.execute("BEGIN IMMEDIATE")
            self._lease(db, task_id, worker_id, token, at)
            db.execute("UPDATE jobs SET lease_deadline=? WHERE id=?", (at + ttl, task_id))
            db.execute(
                "INSERT INTO events(job_id,kind,at,actor) VALUES(?,'heartbeat',?,?)",
                (task_id, at, worker_id),
            )
        return at + ttl

    def complete(self, task_id: str, worker_id: str, token: str, result: Any,
                 *, now: int | None = None) -> dict[str, Any]:
        if not isinstance(result, dict) or set(result) != {"files", "summary"}:
            raise HarnessError("Result must contain exactly files and summary")
        if not isinstance(result["summary"], str) or len(result["summary"]) > 4000:
            raise HarnessError("Result summary must be at most 4000 characters")
        if not isinstance(result["files"], dict) or not all(
            isinstance(k, str) and isinstance(v, str) for k, v in result["files"].items()
        ):
            raise HarnessError("Result files must map paths to text proposals")
        payload = _json(result)
        if len(payload.encode("utf-8")) > MAX_RESULT_BYTES:
            raise HarnessError("Result exceeds the proposal size limit")
        digest = hashlib.sha256(payload.encode()).hexdigest()
        at = int(time.time()) if now is None else now
        with self._session() as db:
            db.execute("BEGIN IMMEDIATE")
            row = self._lease(db, task_id, worker_id, token, at, allow_completed=True)
            if set(result["files"]) != set(json.loads(row["manifest"])["outputs"]):
                raise HarnessError("Result file paths differ from declared outputs")
            if row["state"] == "completed":
                if row["result_hash"] != digest:
                    raise HarnessError("Completed task cannot be replaced")
                return self._status_row(row)
            db.execute(
                "UPDATE jobs SET state='completed',result=?,result_hash=? WHERE id=?",
                (payload, digest, task_id),
            )
            db.execute(
                "INSERT INTO events(job_id,kind,at,actor) VALUES(?,'completed',?,?)",
                (task_id, at, worker_id),
            )
        return self.status(task_id)

    @staticmethod
    def _status_row(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "id": row["id"], "state": row["state"], "worker_id": row["worker_id"],
            "lease_deadline": row["lease_deadline"], "result_hash": row["result_hash"],
        }

    def status(self, task_id: str) -> dict[str, Any]:
        with self._session() as db:
            row = db.execute("SELECT * FROM jobs WHERE id=?", (task_id,)).fetchone()
            if row is None:
                raise HarnessError("Task is unknown")
            return self._status_row(row)

    def result(self, task_id: str) -> dict[str, Any]:
        with self._session() as db:
            row = db.execute("SELECT state,result FROM jobs WHERE id=?", (task_id,)).fetchone()
            if row is None or row["state"] != "completed":
                raise HarnessError("Task has no completed proposal")
            return json.loads(row["result"])


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    commands = parser.add_subparsers(dest="command", required=True)
    register = commands.add_parser("register-worker")
    register.add_argument("worker_id")
    register.add_argument("capabilities", nargs="+")
    submit = commands.add_parser("submit")
    submit.add_argument("manifest", type=Path)
    for name in ("approve", "status", "result"):
        commands.add_parser(name).add_argument("task_id")
    commands.add_parser("claim").add_argument("worker_id")
    for name in ("heartbeat", "complete"):
        command = commands.add_parser(name)
        command.add_argument("task_id")
        command.add_argument("worker_id")
        command.add_argument("lease_token")
        if name == "complete":
            command.add_argument("result_file", type=Path)
    commands.add_parser("doctor")
    args = parser.parse_args(argv)
    try:
        controller = Controller(args.repo)
        if args.command == "doctor":
            output = {"repo": str(controller.repo), "head": _git(controller.repo, "rev-parse", "HEAD"),
                      "database": str(controller.db_path), "network_listener": False}
        elif args.command == "register-worker":
            controller.register_worker(args.worker_id, args.capabilities)
            output = {"worker_id": args.worker_id, "registered": True}
        elif args.command == "submit":
            output = controller.submit(json.loads(args.manifest.read_text(encoding="utf-8")))
        elif args.command == "approve":
            output = controller.approve(args.task_id)
        elif args.command == "claim":
            output = controller.claim(args.worker_id)
        elif args.command == "heartbeat":
            output = {"lease_deadline": controller.heartbeat(args.task_id, args.worker_id, args.lease_token)}
        elif args.command == "complete":
            result = json.loads(args.result_file.read_text(encoding="utf-8"))
            output = controller.complete(args.task_id, args.worker_id, args.lease_token, result)
        elif args.command == "status":
            output = controller.status(args.task_id)
        else:
            output = controller.result(args.task_id)
        print(_json(output))
        return 0
    except (HarnessError, OSError, json.JSONDecodeError) as exc:
        print(f"yellow-harness: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
