# Orders 045–091 — independent-review and repair plan

**Frontier:** `4874f5cd8052435d5c5d2f67698f6088cff502fe`
**Status:** all manifest rows remain UNVERIFIED; Orders 019–044 remain the last
independently approved implementation range.

## Ground truth

- `origin/main` is a strict ancestor of the frontier; the frontier is 212 commits ahead.
- Every discovered build checkpoint is a strict ancestor of the frontier. There is one
  linear implementation lineage.
- Orders 087 and 088 have no files in `handoff/orders/` and no corresponding commits.
  D-280 reserved those numbers during a renumbered Phase-4 plan, but implementation
  proceeded from 086 to 089. They are sequence gaps, not review debt.
- F11/F12 were corrected by Order 074. F11 later regressed for a different fixture
  reason after Order 082 and Order 083 reports the repair. Both must be re-executed.
- The exact-tip builder baseline is green, but it is not independent review.

## Review waves, highest risk first

### Wave A — protected floor and inherited findings

An independent agent that did not implement Orders 045–091 executes:

1. protected hashes and history for `migrations/0001_init.sql` and
   `tests/run_invariants.py`;
2. frozen install, typecheck, boundaries, licence, audit, exact schema and fresh
   app-never-started `./setup.sh --db-only`;
3. Order 074's always-on SQL-syntax canaries and all five inherited operator suites;
4. the 13-suite `bun run phase3:gate`, proving the Order-083 fixture correction;
5. founder-status derivation, confirming review coverage remains exactly Order 044.

Any assertion failure returns a precise finding. Repair occurs under a new bounded
order and is re-executed by a non-implementing reviewer from the top of this wave.

### Wave B — tenancy, audit, occupancy and reservation transitions

Review Orders 047–062 and 080–086 together by invariant surface, not chronology:

- durable idempotency, facts/outbox atomicity and tenant-local permissions;
- OOO/OOS, holds, expiry, projection rebuild/consumer and offline lease proofs;
- reservation state registry, held/direct commit races, offer truth, lifecycle commands
  and segment move/extend/shorten arbitration;
- direct occupancy denial (42501), exact one-winner races, rollback/replay and
  cross-tenant negative fixtures.

These are high-risk and require reviewer-executed database proofs. No partial wave
approval advances the manifest unless the review file names the exact covered orders.

### Wave C — exact money, rate history and four-eyes publication

Review Orders 050–052 and 063–079 plus 091:

- bigint-only money and exact currency boundaries;
- insert-only price/release history and race-safe supersession;
- targeting/composition/evaluator/quote evidence and bounded-work assertions;
- simulation, approval, publication and undo atomicity with different operators;
- RMS economics arithmetic, overflow rejection, exact rational evidence and the strict
  boundary between calculation and accounting/tax/operational authority.

This wave requires an independent reviewer because it touches commercial money and
state transitions, even where modules are pure.

### Wave D — HTTP, operator UI, AI boundary and routine surfaces

Review remaining Orders 045–049, 053–057, 064, 071–078, 084, 089 and 090 for:

- fail-closed Windows state and reproducible local review;
- authentication/authorization before mutation, strict calendar parsing and generic
  error boundaries;
- browser asset security, truthful founder status and no client-side authority;
- AI provider fail-closed configuration, minimized transport, zero-network default,
  bounded responses and proposal-only authority.

Database-backed overlaps already approved in Waves A–C may be cited by commit and
review file; they are not silently reclassified as routine.

## Evidence and repair protocol

Each reviewer writes `handoff/reviews/<range>-<surface>.md` with identity, exact commit,
commands, outputs, assertion-fidelity notes, scope findings and verdict. `APPROVED` may
cover only named orders/proofs personally executed by that reviewer. `CHANGES REQUIRED`
creates a new repair order; the repair implementer cannot execute the qualifying review.
`handoff/GATE-3-MANIFEST.md` remains historical debt inventory until review files make
coverage derivable. Nobody merges their own work, and `main` remains untouched until the
reviewed integration PR is green.

