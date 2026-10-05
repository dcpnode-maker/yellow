# Order 691 independent review — compare existing folio windows

2026-09-24. Reviewer: Codex non-implementing agent `order679_independent_review`. I did not implement the comparison helper, UI, fixture or parent integration. This order is read-only; I made no database, folio, journal, charge or live hotel mutation for its proof.

## Decision

**Scoped source approved for coordinator's mounted/public release acceptance.** The comparison reuses existing authorized folio-statement reads and the existing statement table/BigInt minor-unit formatter. It does not create windows, move charges, infer missing balances, aggregate unlike currencies or add a parallel financial authority. This is not a claim of an atomic multi-window snapshot or a complete cashier capability.

## Findings and corrections inspected

- The picker renders every server-returned family member, including windows 10–20, while limiting simultaneous panes to nine. Selection is keyed to exact folio IDs, prunes disappeared windows, and the component remounts when property/reservation identity changes. Read queries are property/reservation/folio-keyed, independent, lazy until disclosure, with per-pane loading/error/retry. Only the original parent workbench retains posting/transfer actions; the comparison has read-only statement panes and a guarded “Use this window” callback that respects the parent financial navigation lock.
- The first statement validator checked reservation ID, folio ID and window number but could pass malformed JSON money to `BigInt` during render, potentially breaking the whole comparison. The implementer moved validation into each pane's query function and checks currency and canonical integer minor-unit strings, including each row's amount/running balance and scalar table fields. A malformed response now becomes that pane's retryable error rather than an invented value or cross-pane render failure.
- I flagged that the parent initially preferred the active statement's sibling-window family even when a newer reservation-detail read listed an externally added window. Root now chooses the newer exact authoritative family using statement/detail update times, retaining the existing preference for a statement when it is newer after a transfer. This preserves all currently returned windows without combining two potentially inconsistent snapshots.
- The UI explicitly discloses that separately read windows are **not atomic** and offers refresh. Each pane displays its own server currency and server balance with exact integer-minor formatting; there is no cross-currency total. The nine-pane grid and statement tables have contained horizontal scrolling and mobile/focus CSS.

## Personally executed proof

- `bun test tests/order691-folio-comparison.test.ts tests/order672-folio-statement.test.ts tests/order672-folio-workbench.test.ts tests/order672-navigation.test.ts`: **16 pass, 0 fail, 79 assertions**. The new pure tests cover all-20 visibility versus nine-pane cap, selection pruning, exact reservation/folio identity, malformed money/currency rejection and values larger than `Number.MAX_SAFE_INTEGER`; existing tests cover integer table sorting, formatter, original workbench locks and navigation.
- `bun run typecheck`: backend and frontend passed after the completed fixture/type correction. `bun run boundaries`: **208 TypeScript files scanned**, pass.
- I inspected the final helper/component, parent FinanceWorkspace mount and CSS directly. The local synthetic browser fixture is not counted as my personal browser proof; the coordinator separately reports mounted one/two/nine/twenty-window, per-pane outage/retry, wrong-identity rejection, lock and context-switch checks.

## Remaining acceptance boundary

The coordinator owns final public read-only desktop/mobile acceptance, exact release artifact and rollback. No backend/schema change or new permission is included. The whole folio/cashier or All Ecosystem capability must not be relabelled complete from this comparison alone.
