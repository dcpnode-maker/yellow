#!/usr/bin/env python3
"""Run independent coordinator-written task manifests concurrently."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import threading
import urllib.error

import continuity as c


def validate_jobs(root, jobs):
    if not isinstance(jobs, list) or not 1 <= len(jobs) <= 12:
        raise c.Blocked("A batch requires 1 to 12 bounded tasks")
    ids, claimed = set(), set()
    for job in jobs:
        if not isinstance(job, dict) or set(job) != {"task", "config"}:
            raise c.Blocked("Each job names one task and one route config")
        task = json.loads(Path(job["task"]).read_text(encoding="utf-8"))
        c.context_for(root, task)
        if task["id"] in ids:
            raise c.Blocked("Duplicate task id")
        ids.add(task["id"])
        for output in task.get("outputs", []):
            if any(output == old or output.startswith(old + "/") or old.startswith(output + "/") for old in claimed):
                raise c.Blocked("Parallel task output scopes overlap")
            claimed.add(output)
    return jobs


def run_batch(root, jobs, workers=2, caller=c.call_model):
    if type(workers) is not int or not 1 <= workers <= 4:
        raise c.Blocked("Use 1 to 4 workers; increase only after measuring quota and useful throughput")
    root = Path(root).resolve()
    validate_jobs(root, jobs)
    denied_providers = set()
    guard = threading.Lock()

    def shared_call(route, messages, tokens):
        with guard:
            if route["provider"] in denied_providers:
                raise c.Blocked("Provider stopped for this batch after quota/access rejection")
        try:
            return caller(route, messages, tokens)
        except urllib.error.HTTPError as e:
            if e.code in (401, 403, 429):
                with guard:
                    denied_providers.add(route["provider"])
            raise

    def execute(job):
        try:
            folder, state = c.run_task(root, job["task"], job["config"], caller=shared_call)
            return {"task": job["task"], "status": state["status"], "receipts": str(folder)}
        except (c.Blocked, OSError, ValueError) as e:
            return {"task": job["task"], "status": "blocked", "error_type": type(e).__name__}

    with ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(execute, jobs))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("manifest", help="JSON list of task/config paths")
    p.add_argument("--repo", default=".")
    p.add_argument("--workers", type=int, default=2)
    a = p.parse_args()
    try:
        result = run_batch(a.repo, json.loads(Path(a.manifest).read_text()), a.workers)
        print(json.dumps(result, indent=2))
        return 0 if all(x["status"] == "proposed" for x in result) else 2
    except (c.Blocked, OSError, ValueError) as e:
        print("Blocked:", str(e))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
