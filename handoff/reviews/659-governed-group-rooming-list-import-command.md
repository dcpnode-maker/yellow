# Review 659 — Governed group rooming-list import command

Reviewer: Codex independent review agent  
Date: 2026-09-23  
Order: `handoff/orders/659-governed-group-rooming-list-import-command.md`  
Result: PASS

## Scope inspected

- `handoff/orders/659-governed-group-rooming-list-import-command.md`
- `src/demo/governed-group-rooming-list-command.ts`
- `src/demo/demo-group-block-fixture.ts`
- `src/app.ts`
- `src/demo/action-safety-matrix.ts`
- `src/demo/mobile-shell.ts`
- `src/demo/proof-bundle.ts`
- `src/demo/property-config.ts`
- `src/demo/colleague-readiness.ts`
- `src/demo/share-packet.ts`
- `tests/demo-governed-group-rooming-list-command.test.ts`
- `tests/demo-action-safety-matrix.test.ts`
- `tests/colleague-demo-proof-bundle.test.ts`
- `tests/colleague-demo-readiness.test.ts`
- `tests/demo-share-packet.test.ts`

I also inspected the adjacent governed group status/pickup/wash command files only to drive the required clean database proof sequence. I did not commit.

## Findings

No blocking findings.

The command is confirmation-gated before database use, limited to fixed block `MEHRA-WED` and fixed pickup reservation `GRP-MEHRA-001`, runs inside `Database.withTenantTransaction()`, inserts only the two deterministic `reservation_guest` links, and writes one `group.rooming_list_imported` outbox event. Replay detection uses the existing matching rooming-list outbox event and returned non-mutating on the executable proof.

## Commands and results

`./state.sh`

- Native execution under PowerShell produced no output.

`bash ./state.sh`

- Failed because this environment has no `/bin/bash` / WSL runtime:
  `execvpe(/bin/bash) failed: No such file or directory`.
- I used native repository and git checks plus `.\setup.ps1 -DbOnly` for the executable repository gate.

`git status --short --branch`

- Current branch: `phase-0/founder-context-demo-readiness...origin/phase-0/founder-context-demo-readiness [ahead 45]`.
- Existing dirty/untracked workspace noted; review did not revert or commit anything.

`rg -n -i "rooming|group|reservation_guest|outbox|occupancy|folio|journal|posting|payment|document" DECISIONS.log`

- Confirmed relevant decisions around occupancy, outbox, insert-only financials, payments, and PostgreSQL 18 target.

`bun test tests/demo-governed-group-rooming-list-command.test.ts tests/demo-action-safety-matrix.test.ts tests/colleague-demo-proof-bundle.test.ts tests/colleague-demo-readiness.test.ts tests/demo-share-packet.test.ts`

- PASS: 18 pass, 0 fail, 219 assertions.

`bun run typecheck`

- PASS: `tsc --noEmit`.

`bun run boundaries`

- PASS: `Import boundaries OK: 18 TypeScript files scanned`.

`.\setup.ps1 -DbOnly`

- PASS.
- PostgreSQL/Valkey containers running on configured ports.
- `yellow_test tables: 81 (80 baseline + schema_migration)`.
- Invariant referee: `RESULT: 11 passed, 0 failed of 11`.

## Clean PostgreSQL 18 proof

Created a fresh review database:

`docker compose exec -T postgres psql -U yellow -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS yellow_review_659 WITH (FORCE)" -c "CREATE DATABASE yellow_review_659"`

- PASS: database recreated.

Migrated it:

`$env:DATABASE_URL='postgres://yellow:yellow@127.0.0.1:5442/yellow_review_659'; bun scripts/migrate.ts`

- PASS: `migration applied: 0001_init.sql`; `applied=1 status=applied`.

Executed reviewer proof with Bun against `yellow_review_659`:

- `executeGovernedGroupBlockStatus({ confirmationPhrase, databaseUrl })`
- `executeGovernedGroupPickup({ confirmationPhrase, databaseUrl })`
- snapshot counts
- first `executeGovernedGroupRoomingListImport({ confirmationPhrase, databaseUrl })`
- snapshot counts
- replay `executeGovernedGroupRoomingListImport({ confirmationPhrase, databaseUrl })`
- snapshot counts

Assertions all passed:

- PostgreSQL major version is 18 or newer.
- Status command executed: `tentative` -> `definite`.
- Pickup command executed for `GRP-MEHRA-001`.
- Before import: 0 `reservation_guest` links for `GRP-MEHRA-001`.
- First import executed with `guestLinksBefore=0` and `guestLinksAfter=2`.
- After first import: exactly 2 rooming-list guest links.
- After first import: exactly 1 `group.rooming_list_imported` outbox event.
- Replay returned `executed=false`, `replayed=true`.
- After replay: exactly 2 rooming-list guest links.
- After replay: exactly 1 `group.rooming_list_imported` outbox event.
- Side-table counts unchanged by first import and replay:
  - `space_occupancy=0`
  - `folio=0`
  - `journal=0`
  - `posting_line=0`
  - `payment=0`
  - `document=0`
  - `statutory_submission=0`
  - `fiscal_submission=0`

Representative proof output:

```json
{
  "database": "yellow_review_659",
  "blockCode": "MEHRA-WED",
  "firstImport": {
    "confirmed": true,
    "executed": true,
    "realPmsExecuted": true,
    "proof": {
      "confirmationNo": "GRP-MEHRA-001",
      "guestLinksBefore": 0,
      "guestLinksAfter": 2,
      "outboxEventType": "group.rooming_list_imported",
      "outboxSeq": "3",
      "replayed": false
    }
  },
  "replayImport": {
    "confirmed": true,
    "executed": false,
    "realPmsExecuted": false,
    "proof": {
      "confirmationNo": "GRP-MEHRA-001",
      "guestLinksBefore": 2,
      "guestLinksAfter": 2,
      "outboxEventType": null,
      "outboxSeq": "3",
      "replayed": true
    }
  },
  "beforeImport": {
    "roomingGuestLinks": 0,
    "roomingOutboxEvents": 0
  },
  "afterFirstImport": {
    "roomingGuestLinks": 2,
    "roomingOutboxEvents": 1
  },
  "afterReplay": {
    "roomingGuestLinks": 2,
    "roomingOutboxEvents": 1
  },
  "result": "PASS",
  "failed": []
}
```

## Verdict

PASS. Order 659 satisfies the scoped review proof: focused tests, typecheck, boundaries, canonical DB gate, and independent clean PostgreSQL 18 replay proof all pass. No occupancy, folio, journal, posting line, payment, document, statutory submission, or fiscal submission rows were written by the import or replay.
