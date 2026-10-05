# PROOF-20260930 — inherited pure-fixture reconciliation

Authority: continued founder Yellow build, laptop quota monitor policy active.
Basis6b0be810f5d78cdd3ebd9b3ad57f593594d5ef79, derived from pinnede06;
branch phase-7/inherited-fixture-reconciliation-20260930.

## Exact seven-file scope

- tests/reservation-board.integration.test.ts
- tests/yellow-reservation-finance-entry.test.ts
- handoff/questions/PROOF-20260930-inherited-fixtures.md
- handoff/orders/PROOF-20260930-inherited-fixtures.md
- handoff/reviews/PROOF-20260930-inherited-fixtures.md
- DECISIONS.log
- handoff/LEDGER.md

## Accepted contract and allowed implementation

Order632 requires board marketCode/sourceCode, selected and mapped from nullable
commercial fields. Extend the existing exact fake row with market_code:null and
source_code:null, require the two exact public keys, assert both null values.
Preserve every other field/key and state/order assertion.

MovementGrid occurs after ReservationWorkspace and before the following exact
LegacyReservationWorkspace declaration. Use that following declaration for the
source slice end. Preserve every existing Finance/action visibility assertion.

No product source, frontend behavior, database, schema, referee, provenance,
providers, migration, dependencies, budgets, deadlines or permission changes.
Do not edit tests/referee-typed-parent-fixtures.integration.test.ts: its historical
source provenance is a separate unresolved dependency, not a fixture workaround.

## Required bounded proof and review

Capture both old failures on identical frozen source/dependencies with no DB URLs.
Candidate focused pure tests must pass; an explicit unrelated optional DB skip
is reported as a skip, never accepted as executed database evidence. Types and
207-file boundaries and complete whitespace checks must pass. Non-implementer
root personally executes focused proof and checks exact contracts/scope/source.
Canonical setup11/11 remains required before publication; no PR/push with current
standing/release blockers. Local source commit is allowed after scoped review.

Bounded faster implementer owns the two tests and implementation receipt in this
order. Root owns independent review, governance acceptance and local commit.
No children, database commands, broad standing runs, commits or pushes by worker.

At laptop notification<=1% remaining PLAN, checkpoint and stop own dispatch. No
paid fallback/reset/automatic resume. Cloud has no direct usage reader/hardcap.

## Implementation checkpoint — fixture-only repair

Implemented on the exact order basis `6b0be810f5d78cdd3ebd9b3ad57f593594d5ef79`.
Only the two existing test files below were modified; no product or protected
referee/provenance source changed. The reservation-board fake row now contains
explicit nullable commercial fields, the exact output-key assertion includes both,
and a value assertion requires both to remain null. The Finance test now ends its
MovementGrid source slice at the following LegacyReservationWorkspace declaration.
All prior assertions remain.

Baseline, with all reservation-board DB URL variables explicitly unset:

```text
env -u YELLOW_RESERVATION_BOARD_DEPLOY_URL -u YELLOW_RESERVATION_BOARD_RUNTIME_URL -u YELLOW_RESERVATION_BOARD_URL /workspace/yellow-toolchain/bun test tests/reservation-board.integration.test.ts tests/yellow-reservation-finance-entry.test.ts
6 passed / 1 skipped / 2 failed; 83 assertions. The expected exact-row-shape
failure and inverted MovementGrid source-boundary failure were reproduced. The
only skip was the optional PostgreSQL board proof.
```

Candidate, same command and unset DB variables:

```text
8 passed / 1 skipped / 0 failed; 111 assertions. The only skip was the optional
PostgreSQL board proof; no database URL was supplied.
```

`bun run typecheck` passed. `bun run boundaries` passed: 207 TypeScript files
scanned. `git diff --check 6b0be810f5d78cdd3ebd9b3ad57f593594d5ef79` passed for
tracked changes. The appended order was checked with `git diff --no-index --check`
against `/dev/null`; it emitted no whitespace diagnostics (exit 1 reflects the
new-file comparison). No broad standing or database proof was run. Independent
root proof and review remain required.

The earlier historical-source lookup failure was caused by a shallow checkout.
After this implementation, the coordinator fetched repository history and
confirmed the existing Order130 `P0` reference contains the required original
referee bytes at SHA-256 `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`
(blob `0d2b9d53`). The implementer made no referee or provenance edit; the
coordinator owns the unchanged provenance proof.

Frozen source/test SHA-256 at this checkpoint:

```text
69549367d8da2fc7ce298b73a08b1faac4ca9f75f057d24fa682150d2d2adfa9  tests/reservation-board.integration.test.ts
9ea2b04d0ea69a342a28df44615b5a805cb9ed28c34485ac8ac1f4400c3e54c2  tests/yellow-reservation-finance-entry.test.ts
fe2d1b6f49293d442012f0df5689cbdeb89b58f7c8a393d9d87fea741131a45f  src/contexts/reservations/board.ts
8163968bcde9b69d64d30ec117152aaec76b84e6328e17e008d4eb46f4a37b59  frontend/yellow/src/App.tsx
```

## Independent final checkpoint

Root personally executed baseline6/1skip/2fail/83 and final8/1skip/0fail/111, then exact candidate canonical11/11. Optional board DB skip is not proof. Root verified unchanged board/frontend/referee/provenance bytes, preserved all earlier assertions and exact seven-file scope; independent review accepts bounded source only. Normal origin history fetch separately resolves unchanged existing P0/hash test1/4DBskips/0/4; no provenance changes. Standing/browser/frontend/MCP/live/laptop gates remain open.
