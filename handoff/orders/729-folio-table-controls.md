# Order729 — finish folio table column and copy controls

Root-owned parallel UI slice following founder requirements for compact Excel-like
tables and cell copying. Existing folio table displays a Columns button but passes
no selection callback, so every column checkbox is disabled. Correct that actual
unfinished interaction, not just its appearance.

## Exact scope

- frontend/yellow/src/ui/FolioStatementTable.tsx
- frontend/yellow/src/folio-statement-view.ts
- frontend/yellow/src/ui/folio-workbench.css
- tests/order729-folio-table-controls.test.tsx
- this order; handoff/receipts/729-folio-table-controls.md;
  docs/PROJECT-STATUS.md; handoff/LEDGER.md
- Generated local QA artifacts D:/Yellow/temp/order729/ only.
- Independent app_next_slice727 review: handoff/reviews/729-folio-table-controls.md.

## Contract and proof

Use existing TableControls and CopyCellButton; column selection hides matching
headers and body cells together, preserves canonical column order and at least one
column. Reset restores all columns and clears filter/sort/search. Copy sends only
the displayed cell text to the user's clipboard on explicit click; monetary display
uses the existing exact bigint formatter. Filtering/sorting never recalculates ledger
balances or changes records. Use field identity for numeric styling rather than
positional selectors that become incorrect when columns are hidden. No backend,
money mutation, API, dependency, shared editor semantics, or scope/grant change.

Tests cover deterministic visible-column derivation, exact display/copy text and
rendered markup; verify real hide/show/reset/copy plus mobile localized scroll after
combined Order727/729 local build. Run adjacent table tests and full typecheck.
No public tunnel restart, unrelated worktree changes, or ecosystem-complete claim.
