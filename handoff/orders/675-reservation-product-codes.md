# Order 675 — Verified commercial codes in the reservation board

Status: DELIVERED — 24 September 2026. Stored code projection, shared table controls, independent PostgreSQL/HTTP proof and desktop/mobile live verification complete. Receipt675 records exact limits. Founder asked to resume the existing ecosystem; no new product/version or architecture rewrite.

## Objective
Expose the stored room-type code and rate-plan code in the existing Arrivals / Departures / In-house workspace, including search, column menus and multi-level sorting. Use existing selected-segment lineage and same-property references; labels are not codes. Preserve the accepted compact design and all existing commands.

## Evidence and limits
Discovery personally inspected reservations/board.ts, detail.ts, offers.ts, rates/composition.ts and reporting/commercial-attribution.ts. Unit type and rate-plan codes already exist. Room class is separately configurable and is not inferred from room type; the founder already specified King/Twin/Queen versus Deluxe/etc. Existing quote package evidence is not a persisted booked-meal snapshot. Do not infer historical meals from today's rate release or invent a Room Only default. These follow-on capabilities remain required, not dropped. Decisions D-230, D-245, D-250 and D-261 remain binding.

## Scope in D:/Yellow/git-live-order611-source-v2
- src/contexts/reservations/board.ts (read projection only; additive unitTypeCode and ratePlanCode)
- src/http/operator.ts (only the two additive reservationBoardJson fields; Q675-http-code-projection)
- frontend/yellow/src/yellow-api.tsx (Stay response contract only)
- frontend/yellow/src/today-workspace.ts (typed code fields, query search/sort capability only)
- frontend/yellow/src/movement-table-query.ts (columns for the two stored codes)
- frontend/yellow/src/App.tsx and workspaces/ReservationWorkspace.tsx (only if an explicit cell renderer requires these two columns)
- tests/reservation-board.integration.test.ts; tests/order632-reservation-board-commercial-codes.test.ts; tests/order674-movement.test.ts; tests/yellow-today-workspace.test.ts (genuinely superseded expectations only)
- tests/order675-*.test.ts (focused code projection/query proof)
- tests/yellow-reservation-board-pages.test.ts; tests/yellow-reservation-board-attribute-performance.test.ts (stale pre-674 source markers only, Q675-regression-proof-scope; preserve behavioural/performance/pagination proof)
- handoff/orders/675-reservation-product-codes.md pointer; handoff/reviews/675-*.md; handoff/receipts/675-*.md; handoff/LEDGER.md
- docs/design/KOLE-INTERACTION-SYSTEM.md (capability status only)
- a temporary order675 deployment Dockerfile if verified narrow deployment is possible; delete it after use
- coordination tree: this order, handoff/receipts/675-*.md, handoff/questions/675-*.md, handoff/LEDGER.md

No new schema, migration, taxonomy writes, booked pricing changes, occupancy/state changes, financial writes, permissions, integrations, dependencies or new app instance. No bulk staging, resets, destructive cleanup or secrets in output. Preserve the dirty integration tree and existing branch; do not publish unrelated work. Any extra file requires an explicit scope question before editing.

## Ownership and proof
Root owns UI integration and deployment. Sol agent owns board projection and backend proof tests; a different agent personally executes relevant database/tenant proof and records commands/results. Root verifies UI query tests, types, boundaries, build, desktop/mobile display and actual live responses. Do not count skipped DB tests as proof. Use only a verified isolated test database for fixture writes, never the live database. A live read is allowed for contract verification.

## Deployment
Single existing yellow-public-demo-app-1 only, with preserved rollback image. Before a backend cutover compare its base board.ts to the source baseline and prove only this order's file deltas are introduced. Do not rebuild/publish the whole dirty backend. If the narrow delta cannot be established, leave current live app untouched and report a source-complete deployment blocker.

## Acceptance
Actual codes survive same-property validated projection. Preserve the existing ReservationBoardConflictError for missing/cross-property unit-type or rate-plan references: no foreign values or silent fallback rows. Pagination and lanes stay unchanged. Codes are searchable/sortable/filterable separately from names. Meal plan and class are not fabricated. Existing UI shell/ribbon, mobile containment and read-only data remain intact. Record scoped delivery honestly; ecosystem completion is not claimed.