## Executable ownership matrix

The reviewer uses native Linux Bun 1.3.14 and one freshly created/migrated isolated
database per database-gated file. `*_URL` points only to that file's database;
`*_PASSWORD` values are non-production proof inputs. A command passes only when it exits
zero with no skipped named order assertions. The order's Pre-registered proof remains
the assertion-fidelity specification; this table fixes command and discharge ownership.

| Final discharge owner | Orders | Exact command(s) | Expected result |
|---|---|---|---|
| Wave A | 048, 050–052, 057, 064–066, 069–070, 078–079, 083 | `YELLOW_PHASE3_GATE_ADMIN_URL=postgres://yellow:yellow@127.0.0.1:5442/postgres YELLOW_PHASE3_GATE_PASSWORD=YellowReviewOnly2026! bun run test:phase3-gate` | `13/13 suites passed with isolated databases`; covers inherited F11 fixtures and founder-status derivation |
| Wave A | protected floor | `sha256sum migrations/0001_init.sql tests/run_invariants.py`; `bun install --frozen-lockfile`; `bun run typecheck`; `bun run boundaries`; `bun run license-check`; `bun audit`; `YELLOW_SCHEMA_DATABASE=yellow_test bun run schema:check`; `./setup.sh --db-only` | exact recorded hashes, no lock change, all commands exit 0, schema exact, `11 passed, 0 failed of 11` |
| Wave A | 074 | `bun test tests/operator-assets-security.test.ts`; execute the five inherited operator suites through the Wave-A 13-suite command | always-on SQL canaries 3/3 and inherited suites green; founder status remains reviewed through 044 |
| Wave B | 047 | Execute B0 below after `fresh_db yellow_review_047` | Order-047 P1–P6 pass, zero skips |
| Wave B | 049, 053–056, 058–062 | Execute B1–B10 below after `fresh_db <name>` for each named database | Every named P assertion for the owned orders passes with zero skips; rollback, tenant and concurrency negatives remain active |
| Wave B | 080 | `bun test tests/reservation-state-machine.test.ts` | 5 pass, exact Markdown/state registry equality |
| Wave B | 081–082, 084–086 | Execute B11–B15 below after `fresh_db <name>` for each named database | Every named Order-081–082/084–086 assertion passes with zero skips; one-winner, choke-point, replay, rollback and tenant negatives execute |
| Wave C | 063, 067–068, 071–073, 075–077 | `bun test tests/rate-authoring.test.ts tests/rate-composition.test.ts tests/rate-evaluators.test.ts tests/rate-intent.test.ts tests/operator-assets-security.test.ts`; plus the Wave-A 13-suite result for their authenticated/database portions | Pure assertions exit 0; authenticated portions are cited only from Wave A's exact commit/result, never inferred |
| Wave C | 091 | `bun test tests/rms-economics.test.ts` | 4 pass / 74 assertions, including overflow, loss, bid comparison and immutable transport evidence |
| Wave D | 045 | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\state.ps1` from a valid checkout and from a deliberately invalid Git context | valid state exits 0; labelled invalid context exits non-zero (fail closed) |
| Wave D | 046 | `fresh_db yellow_review_046`; `YELLOW_REQUIRE_REVIEW_SEED=1 YELLOW_REVIEW_SEED_URL=postgres://yellow:yellow@127.0.0.1:5442/yellow_review_046 YELLOW_REVIEW_SEED_PASSWORD=YellowReviewOnly2026! bun test tests/review-seed.integration.test.ts` | all Order-046/078 seed assertions pass with zero skips |
| Wave D | 049, 053–057 supporting UI/HTTP only | Corresponding authenticated operator file: `operator-restrictions.integration.test.ts`, `operator-operational-blocks.integration.test.ts`, `operator-oos-policy.integration.test.ts`, `operator-holds.integration.test.ts`, `hold-expiry-worker.integration.test.ts`, `operator-bulk-rooms.integration.test.ts`, each with declared fail-closed env inputs | UI/HTTP authorization assertions pass; final manifest discharge remains owned by Wave B or A as listed |
| Wave D | 084 supporting UI/HTTP only | Cite Wave B's B13 result at the exact commit, then run `bun test tests/operator-assets-security.test.ts` | live offer discharge remains Wave B-owned; asset proof exits 0 |
| Wave D | 089 | `bun test tests/operator-calendar-validation.test.ts` | 4 pass including impossible instant and rollover rejection |
| Wave D | 090 | `bun test tests/rate-intent-provider.test.ts tests/rate-intent.test.ts` | 15 pass; local default makes zero requests and hostile provider output gains no authority |

