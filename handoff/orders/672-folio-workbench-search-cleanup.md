# Order 672 — One search entry and Yellow folio workbench

Status: COMPLETE — scoped UI update independently reviewed and deployed to existing review app. Founder request 2026-09-24. Phase 7 experience integration.

## Intent
Remove redundant guest-search navigation while preserving profile deep links and universal search. Give the existing cashier folio a readable billing-window workspace, statement table, contextual tools and mobile layout. Remove competing PMS product names from user-facing copy, without renaming actual integration contracts.

## Scope
Serving source D:/Yellow/git-live-order611-source-v2 only:
- frontend/yellow/src/App.tsx
- frontend/yellow/src/workspaces/ReservationWorkspace.tsx
- frontend/yellow/src/workspaces/FinanceWorkspace.tsx
- frontend/yellow/src/ui/FolioStatementTable.tsx
- frontend/yellow/src/ui/folio-workbench.css
- frontend/yellow/src/folio-statement-view.ts
- frontend/yellow/src/hotel-search.ts
- frontend/yellow/src/ecosystem/registry.ts
- tests/order672-*.test.ts
- this order pointer in handoff/orders/672-folio-workbench-search-cleanup.md
Coordination: this order, handoff/reviews/672-folio-workbench-search-cleanup.md, handoff/receipts/672-folio-workbench-search-cleanup.md, append-only handoff/LEDGER.md.

## Boundaries
No API, ledger mutation, permissions, migrations, provider activation, payment semantics or real guest data changes. Existing canonical posting/transfer/deposit/AR controls and uncertainty recovery must remain intact. No unsafely inferred payer or fabricated totals. Reuse the shared table-query/TableControls. Do not claim partial charge splitting, arbitrary transfer or settlement exists beyond the current commands. Preserve existing dirty source and single serving app; no duplicate app, merge or broad cleanup.

## Acceptance
Guest search is not a separate navigation tab; universal search still opens a guest's profile/history and reservation. No competing PMS name in active app labels. Folio clearly shows guest, windows, selected balance, statement rows and progressively disclosed posting/split/AR/deposit tools. Shared table search, advanced filters/sorting preserve ledger running balances and exact minor-unit values. Desktop/mobile browser interactions, targeted regressions, frontend/root typechecks, boundaries and Vite build pass. Independent reviewer inspects unchanged mutation guards and executes focused proofs. Publish only to existing review app with rollback retained; no production-readiness claim.

## Current-state reconciliation
state.ps1 succeeds but reads stale September13 project metadata/default Compose project. Actual serving app remains yellow-public-demo-app-1 at loopback3010, documented in Order671 receipt; latest changes must be verified there. No unrelated process shutdown is authorized.
