# Review 658 - Governed group wash/release command

Reviewer: Codex independent review agent (did not implement Order 658)
Date: 2026-09-23
Verdict: PASS

## Scope reviewed

- `handoff/orders/658-governed-group-wash-command.md`
- `src/demo/governed-group-wash-command.ts`
- `src/app.ts` route addition for `POST /api/v1/demo/governed/group-block/wash`
- Demo proof/readiness/share/action-safety/mobile test updates in the Order 658 scope

Unrelated dirty-tree changes under `tools/build-continuity/`, existing governance files, and unrelated untracked orders/reviews were not reviewed for this order.

## Constitution and skill checks

- Read `PROJECT.md`.
- Ran `./state.sh`; in this Windows PowerShell session it exited 0 with no visible output.
- Read `BUILD-PLAN.md` current phase context. Order 658 maps to Phase 11 group block wash/release behavior.
- Searched `DECISIONS.log` for group/wash/allotment/pickup topics. No Order 658-specific decision entry was present.
- Applied Yellow PostgreSQL patterns: tenant transaction must use tx-local `set_config`, outbox event must be in the same transaction, replay must be non-mutating.
- Applied Yellow compliance rules: verified no finance, payment, document, fiscal, statutory, or trust-account side effects.

## Source inspection

Findings: none.

Inspection notes:

- `executeGovernedGroupWash` refuses unconfirmed and unsupported-shape requests before connecting to PostgreSQL.
- Supported execution uses `Database.withTenantTransaction(DEMO_TENANT_ID, ...)`, which performs `SELECT set_config('app.tenant_id', ..., true)` and `SET LOCAL ROLE app_role`.
- The wash transaction provisions/reads the fixed fixture, requires `reservation_group.status = 'definite'`, counts picked-up reservations from `reservation` + `reservation_segment`, reads `reservation_group.wash_schedule`, updates only `block_allotment.blocked`, then writes one `group.wash_applied` outbox row in the same transaction.
- Replay is keyed by an existing `group.wash_applied` outbox event for the same group and returns without a second allotment update or event insert.
- Static scan of `src/demo/governed-group-wash-command.ts` and `src/app.ts` found no calls to `record_occupancy()` / `release_occupancy()` and no writes to `space_occupancy`, `folio`, `journal`, `posting_line`, `payment`, `document`, fiscal, or statutory tables.
- `git diff -- migrations src/contexts tests/schema/expected.sql` returned no diff. No schema migration was introduced.

## Commands personally run

### Focused tests

Command:

```powershell
bun test tests/demo-governed-group-wash-command.test.ts tests/demo-action-safety-matrix.test.ts tests/colleague-demo-proof-bundle.test.ts tests/colleague-demo-readiness.test.ts tests/demo-share-packet.test.ts
```

Result:

```text
18 pass
0 fail
216 expect() calls
Ran 18 tests across 5 files.
```

### Typecheck

Command:

```powershell
bun run typecheck
```

Result:

```text
$ tsc --noEmit
```

Exit code: 0.

### Import boundaries

Command:

```powershell
bun run boundaries
```

Result:

```text
$ bun scripts/check-import-boundaries.ts
Import boundaries OK: 18 TypeScript files scanned
```

Exit code: 0.

### Repository database gate

Command:

```powershell
.\setup.ps1 -DbOnly
```

Result:

```text
yellow_test tables: 81 (80 baseline + schema_migration)
PASS  TC-12.1  50-thread exclusive race -> exactly 1 winner
PASS  TC-12.2  private vs beds never coexist
PASS  TC-12.3  40 threads for 6 beds -> exactly 6
PASS  TC-12.4  direct INSERT blocked (42501)
PASS  TC-12.5  concurrent commit throughput
PASS  TC-5.6   unbalanced journal rejected at COMMIT
PASS  TC-7.1   balanced journal commits
PASS  TC-5.4   posting to sealed day blocked
PASS  TC-8.2   100 concurrent invoice numbers gapless
PASS  TC-13.1  table RLS: A sees 16, B sees 0
PASS  TC-13.4  view RLS: each tenant sees only itself

RESULT: 11 passed, 0 failed of 11
```

