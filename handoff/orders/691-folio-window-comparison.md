# Order691 — compare existing bill windows in the cashier workspace

24 September2026. Founder continuation of unfinished All Ecosystem workflows.
Existing FinanceWorkspace already reads/selects folios and performs governed
complete-group balanced transfer into existing/new named windows. Missing user
flow: compare itemized bills together then choose the correct window for actions.
Natural solution: reuse existing authorized FolioStatement reads and existing
FolioStatementTable/formatFolioMinor, not a parallel balance/ledger/command model.

## Ownership and scope

Builder reservation_workspace_research owns:
- frontend/yellow/src/folio-window-comparison.ts: pure selection/identity guards.
- frontend/yellow/src/ui/FolioWindowComparison.tsx and folio-window-comparison.css.
  Disclosure, selection of up to nine simultaneous panes from ALL existing
  server-returned windows (backend allows20; never hide10–20 or change that limit).
  Independent lazy parallel statement reads, per-pane errors/retry, exact returned
  folio/reservation validation. Integer money only, no inferred missing balances
  or cross-currency sum. Context-keyed state clears when reservation changes.
  Choose active window callback respects provided financial navigation lock.
  Read-only comparison; retain existing writes in the original parent workbench.
- tests/order691-folio-comparison.test.ts; tests/fixtures/order691/**.

Root owns disjoint integration:
- frontend/yellow/src/workspaces/FinanceWorkspace.tsx: mount component in existing
  bill context, pass current exact family/IDs/loadStatement/selectFolio and lock;
  scope refresh/invalidation to actual active statement generation so comparison
  does not silently remain stale after current command readback. Do not refactor
  posting/transfer/deposit/receivable handlers or recovery locks.
- frontend/yellow/src/ecosystem/capability-registry.ts: only folio-windows entry
  accurate route and bounded beta/capability copy after proof, not full cashier
  completion. No fake creation of nine folios or arbitrary partial-money split.
- This order; handoff/reviews/691-folio-comparison.md;
  handoff/receipts/691-folio-comparison.md; docs/PROJECT-STATUS.md;
  handoff/LEDGER.md; generated public/yellow-next and D:/Yellow/temp release recipe.

## Proof and forbidden changes

Independent non-implementer reviews money display, identity guards and lifecycle
lock integration and personally runs selected tests. Root mounted CUA synthetic
multi-window proof (1,2,9 and >9 family; independent error/retry; context switch;
locked activation); public read-only desktop/mobile check. Type/boundary/build and
licence gates; current a42f0b25 rollback retained. No backend/schema/writes/authority
changes, no live QA charges or new folios. Read snapshots are not atomic across
windows; display this and permit refresh rather than fabricate aggregate truth.
