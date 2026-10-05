# Review 660 - Governed room move command

## Verdict

PASS.

Independent reviewer: OpenAI Codex child agent `/root/order660_room_move_review`.

Scope reviewed:

- `handoff/orders/660-governed-room-move-command.md`
- `src/demo/demo-arrival-fixture.ts`
- `src/demo/governed-room-move-command.ts`
- `src/app.ts`
- `src/demo/action-safety-matrix.ts`
- `src/demo/mobile-shell.ts`
- `src/demo/proof-bundle.ts`
- `src/demo/property-config.ts`
- `src/demo/colleague-readiness.ts`
- `src/demo/share-packet.ts`
- `tests/demo-governed-room-move-command.test.ts`
- `tests/demo-action-safety-matrix.test.ts`
- `tests/colleague-demo-proof-bundle.test.ts`
- `tests/colleague-demo-readiness.test.ts`
- `tests/demo-share-packet.test.ts`

## Findings

No blocking findings.

The implementation keeps the room move bounded to the deterministic demo fixture, uses `release_occupancy()` and `record_occupancy()` rather than direct `space_occupancy` DML, inserts one new same-unit-type segment, emits `reservation.room_moved` in the same transaction, and leaves folio/financial/payment/document/fiscal/statutory tables unchanged during the move and replay proof.

## Commands and Results

Session grounding:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\state.ps1
```

Result: succeeded. Reported branch `phase-0/founder-context-demo-readiness`, head `9dcb1079 [codex] Add governed rooming-list import proof`, 349 uncommitted files, services app/postgres/valkey up, `yellow_test` tables = 81. `./state.sh` could not run in this Windows environment because `/bin/bash` is unavailable, so `state.ps1` was used.

Focused tests:

```powershell
bun test tests/demo-governed-room-move-command.test.ts tests/demo-action-safety-matrix.test.ts tests/colleague-demo-proof-bundle.test.ts tests/colleague-demo-readiness.test.ts tests/demo-share-packet.test.ts
```

Result: 18 pass, 0 fail, 224 assertions.

Typecheck:

```powershell
bun run typecheck
```

Result: pass (`tsc --noEmit`).

Import boundaries:

```powershell
bun run boundaries
```

Result: pass (`Import boundaries OK: 18 TypeScript files scanned`).

Repository DB gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -DbOnly
```

Result: pass. PostgreSQL 18 on port 5442, `yellow_test` recreated, migration applied, 81 public tables, invariant referee `11 passed, 0 failed of 11`. This command was run twice: once before the first proof attempt and again after a proof-inspection query typo, so the final proof below started from a fresh passing `yellow_test`.

Static occupancy sweep:

```powershell
rg -n "space_occupancy|record_occupancy|release_occupancy|INSERT INTO outbox|reservation.room_moved|UPDATE reservation_segment|INSERT INTO reservation_segment" src\demo\governed-room-move-command.ts src\demo\demo-arrival-fixture.ts tests\demo-governed-room-move-command.test.ts
```

Result: no direct `INSERT`, `UPDATE`, or `DELETE` on `space_occupancy` in the room-move command. The command uses `release_occupancy` at `src\demo\governed-room-move-command.ts:159` and `record_occupancy` at `src\demo\governed-room-move-command.ts:181`.

## Clean PostgreSQL 18 Proof

Database URL:

```text
postgres://yellow:yellow@127.0.0.1:5442/yellow_test
```

Proof sequence:

1. Provisioned the deterministic demo arrival fixture.
2. Executed governed check-in with exact confirmation.
3. Snapshotted scoped table counts.
4. Executed governed room move from room 303 to room 305 with exact confirmation.
5. Snapshotted scoped table counts.
6. Replayed the governed room move.
7. Snapshotted scoped table counts again.

Key proof output:

```json
{
  "checkIn": {
    "executed": true,
    "reservationStatus": "in_house",
    "segmentStatus": "in_house",
    "occupancyRowsForSegment": 1,
    "outboxEventType": "reservation.checked_in"
  },
  "move": {
    "executed": true,
    "replayed": false,
    "oldSegmentStatusAfter": "departed",
    "newSegmentStatusAfter": "in_house",
    "oldOccupancyAfter": 0,
    "newOccupancyAfter": 1,
    "outboxEventType": "reservation.room_moved",
    "outboxSeq": "2"
  },
  "replay": {
    "executed": false,
    "replayed": true,
    "oldSegmentStatusAfter": "departed",
    "newSegmentStatusAfter": "in_house",
    "oldOccupancyAfter": 0,
    "newOccupancyAfter": 1,
    "outboxSeq": "2"
  },
  "moveDelta": {
    "reservation_segment": "1",
    "space_occupancy": "0",
    "outbox": "1",
    "folio": "0",
    "journal": "0",
    "posting_line": "0",
    "payment": "0",
    "document": "0",
    "statutory_submission": "0",
    "fiscal_submission": "0"
  },
  "replayDelta": {
    "reservation_segment": "0",
    "space_occupancy": "0",
    "outbox": "0",
    "folio": "0",
    "journal": "0",
    "posting_line": "0",
    "payment": "0",
    "document": "0",
    "statutory_submission": "0",
    "fiscal_submission": "0"
  }
}
```

Detailed state after first room move:

- Old segment `00000000-0000-4000-8000-000000006526`, room 303 sellable unit, status `departed`, period ends at `2026-09-23 12:30:00+00`.
- New segment `00000000-0000-4000-8000-00000000652b`, room 305 sellable unit, status `in_house`, period starts at `2026-09-23 12:30:00+00`.
- Occupancy rows for old segment: 0.
- Occupancy rows for new segment: 1.
- Matching `reservation.room_moved` outbox events: exactly 1, seq `2`.
- Replay preserved the same segment, occupancy, outbox, folio, journal, posting_line, payment, document, statutory_submission and fiscal_submission counts.

## Notes

Replay returns `executed=false` and `replayed=true`, while rereading the existing move outbox sequence. Its proof payload reports `outboxEventType=null` on replay, which is consistent with "no new event written"; the database proof verifies exactly one persisted `reservation.room_moved` event remains.
