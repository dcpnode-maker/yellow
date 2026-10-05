"""Manually reviewed Worker 1 proposal, retained only as an evaluation fixture.

Not imported by the harness runtime or Yellow. Exact emitted function from the
28 September 2026 35.04-second Qwen task; no automatic source application.
"""

import json


def strict_object(text):
    if not isinstance(text, str):
        raise TypeError("input must be a str")
    if len(text.encode('utf-8')) > 1024:
        raise ValueError("input exceeds 1024 UTF-8 bytes")

    # Custom decoder that rejects NaN, Infinity, -Infinity and duplicate keys
    def _reject_constant(s):
        raise ValueError(f"Invalid JSON constant: {s}")

    def _reject_duplicate_keys(pairs):
        keys = [k for k, _ in pairs]
        if len(keys) != len(set(keys)):
            raise ValueError("Duplicate keys in JSON object")
        return dict(pairs)

    try:
        obj = json.loads(
            text,
            parse_constant=_reject_constant,
            object_pairs_hook=_reject_duplicate_keys
        )
    except ValueError as e:
        raise ValueError(str(e))

    if not isinstance(obj, dict):
        raise ValueError("input must be a JSON object")

    # Check for trailing non-whitespace: json.loads already handles this,
    # but let's verify by checking that the parsed content matches the stripped text
    # Actually, json.loads raises an error if there's trailing non-whitespace,
    # so this is already handled. But let's double-check by re-serializing and comparing?
    # No, json.loads will raise "Extra data" if there's trailing non-whitespace.
    # So we're good.

    return obj
