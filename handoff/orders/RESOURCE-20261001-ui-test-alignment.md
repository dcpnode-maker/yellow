# RESOURCE-20261001 — receiving UI contract check alignment

Author: Codex primary architect/coordinator. Phase 7. The laptop remains the main controller; this scope does not overlap the cloud release-successor implementation.

## Problem and scope

The native receiving-source build and type checks pass, but its focused operational suite has 39 passes and three failures. Independent inspection found expectations coupled to an obsolete state setter, generic search copy and older billing-heading copy.

Only modify `tests/order611-today-glass-dashboard.test.ts`, `tests/yellow-reservation-command-surface.test.ts`, `tests/yellow-reservation-finance-entry.test.ts`, and `handoff/receipts/RESOURCE-20261001-ui-test-alignment.md`. Preserve all other existing changes. Isolated execution logs may be written under the existing resource-build artifact directory.

## Required behavior

- Preserve the Today movement actions, exact operational destination wiring and keyboard/touch semantics. Replace the obsolete setter-name expectation with a meaningful rendered-component contract where feasible, using existing React/ReactDOM dependencies; do not add packages or alter product code just to satisfy a test.
- Verify the table-specific accessible search label from rendered `TableControls`, including a distinct second table label. Preserve single-filtered-board, pagination and operational-state assertions.
- Preserve exact-reservation Finance routing, server-owned charge eligibility and pre-arrival versus in-house context. Align the stale heading expectations with the current existing status labels; do not weaken routing, idempotency, recovery or charge guards.

## Proof

Run the original eleven-file focused suite, native typecheck and diff check. Preserve RED logs and report actual pass/fail counts. Root independently examines and executes the result. Rendered SSR/unit proof does not constitute interactive browser/touch acceptance; the separate browser security failure remains recorded. No product wording, backend, migration, tenant or financial authority change is in scope.
