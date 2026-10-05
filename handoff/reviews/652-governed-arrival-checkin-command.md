# Review 652 — governed arrival check-in command

Reviewer: Codex independent review agent (`/root/order652_checkin_review`)
Date: 2026-09-23
Order: `handoff/orders/652-governed-arrival-checkin-command.md`
Scope reviewed:

- `src/demo/demo-arrival-fixture.ts`
- `scripts/provision-demo-arrival.ts`
- `src/demo/governed-checkin-command.ts`
- `src/app.ts` route `POST /api/v1/demo/governed/check-in`
- demo action-safety/proof/readiness/share updates and focused tests

## Verdict

Accepted for Order 652 behavior.

I found no Order 652 blocking findings. The command is confirmation gated before database connection, limited to the fixed public-demo fixture (`L3R-HX-0126`, room `303`), records occupancy through `record_occupancy()`, updates only the fixed reservation/segment state, and inserts exactly one `reservation.checked_in` outbox row for the reviewed transition execution.

## Code inspection notes

- Unsupported and unconfirmed calls return before `Database.connect(...)`.
- The successful path runs inside `Database.withTenantTransaction(DEMO_TENANT_ID, ...)`, which sets transaction-local `app.tenant_id` and `SET LOCAL ROLE app_role`.
- `space_occupancy` is not directly inserted/updated/deleted by implementation code; the command calls `record_occupancy(..., 'segment', true)`.
- The command updates only the fixed reservation and fixed segment, guarded by tenant/id/status predicates.
- The outbox insert is in the same transaction as occupancy and state changes.
- The route validates malformed JSON/body shape and passes only string fields into the command.

## Reviewer-executed proof

Environment:

- Local Docker Compose PostgreSQL 18.6 service was healthy on `localhost:5442`.
- `DATABASE_URL=postgres://yellow:yellow@localhost:5442/yellow_dev` for demo fixture proof.

Commands and results:

1. Project ritual:
   - `Get-Content -Raw PROJECT.md` read.
   - `./state.sh` returned exit 0 with no visible output in this Windows shell.

2. Focused tests:
   - `bun test tests/demo-governed-checkin-command.test.ts tests/demo-action-safety-matrix.test.ts tests/colleague-demo-proof-bundle.test.ts tests/colleague-demo-readiness.test.ts tests/demo-share-packet.test.ts`
   - Result: 18 pass, 0 fail.
   - `bun test tests/demo-governed-housekeeping-command.test.ts tests/demo-governed-checkin-command.test.ts`
   - Result: 10 pass, 0 fail.

3. Static/security gates:
   - `bun run typecheck`: passed.
   - `bun run boundaries`: passed, `Import boundaries OK: 18 TypeScript files scanned`.
   - `bun audit`: passed, no vulnerabilities found.
   - `bun run license-check`: failed on existing dependency policy issue, `tslib@2.8.1: rejected license 0BSD`.
   - `bun run schema:check`: not executed successfully because `YELLOW_SCHEMA_DATABASE is required`.

4. Provision fixture explicitly:
   - `$env:DATABASE_URL='postgres://yellow:yellow@localhost:5442/yellow_dev'; bun scripts/provision-demo-arrival.ts`
   - Returned the fixed tenant/property/confirmation/room fixture. The fixture was already `in_house` from prior local execution, so I reset only the fixed demo fixture for the transition proof.

5. Prepare transition start state:
   - Executed `release_occupancy('6d9b7ce2-2d14-5576-b8c3-80f06501a603', '00000000-0000-4000-8000-000000006526')`, then set the fixed reservation to `due_in` and fixed segment to `booked`.
   - Verified start state:
     - reservation status: `due_in`
     - segment status: `booked`
     - occupancy rows for fixed segment: `0`

6. Negative no-DB-open proof:
   - Unconfirmed call with unusable DB URL `127.0.0.1:1` returned:
     - `confirmed=false`
     - `executed=false`
     - `realPmsExecuted=false`
     - `proof=null`
   - Confirmed unsupported reservation with unusable DB URL returned:
     - `confirmed=true`
     - `executed=false`
     - `realPmsExecuted=false`
     - `proof=null`
   - Because both used an unreachable URL and returned successfully, these paths did not open the database.

7. Baseline counts before supported command:
   - `folio=1`
   - `journal=0`
   - `posting_line=0`
   - `payment=0`
   - `payment_instrument=0`
   - `document=0`
   - `statutory_submission=0`
   - `stats_daily=0`
   - `outbox reservation.checked_in for fixture=1` (pre-existing local row)
   - `occupancy rows for fixed segment=0`

8. Supported route-level execution:
   - POST `/api/v1/demo/governed/check-in` through `app.handle(...)` with exact phrase `CONFIRM YELLOW OPERATION`, confirmation `L3R-HX-0126`, room `303`.
   - HTTP status: `200`.
   - Result:
     - `executed=true`
     - `realPmsExecuted=true`
     - `beforeReservationStatus=due_in`
     - `afterReservationStatus=in_house`
     - `beforeSegmentStatus=booked`
     - `afterSegmentStatus=in_house`
     - `occupancyRecorded=true`
     - `occupancyRowsForSegment=1`
     - `outboxEventType=reservation.checked_in`
     - `outboxSeq=8`

9. Post-command database proof:
   - reservation status: `in_house`
   - segment status: `in_house`
   - occupancy row:
     - `slot_kind=segment`
     - `exclusive=true`
     - `slot_ref=00000000-0000-4000-8000-000000006526`
     - period `2026-09-23 08:30:00+00` to `2026-09-24 05:30:00+00`
   - Count deltas:
     - `occupancy_segment`: `0 -> 1`
     - `outbox reservation.checked_in for fixture`: `1 -> 2`, exactly one new event for the reviewed execution
     - `folio`: `1 -> 1`
     - `journal`: `0 -> 0`
     - `posting_line`: `0 -> 0`
     - `payment`: `0 -> 0`
     - `payment_instrument`: `0 -> 0`
     - `document`: `0 -> 0`
     - `statutory_submission`: `0 -> 0`
     - `stats_daily`: `0 -> 0`

10. PG18 referee:
    - Direct initial run against existing `yellow_test` failed because the fixture was stale.
    - Rebuilt `yellow_test` manually with the project DB-only steps available on Windows:
      - dropped and recreated `yellow_test`
      - `DATABASE_URL=postgres://yellow:yellow@127.0.0.1:5442/yellow_test bun scripts/migrate.ts`
      - loaded `tests/seed_fixture.sql`
      - verified public table count: `81`
    - Reran `python tests/run_invariants.py yellow_test`
    - Result: `11 passed, 0 failed of 11`.

11. Full `bun test`:
    - Result: 133 pass, 52 skip, 7 fail.
    - Failures observed outside Order 652:
      - context layout/import-boundary expectations around non-empty `src/contexts/groups/index.ts`
      - Order 406 persisted India component-tax semantic route tests
    - These failures are not introduced by the reviewed Order 652 files, but they keep the overall repository suite red.

## Residual risk

The local fixture had prior `reservation.checked_in` history before this review, so the outbox proof is expressed as an execution delta (`+1`) rather than total fixture history (`1`). The reviewed command produced exactly one new outbox event for the supported transition.
