# Review 635 — Housekeeping transition timestamp precision

Reviewer: Codex independent reviewer (did not implement Order 635)
Date: 2026-09-23
Verdict: ACCEPTED

## Scope inspected

- `handoff/orders/635-housekeeping-transition-precision.md`
- `migrations/0100_housekeeping_transition_timestamp_precision.sql`
- `src/http/operator.ts`
- `tests/housekeeping-task-lifecycle.integration.test.ts`
- `tests/schema/expected.sql`
- `tools/prove-public-housekeeping-transition-flow.ts`
- `handoff/LEDGER.md`

## Findings

1. Resolved on rereview: the accidental out-of-scope `record_occupancy` schema snapshot change is gone. The current `tests/schema/expected.sql` diff is scoped to `transition_housekeeping_task`: millisecond-truncated `v_now` and millisecond-truncated evidence comparison.

2. Resolved on rereview: P3b now seeds `unit_condition.updated_at` at `2026-08-28T00:11:00.000456Z`, rejects a genuinely different millisecond evidence value (`2026-08-28T00:11:00.001Z`) as `HousekeepingConflictError`, checks unchanged task/condition state, and checks no fact/outbox/idempotency growth before proving the matching millisecond evidence succeeds.

3. Resolved on final rereview: a clean isolated PostgreSQL proof environment was made available at `yellow-order635-proof-postgres` on port `55635`, with env values in `.yellow-order635-proof.env`. I personally loaded that env and executed `bun test tests/housekeeping-task-lifecycle.integration.test.ts`; the real governed lifecycle suite passed 6/0 with 43 assertions, including the new P3b precision boundary and the existing SECURITY DEFINER containment, rollback, stale/foreign/inactive, replay and contention cases.

4. Non-blocking observation: `scripts/migrate.ts` now filters PostgreSQL 18 `pg_constraint.contype = 'n'` rows while validating `public.schema_migration`. I inspected the one-line change and the accompanying Order 636. It is compatible with the proof path because schema-migration column nullability is still validated through `pg_attribute.attnotnull`, while CHECK, primary-key and unique constraints remain in the exact constraint comparison.

5. Non-blocking observation: the migration body itself preserves the important guards I inspected: `SECURITY DEFINER`, constrained `search_path`, `session_user`/role/current_user containment, tenant context match, property/task/actor/status/condition checks, row locks, same-transaction task/condition/fact/outbox behavior, and explicit revoke/grant. The precision comparison at lines 116-119 is appropriate for the API's canonical millisecond ISO evidence.

6. Non-blocking observation: `parseHousekeepingTransition` still rejects non-canonical timestamps after normalization and passes canonical ISO strings to the service. Accepting a `Date` object is harmless for current JSON HTTP input, though the order did not require it.

## Commands and results

- `Get-Content -Raw PROJECT.md` — reviewed the canonical invariants.
- `./state.sh` — exited 0 but printed no output in this PowerShell session.
- `Get-Content -Raw docs/PROJECT-STATUS.md` and `Get-Content -Raw BUILD-PLAN.md` — reviewed current project state; outputs were large/truncated by the tool.
- `Select-String -Path DECISIONS.log -Pattern "housekeeping|transition|precision|SECURITY DEFINER|status" -CaseSensitive:$false` — confirmed the standing independent-review and invariant posture; output was large/truncated.
- `git status --short` — candidate files were dirty/untracked, including the migration, operator/test/schema updates, order, proof script and ledger.
- `bun run typecheck` — PASS.
- `bun test tests/housekeeping-task-lifecycle.integration.test.ts` — 0 pass / 8 skip / 0 fail because no housekeeping deploy/runtime database URLs were configured.
- `bun run schema:check` — FAIL before checking drift: `YELLOW_SCHEMA_DATABASE is required`.
- `./setup.sh --db-only` — exited 0 with no output; did not produce the required `11 passed, 0 failed` proof in this shell.
- `bun test tests/security-definer-containment.integration.test.ts` — 0 pass / 3 skip / 0 fail because database URLs were not configured.
- `bun test tests/runtime-dml-authority.integration.test.ts` — 1 pass / 6 skip / 0 fail; only the source-map/static portion ran.
- `bun test tests/operator-arrival-room-cleaning-task-ui.integration.test.ts tests/operator-checkin-housekeeping-continuity-navigation.integration.test.ts tests/operator-checkout-housekeeping-continuity-navigation.integration.test.ts tests/operator-arrival-cleaning-checkin-continuity-navigation.integration.test.ts` — PASS, 29 pass / 0 fail / 443 assertions.

Rereview commands:

- `git diff -- src/http/operator.ts tests/housekeeping-task-lifecycle.integration.test.ts tests/schema/expected.sql migrations/0100_housekeeping_transition_timestamp_precision.sql handoff/reviews/635-housekeeping-transition-precision.md` — inspected the current scoped diff; migration is untracked so it was also read directly.
- `Get-Content -Raw migrations/0100_housekeeping_transition_timestamp_precision.sql` — inspected the full replacement function, owner, revokes and grant.
- `bun run typecheck` — PASS.
- `bun test tests/operator-housekeeping-workbench.integration.test.ts tests/housekeeping-task-lifecycle.integration.test.ts` — 5 pass / 8 skip / 0 fail / 53 assertions. The five runnable workbench tests passed; all eight lifecycle tests, including P3b, skipped because no governed DB env was configured.
- `bun test tests/runtime-dml-authority.integration.test.ts tests/security-definer-containment.integration.test.ts` — 1 pass / 9 skip / 0 fail / 48 assertions. Only the static caller-map test ran; DB authority/security-definer tests skipped.

Final proof commands:

- `Get-Content .yellow-order635-proof.env` — inspected the clean isolated proof container/env values.
- `git diff -- scripts/migrate.ts handoff/orders/636-postgres18-ledger-verifier.md handoff/reviews/635-housekeeping-transition-precision.md tests/housekeeping-task-lifecycle.integration.test.ts tests/schema/expected.sql migrations/0100_housekeeping_transition_timestamp_precision.sql` — inspected the PG18 verifier fix and final Order 635 diff.
- `Get-Content -Raw handoff/orders/636-postgres18-ledger-verifier.md` — inspected the scoped PG18 migration-ledger verifier order.
- Loaded `.yellow-order635-proof.env`, set `YELLOW_REQUIRE_HOUSEKEEPING=1`, then ran `bun test tests/housekeeping-task-lifecycle.integration.test.ts` — PASS, 6 pass / 0 fail / 43 assertions.
- Tried `bun run schema:check` against the proof URL by setting `YELLOW_SCHEMA_DATABASE=$env:YELLOW_DEPLOY_DATABASE_URL` — expected harness mismatch, failed before drift comparison with `Invalid YELLOW_SCHEMA_DATABASE: postgres://...`; inspection of `scripts/schema-drift.ts` shows this checker expects a database name matching `^yellow_[a-z0-9_]+$` and shells through the project Compose `postgres` service, so it cannot target the isolated proof container by URL.

## Invariant assessment

The proposed housekeeping function change does not directly mutate occupancy or finance, and the function body retains the tenant/property/task/status/condition/actor guards. The two source-level rejection findings from the first review are fixed, and the required independent real-PostgreSQL lifecycle proof now passes on a clean isolated database migrated through Order 635. The PG18 migration-ledger verifier fix used to create that proof database is narrowly scoped and does not weaken nullability/CHECK/PK/UNIQUE validation.

## Required fixes before rereview

None for Order 635.
