#!/usr/bin/env python3
"""Fail-closed integrity verifier for a private Yellow context packet."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from yellow_context import ContextError, verify_bundle


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--path", required=True)
    parser.add_argument("--lane", choices=("laptop", "phone"), required=True)
    args = parser.parse_args()
    try:
        result = verify_bundle(args.repo, args.path, args.lane)
    except (ContextError, FileNotFoundError) as exc:
        parser.error(str(exc))
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
