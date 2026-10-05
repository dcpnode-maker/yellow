# Free Coding Runner (Order 745)

## Overview

The Free Coding Runner is a bounded, dependency-free TypeScript CLI executed by Bun that reuses installed agent CLI tools (primarily Google Antigravity) to perform automated coding jobs. It enforces a durable SQLite task queue, lease locking, path traversal protection, diff/hash verification, and audit controls.

> [!IMPORTANT]
> **Quota & Cost Doctrine**: This harness uses included/free account quota only. There is **no paid fallback**, no automatic retry, and no fallback to commercial/paid API endpoints (e.g. OpenAI/Anthropic keys).
> **Native AG Permissions & Audit Boundary**: Native Antigravity file permissions are account-level configuration, not scoped per-manifest. Existing operator config may include permissions from prior tasks. Post-run diff auditing inspects git and path hashes; it is **NOT** an OS security sandbox and does not monitor unversioned ignored files or external drives. There are **no claims of an exact write sandbox**. Native AG permissions remain the authoritative preventive boundary.
> **No Local Engine Active**: The Goose/Ollama adapter remains unverified and disabled pending a separate local-resource proof; no local model engine is active in this slice.

## Architecture

- **Runtime**: Bun (`C:/Users/astha/.bun/bin/bun.exe`)
- **Queue Database**: Built-in `bun:sqlite` with WAL mode on local disk.
- **Engine**: Antigravity (`C:/Users/astha/AppData/Local/agy/bin/agy.exe`) launched in dedicated trusted directory `D:/Yellow/temp/antigravity-quota-check-20260925` with fixed sandboxed arguments:
  `--sandbox --mode accept-edits --model gemini-3.8-flash-low --effort low --print-timeout <N>s --output-format json --print=<prompt>`
- **Local Planner Adapter (Disabled / Unverified)**: Goose CLI (`E:/yellow/goose/v1.51.0/dist-windows/resources/bin/goose.exe`) with Ollama provider. Marked unverified/disabled until independent local resource/health proof is completed. Rejects cloud models (`:cloud`) and URL protocols.

## Manifest Schema (Version 1)

Every task manifest must be a strict JSON object with:
- `version`: literal number `1`
- `id`: safe ASCII alphanumeric, underscore, hyphen (`<=64` chars)
- `workspace`: existing absolute directory (verified not to be a symlink or reparse point)
- `orderPath`: existing regular non-symlink file
- `prompt`: non-whitespace string (1..6000 chars)
- `writePaths`: 1..30 relative paths (no traversal, null bytes, alternate data streams, Windows reserved devices, or trailing dots/spaces)
- `checkPaths`: 0..10 relative test files (`*.test.ts`, `*.test.js`, etc.) strictly disjoint from `writePaths`
- `timeoutSeconds`: finite integer (30..600)
- `engine`: `"antigravity"`

## CLI Commands

```bash
# Display usage instructions
bun scripts/free-build/runner.ts help

# Check status of tasks (safe inspect, no file creation on missing db)
bun scripts/free-build/runner.ts status --db <db-path>

# Enqueue task manifest (validates paths, strict ASCII id, idempotency, pins check hashes)
bun scripts/free-build/runner.ts enqueue --manifest <manifest-path> --db <db-path>

# Inspect sanitized execution plan without invoking any models
bun scripts/free-build/runner.ts plan --id <task-id> --db <db-path>

# Execute single queued task under global database lease lock
bun scripts/free-build/runner.ts run --id <task-id> --db <db-path> --execute

# Run checkPaths test suite using Bun test (transitions to tests_passed)
bun scripts/free-build/runner.ts verify --id <task-id> --db <db-path>

# Recover dead/interrupted running task to needs_attention (refuses live or uncertain PIDs)
bun scripts/free-build/runner.ts recover --id <task-id> --db <db-path>
```

## Security & Verification Safeguards

1. **Path Boundary & Reparse Checks**:
   - `writePaths` and `checkPaths` are checked at enqueue and dynamically revalidated immediately after executor return and before post-run audits.
   - Workspaces that are symlinks or junctions are rejected.
2. **Provider Envelope Validation**:
   - Requires `{ status: "SUCCESS", response: "<non-empty prose>" }`.
   - Rejects empty envelopes, status `ERROR`, empty responses, or non-empty/malformed `denied_actions`.
   - Raw model stderr, prompts, or sensitive payloads are never written to database error columns; only sanitized bounded error messages are persisted.
3. **Hash Pinning & Tamper Resistance**:
   - `checkPaths` file hashes are pinned in SQLite at `enqueue`.
   - Verified before build, after build, and before/after verification tests.
   - Output files (`writePaths`) are hashed after build; any tampering before verification is rejected.
   - Runs with zero modified files fail into `needs_attention`.
4. **Git Workspace Diff Auditing**:
   - Inspects git workspace before and after execution (even on failures).
   - Pre-verifier git inspection fails closed to `needs_attention` on any error.
   - Missing git metadata during post-run audit fails closed.
5. **Execution Uncertain Latch & Failure Ordering**:
   - Subprocess timeouts, buffer overflows (4 MiB limit), or signal terminations immediately trigger a durable latch in SQLite `runner_meta (execution_uncertain = 1)` before any subsequent audit or check can throw.
   - This permanently blocks all subsequent `run` and `verify` invocations on that database until manual operator reconciliation.
   - No broad process-name kills are attempted; child processes must be reconciled manually.