## Clean PostgreSQL 18 proof

Created an isolated proof database:

```powershell
docker compose exec -T postgres psql -U yellow -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS yellow_order658_review WITH (FORCE)" -c "CREATE DATABASE yellow_order658_review"
$env:DATABASE_URL='postgres://yellow:yellow@127.0.0.1:5442/yellow_order658_review'; bun scripts/migrate.ts
```

Result:

```text
DROP DATABASE
CREATE DATABASE
migration applied: 0001_init.sql
migration summary: applied=1 status=applied
```

Then executed, against `yellow_order658_review` only:

1. `executeGovernedGroupBlockStatus({ confirmationPhrase: "CONFIRM YELLOW OPERATION" })`
2. `executeGovernedGroupPickup({ confirmationPhrase: "CONFIRM YELLOW OPERATION" })`
3. `executeGovernedGroupWash({ confirmationPhrase: "CONFIRM YELLOW OPERATION" })`
4. `executeGovernedGroupWash({ confirmationPhrase: "CONFIRM YELLOW OPERATION" })` replay

Observed proof:

```json
{
  "afterStatus": {
    "blocked": 10,
    "picked_up": 0,
    "wash_events": 0
  },
  "afterPickup": {
    "blocked": 10,
    "picked_up": 1,
    "wash_events": 0
  },
  "wash": {
    "blockedBefore": 10,
    "pickedUp": 1,
    "remainingBeforeWash": 9,
    "releasePct": 50,
    "releasedRooms": 4,
    "blockedAfter": 6,
    "outboxEventType": "group.wash_applied",
    "outboxSeq": "3",
    "replayed": false,
    "blockedReason": null
  },
  "afterWash": {
    "blocked": 6,
    "picked_up": 1,
    "wash_events": 1
  },
  "replay": {
    "blockedBefore": 6,
    "pickedUp": 1,
    "releasedRooms": 0,
    "blockedAfter": 6,
    "outboxEventType": null,
    "outboxSeq": "3",
    "replayed": true,
    "blockedReason": null
  },
  "afterReplay": {
    "blocked": 6,
    "picked_up": 1,
    "wash_events": 1
  },
  "events": [
    { "event_type": "group.pickup_created", "count": 1, "first_seq": "2", "last_seq": "2" },
    { "event_type": "group.status_changed", "count": 1, "first_seq": "1", "last_seq": "1" },
    { "event_type": "group.wash_applied", "count": 1, "first_seq": "3", "last_seq": "3" }
  ]
}
```

Protected-table count query after replay:

```powershell
docker compose exec -T postgres psql -U yellow -d yellow_order658_review -v ON_ERROR_STOP=1 -c "SELECT (SELECT count(*) FROM statutory_submission) AS statutory_submission, (SELECT count(*) FROM fiscal_submission) AS fiscal_submission, (SELECT count(*) FROM space_occupancy) AS space_occupancy, (SELECT count(*) FROM folio) AS folio, (SELECT count(*) FROM journal) AS journal, (SELECT count(*) FROM posting_line) AS posting_line, (SELECT count(*) FROM payment) AS payment, (SELECT count(*) FROM document) AS document, (SELECT count(*) FROM outbox WHERE event_type='group.wash_applied') AS wash_events;"
```

Result:

```text
statutory_submission=0
fiscal_submission=0
space_occupancy=0
folio=0
journal=0
posting_line=0
payment=0
document=0
wash_events=1
```

## Final assessment

PASS. Order 658 satisfies the pre-registered proof: first wash after status conversion and pickup reduces DLX `block_allotment.blocked` from 10 to 6, preserves `picked_up = 1`, writes exactly one `group.wash_applied` outbox event in the same tenant-scoped transaction, and replay is non-mutating. No schema migration, occupancy write, reservation/segment creation by wash, finance/payment/document/fiscal/statutory write, or protected-table side effect was found.
