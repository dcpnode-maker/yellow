# Review 657 — Governed group pickup command

Reviewer: Codex independent review agent `/root/order657_group_pickup_review`
Date: 2026-09-23
Order: `handoff/orders/657-governed-group-pickup-command.md`
Result: PASS

## Scope inspected

- `handoff/orders/657-governed-group-pickup-command.md`
- `src/demo/demo-group-block-fixture.ts`
- `src/demo/governed-group-pickup-command.ts`
- `src/app.ts`
- Demo proof/readiness/share/mobile/action-safety updates and focused tests.

No implementation files were edited by this review. This file is the only review edit.

## Grounding

- Read `PROJECT.md`.
- Ran `.\state.ps1`.
- Read Yellow skills:
  - `yellow-compliance-rules`
  - `yellow-entity-patterns`
  - `yellow-postgres-patterns`
- Checked `DECISIONS.log` for group/block/pickup context.

Relevant invariants applied: tenant transaction with transaction-local tenant context, no direct occupancy writes, no financial/fiscal/statutory/payment/document writes, and transactional outbox for the state change other modules observe.

## Static inspection findings

- No schema migration was added or modified: `git diff -- migrations` was empty.
- `executeGovernedGroupPickup` uses `Database.withTenantTransaction`, which executes `SELECT set_config('app.tenant_id', $1, true)` and `SET LOCAL ROLE app_role` inside the transaction.
- The pickup command writes only:
  - one `reservation`;
  - one `reservation_segment`;
  - one `outbox` row with `event_type = 'group.pickup_created'`.
- The pickup command does not reference or write `space_occupancy`, `folio`, `journal`, `posting_line`, `payment`, `document`, statutory, fiscal, or external-provider rails.
- Replay detection rereads the authoritative reservation by the fixed public-demo confirmation number `GRP-MEHRA-001`. The baseline schema has `UNIQUE (tenant_id, confirmation_no)`, so a duplicate confirmation cannot silently create a second reservation.
- Fixture upserts are deterministic and migration-free. The existing `block_status_def` `ON CONFLICT DO UPDATE` is guarded by `IS DISTINCT FROM`; pickup replay did not add rows in the proof below.

## Commands personally executed

### Focused tests

Command:

```powershell
bun test tests/demo-governed-group-pickup-command.test.ts tests/colleague-demo-proof-bundle.test.ts tests/colleague-demo-readiness.test.ts tests/demo-action-safety-matrix.test.ts tests/demo-share-packet.test.ts
```

Result:

```text
18 pass
0 fail
213 expect() calls
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
Import boundaries OK: 18 TypeScript files scanned
```

### Standing DB referee

Command:

```powershell
.\setup.ps1 -DbOnly
```

Result:

```text
yellow_test tables: 81 (80 baseline + schema_migration)
RESULT: 11 passed, 0 failed of 11
```

### Clean PostgreSQL 18 Order 657 proof

Commands:

```powershell
docker compose exec -T postgres psql -U yellow -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS yellow_order657_review WITH (FORCE)" -c "CREATE DATABASE yellow_order657_review"
$env:DATABASE_URL='postgres://yellow:yellow@127.0.0.1:5442/yellow_order657_review'; bun scripts/migrate.ts
```

Result:

```text
CREATE DATABASE
migration applied: 0001_init.sql
migration summary: applied=1 status=applied
```

Then personally ran, against `postgres://yellow:yellow@127.0.0.1:5442/yellow_order657_review`:

1. `executeGovernedGroupBlockStatus` for `MEHRA-WED` to `definite`.
2. `executeGovernedGroupPickup` for `MEHRA-WED`, `2026-10-03`, `DLX`, quantity `1`.
3. The same pickup command again as replay.
4. A read-only census of reservation, segment, outbox, and forbidden tables.

Key result:

```json
{
  "status": {
    "executed": true,
    "proof": {
      "beforeStatus": "tentative",
      "afterStatus": "definite",
      "outboxEventType": "group.status_changed",
      "outboxSeq": "1",
      "replayed": false
    }
  },
  "first": {
    "executed": true,
    "proof": {
      "confirmationNo": "GRP-MEHRA-001",
      "pickedUpBefore": 0,
      "pickedUpAfter": 1,
      "outboxEventType": "group.pickup_created",
      "outboxSeq": "2",
      "replayed": false
    }
  },
  "replay": {
    "executed": false,
    "realPmsExecuted": false,
    "proof": {
      "confirmationNo": "GRP-MEHRA-001",
      "pickedUpBefore": 1,
      "pickedUpAfter": 1,
      "outboxEventType": null,
      "outboxSeq": "2",
      "replayed": true
    }
  },
  "counts": {
    "reservations": 1,
    "segments": 1,
    "pickup_events": 1,
    "status_events": 1,
    "space_occupancy": 0,
    "folio": 0,
    "journal": 0,
    "posting_line": 0,
    "payment": 0,
    "document": 0,
    "block_allotments": 1,
    "dlx_unit_types": 1,
    "pickup_rate_plans": 1
  }
}
```

Additional PostgreSQL census:

```text
event_type            aggregate_type      count
group.pickup_created  reservation_group   1
group.status_changed  reservation_group   1

confirmation_no  status    linked_to_group  count
GRP-MEHRA-001    reserved  true             1

segments  segment_start           segment_end
1         2026-10-03 09:00:00+00  2026-10-04 09:00:00+00
```

Cleanup:

```powershell
docker compose exec -T postgres psql -U yellow -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS yellow_order657_review WITH (FORCE)"
```

Result:

```text
DROP DATABASE
```

## Verdict

PASS. Order 657 stays within scope, is migration-free, uses a tenant-scoped transaction, writes the required reservation/segment/outbox rows atomically, makes replay non-mutating, and leaves forbidden occupancy, folio, journal, posting, payment, and document tables at zero in the clean PostgreSQL 18 proof.
