# Order 277 — independent Tier-3 review of the Order276 setup oracle

**Reviewed commit:** `7888ebe0691b72aa8ba426da279f40c5a6e88875`
**Reviewer:** fresh independent non-implementing Codex Tier-3 reviewer
**Date:** 2026-08-29
**Verdict:** **APPROVED**

## Scope and exact-diff inspection

The reviewed commit is an exact descendant of the previously product-reviewed
Order276 commit `9a4a958fe22773547cfffc7d136046df8410d22e`. A reviewer-personal ancestry check
exited `0`, and an exact diff over `migrations`, `src`, `tests`, `scripts`,
`docker-compose.yml`, `package.json` and `bun.lock` returned no paths. The commit
changes eight files: seven bounded order/governance records and `setup.sh`.

The executable `setup.sh` diff is exactly two adjacent lines. It changes the exact
public-table assertion and message from `99` after migrations `1-47` to `100` after
migrations `1-48`. Replacing those three new literals with their old values makes the
entire file byte-equivalent to its parent. Setup sequencing, database authority,
provisioning, migrations, seed, referee invocation, ports and app startup logic are
therefore unchanged. `git diff --check 7888ebe^ 7888ebe` exits `0`.

## Reviewer-personal canonical database proof

From the authoritative worktree, I ran the complete committed command in a fresh,
isolated Compose project with unused ports:

```text
COMPOSE_PROJECT_NAME=yellow-review277-tier3
YELLOW_APP_PORT=35977
YELLOW_POSTGRES_PORT=35978
YELLOW_VALKEY_PORT=35979
./setup.sh --db-only
```

Windows Bun was exposed to WSL through a temporary `/tmp` symlink and the three
database URL/password variable names were included in `WSLENV`; no credential value
was printed or copied into review evidence. Two initial wrapper attempts failed before
`setup.sh` or Docker ran (first on a shell-expanded symlink target, then on an
unquoted inherited Windows `PATH`). The corrected temporary wrapper used a fixed
POSIX-only `PATH`, after which the canonical script itself ran once and exited `0`.

That successful run personally proved:

- exact migrations `0001` through `0048` applied to both `yellow_dev` and
  `yellow_test`;
- `yellow_test tables: 100 after migrations 1-48`;
- `90` RLS-enabled tables, with the referee also reporting `90` tenant tables,
  `90` RLS tables and `90` policies;
- the integrated referee result `11 passed, 0 failed of 11`;
- `--db-only` did not start an application.

The disposable review project, its containers, network and volume are absent after
proof. The temporary WSL Bun shim was removed. No application, database, cache,
schema, data, credential or repository file was mutated by cleanup.

## Reviewer-personal standing and static proof

- `bun test`: **870 passed, 798 environment-skipped, 0 failed, 8,785 expectations;
  1,668 tests across 298 files**;
- `bun run typecheck`: exit `0`;
- `bun run boundaries`: **100 TypeScript files scanned**;
- `bun run license-check`: **23 packages passed**;
- `bun audit`: **0 vulnerabilities**;
- `git diff --check 7888ebe^ 7888ebe`: exit `0`.

## Stable-local containment

After proof, the sole running local remains exactly:

- app `92cffafb9351…`, healthy, restart count `0`, loopback `3000`, `/health` HTTP
  `200`;
- PostgreSQL `f4f02655770a…`, healthy, restart count `0`, loopback `5545`;
- Valkey `aa3061bdf231…`, healthy, restart count `0`, loopback `6485`.

No other container is running. Ports `3002` and `3188` are closed. The exact stable
container IDs, image IDs and start times match the pre-proof snapshot.

## Findings and approval consequence

No finding remains. Order277 is approved: it repairs only the stale canonical proof
oracle and preserves the exact-count fail-closed behavior.

**Order276 may now be approved.** D-722's sole blocking finding was the nonzero
canonical setup gate; the corrected exact descendant now executes that complete gate
green. The Order276 product, migration, schema, tests, RLS and authority surface is
byte-identical to the commit already inspected in D-722, where no product finding was
identified and the focused database/authority proofs were green.

This approval remains limited to Order276's registered-recipient candidate-evidence
boundary. It grants no legal-buyer/window designation, `BuyerDtls`, place-of-supply,
tax decomposition, document, submission, API, UI, local promotion, merge, public or
production deployment, Phase-7 or application-complete authority.