Overlap rule: the `Final discharge owner` column is exclusive. Another wave may cite an
exact commit and result as supporting evidence, but cannot mark that order approved.
Every review file must include a checklist row for each owned manifest order; omitted
rows remain UNVERIFIED. Order 074 is discharged only with Wave A because it owns F11/F12.

### Exact Wave-B database commands

Run from the repository root after `docker compose up -d postgres`. These commands use
fixed disposable database names and one explicitly non-production proof password:

```bash
fresh_db() {
  docker compose exec -T postgres psql -U yellow -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS $1 WITH (FORCE)" -c "CREATE DATABASE $1"
  DATABASE_URL="postgres://yellow:yellow@127.0.0.1:5442/$1" bun scripts/migrate.ts
}
proof_password='YellowReviewOnly2026!'

# B0 — Order 047
fresh_db yellow_review_047
YELLOW_REQUIRE_IDEMPOTENCY=1 YELLOW_IDEMPOTENCY_URL=postgres://yellow:yellow@127.0.0.1:5442/yellow_review_047 bun test tests/idempotency.integration.test.ts
# B1 — Order 049
fresh_db yellow_review_049
YELLOW_REQUIRE_OPERATOR_RESTRICTION=1 YELLOW_OPERATOR_RESTRICTION_URL=postgres://yellow:yellow@127.0.0.1:5442/yellow_review_049 YELLOW_OPERATOR_RESTRICTION_PASSWORD="$proof_password" bun test tests/operator-restrictions.integration.test.ts
# B2 — Order 053
fresh_db yellow_review_053
YELLOW_REQUIRE_OPERATOR_BLOCK=1 YELLOW_OPERATOR_BLOCK_URL=postgres://yellow:yellow@127.0.0.1:5442/yellow_review_053 YELLOW_OPERATOR_BLOCK_PASSWORD="$proof_password" bun test tests/operator-operational-blocks.integration.test.ts
# B3 — Order 054
fresh_db yellow_review_054
YELLOW_REQUIRE_OPERATOR_POLICY=1 YELLOW_OPERATOR_POLICY_URL=postgres://yellow:yellow@127.0.0.1:5442/yellow_review_054 YELLOW_OPERATOR_POLICY_PASSWORD="$proof_password" bun test tests/operator-oos-policy.integration.test.ts
# B4 — Order 055
fresh_db yellow_review_055
YELLOW_REQUIRE_OPERATOR_HOLD=1 YELLOW_OPERATOR_HOLD_URL=postgres://yellow:yellow@127.0.0.1:5442/yellow_review_055 YELLOW_OPERATOR_HOLD_PASSWORD="$proof_password" bun test tests/operator-holds.integration.test.ts
# B5 — Order 056
fresh_db yellow_review_056
YELLOW_REQUIRE_HOLD_EXPIRY=1 YELLOW_HOLD_EXPIRY_URL=postgres://yellow:yellow@127.0.0.1:5442/yellow_review_056 YELLOW_HOLD_EXPIRY_PASSWORD="$proof_password" bun test tests/hold-expiry-worker.integration.test.ts
# B6 — Order 058
fresh_db yellow_review_058
YELLOW_REQUIRE_AVAILABILITY_PROJECTION=1 YELLOW_AVAILABILITY_PROJECTION_URL=postgres://yellow:yellow@127.0.0.1:5442/yellow_review_058 bun test tests/availability-projection.integration.test.ts
# B7 — Order 059
fresh_db yellow_review_059
YELLOW_REQUIRE_AVAILABILITY_PROJECTION_CONSUMER=1 YELLOW_AVAILABILITY_PROJECTION_CONSUMER_URL=postgres://yellow:yellow@127.0.0.1:5442/yellow_review_059 bun test tests/availability-projection-consumer.integration.test.ts
# B8 — Order 060
fresh_db yellow_review_060
YELLOW_REQUIRE_OPERATOR_PROJECTION=1 YELLOW_OPERATOR_PROJECTION_URL=postgres://yellow:yellow@127.0.0.1:5442/yellow_review_060 YELLOW_OPERATOR_PROJECTION_PASSWORD="$proof_password" bun test tests/operator-projection-bootstrap.integration.test.ts
# B9 — Order 061
fresh_db yellow_review_061
YELLOW_REQUIRE_AVAILABILITY_SCALING=1 YELLOW_AVAILABILITY_SCALING_URL=postgres://yellow:yellow@127.0.0.1:5442/yellow_review_061 bun test tests/availability-scaling.integration.test.ts
# B10 — Order 062
fresh_db yellow_review_062
YELLOW_REQUIRE_OFFLINE_LEASE=1 YELLOW_OFFLINE_LEASE_URL=postgres://yellow:yellow@127.0.0.1:5442/yellow_review_062 YELLOW_OFFLINE_LEASE_PASSWORD="$proof_password" bun test tests/offline-leases.integration.test.ts
# B11 — Order 081
fresh_db yellow_review_081
YELLOW_REQUIRE_RESERVATION_COMMIT=1 YELLOW_RESERVATION_COMMIT_URL=postgres://yellow:yellow@127.0.0.1:5442/yellow_review_081 bun test tests/reservation-commit.integration.test.ts
# B12 — Order 082
fresh_db yellow_review_082
YELLOW_REQUIRE_RESERVATION_COMMIT_HTTP=1 YELLOW_RESERVATION_COMMIT_HTTP_URL=postgres://yellow:yellow@127.0.0.1:5442/yellow_review_082 bun test tests/reservation-commit-http.integration.test.ts
# B13 — Order 084
fresh_db yellow_review_084
DATABASE_URL=postgres://yellow:yellow@127.0.0.1:5442/yellow_review_084 bun run db:seed
YELLOW_REQUIRE_RESERVATION_OFFERS=1 YELLOW_RESERVATION_OFFERS_URL=postgres://yellow:yellow@127.0.0.1:5442/yellow_review_084 YELLOW_RESERVATION_OFFERS_PASSWORD="$proof_password" YELLOW_RESERVATION_OFFERS_APPROVER_PASSWORD="${proof_password}Approver" bun test tests/reservation-offers.integration.test.ts
# B14 — Order 085
fresh_db yellow_review_085
YELLOW_REQUIRE_RESERVATION_LIFECYCLE=1 YELLOW_RESERVATION_LIFECYCLE_URL=postgres://yellow:yellow@127.0.0.1:5442/yellow_review_085 bun test tests/reservation-lifecycle.integration.test.ts
# B15 — Order 086
fresh_db yellow_review_086
YELLOW_REQUIRE_RESERVATION_SEGMENTS=1 YELLOW_RESERVATION_SEGMENTS_URL=postgres://yellow:yellow@127.0.0.1:5442/yellow_review_086 bun test tests/reservation-segment-changes.integration.test.ts
```

## Exact-tip builder baseline recorded before review

- frozen install: no lock changes;
- typecheck: pass;
- import boundaries: 58 TypeScript files;
- default suite: 117 pass, 0 fail, 326 database skips, 1,528 assertions;
- licence: 23 packages accepted; audit: no vulnerabilities;
- schema: exact match;
- fresh database: 84 public tables and `11 passed, 0 failed of 11`.

This evidence establishes a reviewable starting point only. It does not discharge any
row in the Gate-3 manifest.
