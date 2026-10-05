# Review 656 - governed group block status command

Reviewer: Codex independent review agent
Date: 2026-09-23
Order: `handoff/orders/656-governed-group-block-status-command.md`
Verdict: PASS

## Scope reviewed

- `handoff/orders/656-governed-group-block-status-command.md`
- `src/demo/demo-group-block-fixture.ts`
- `src/demo/governed-group-block-status-command.ts`
- `src/app.ts`
- Order 656 updates to demo readiness, proof bundle, share packet, mobile shell, action-safety matrix and focused tests.

I did not implement this change. This is a fresh independent rerun after the replay mutation blocker was fixed. I edited only this review file.

## Commands and results

### Grounding

- `.\state.ps1`
  - PASS. Reported branch `phase-0/founder-context-demo-readiness`, head `98d2af2a`, app/postgres/valkey up, `yellow_test tables: 81`, and referee status `11 passed, 0 failed of 11`.
- Read `PROJECT.md`, Order 656, the scoped implementation files, focused tests, and current fixture diff.

### Focused/static gates

- `bun test tests/demo-governed-group-block-status-command.test.ts tests/demo-action-safety-matrix.test.ts tests/colleague-demo-proof-bundle.test.ts tests/colleague-demo-readiness.test.ts tests/demo-share-packet.test.ts`
  - PASS: 18 pass, 0 fail, 226 assertions.
- `bun run typecheck`
  - PASS: `tsc --noEmit`.
- `bun run boundaries`
  - PASS: `Import boundaries OK: 18 TypeScript files scanned`.

### Clean PostgreSQL 18 referee

- `.\setup.ps1 -DbOnly`
  - PASS.
  - Recreated `yellow_test`.
  - Migrated `0001_init.sql`.
  - Loaded the invariant fixture.
  - `yellow_test tables: 81`.
  - Referee result: `11 passed, 0 failed of 11`.

### Clean `yellow_test` Order 656 proof

Against freshly recreated `yellow_test`, with:

- `DATABASE_URL=postgres://yellow:yellow@127.0.0.1:5442/yellow_test`
- confirmation phrase `CONFIRM YELLOW OPERATION`
- block code `MEHRA-WED`
- target status `definite`

First run:

- `beforeStatus`: `tentative`
- `afterStatus`: `definite`
- `beforeDeductsHouseInventory`: `false`
- `afterDeductsHouseInventory`: `true`
- `outboxEventType`: `group.status_changed`
- `outboxSeq`: `1`
- `executed`: `true`
- `replayed`: `false`

Replay:

- `beforeStatus`: `definite`
- `afterStatus`: `definite`
- `beforeDeductsHouseInventory`: `true`
- `afterDeductsHouseInventory`: `true`
- `outboxEventType`: `null`
- `outboxSeq`: `1`
- `executed`: `false`
- `replayed`: `true`

Outbox proof:

- before: 0 `group.status_changed` events for `MEHRA-WED`
- after first run: 1 event
- after replay: still 1 event
- payload records `beforeStatus=tentative`, `afterStatus=definite`, `beforeDeducts=false`, `afterDeducts=true`

Forbidden table count proof stayed unchanged across first run and replay:

| Table | Before | After first | After replay |
|---|---:|---:|---:|
| `reservation` | 0 | 0 | 0 |
| `reservation_segment` | 0 | 0 | 0 |
| `folio` | 0 | 0 | 0 |
| `journal` | 1 | 1 | 1 |
| `posting_line` | 2 | 2 | 2 |
| `payment` | 0 | 0 | 0 |
| `document` | 100 | 100 | 100 |
| `space_occupancy` | 169 | 169 | 169 |

Scoped demo fixture counts:

| Row family | Before | After first | After replay |
|---|---:|---:|---:|
| demo tenant | 0 | 1 | 1 |
| demo property | 0 | 1 | 1 |
| demo party | 0 | 1 | 1 |
| demo status definitions | 0 | 4 | 4 |
| demo group | 0 | 1 | 1 |
| demo group status events | 0 | 1 | 1 |

Replay tuple-version proof:

| Row family | After first `xmin` | After replay `xmin` |
|---|---|---|
| `block_status_def.cancelled` | `10102` | `10102` |
| `block_status_def.definite` | `10102` | `10102` |
| `block_status_def.prospect` | `10102` | `10102` |
| `block_status_def.tentative` | `10102` | `10102` |
| `reservation_group.MEHRA-WED` | `10102` | `10102` |

The guarded `ON CONFLICT ... DO UPDATE ... WHERE block_status_def.deducts IS DISTINCT FROM EXCLUDED.deducts OR block_status_def.sort IS DISTINCT FROM EXCLUDED.sort` prevents the previous replay rewrite.

## Findings

No blocking findings.

## Verdict

PASS.

The previous FK and replay-mutation blockers are repaired. On a clean PostgreSQL 18 `yellow_test`, the command provisions the deterministic fixture, converts only `MEHRA-WED` from `tentative` to `definite`, rereads configured `block_status_def` deduct behavior as `false -> true`, writes exactly one `group.status_changed` outbox event in the same tenant transaction, and replay is non-mutating by response, row counts, outbox count and tuple versions. Focused tests, typecheck, boundaries and the 11/11 invariant referee all pass.
