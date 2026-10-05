# Order 672 independent folio UI review

Reviewer: `/root/folio_ui_review` (non-implementing). Serving source: `D:/Yellow/git-live-order611-source-v2`. Scope inspected: `FinanceWorkspace.tsx`, new statement table/formatter, Order 672 UI tests, existing cashier allocation and receivable tests. This is a frontend control review; it does not establish database, ledger, migration, or live-browser proof.

## Findings and disposition

1. **Navigation during an uncertain financial operation — resolved.** Initial inspection found that the exact-folio and reservation-search paths could switch identity while allocation recovery or posting was active, despite the new window cards being locked. The final source derives `financialNavigationLocked` from posting, lookup, receivable, transfer and deposit state; `selectReservation`, `selectFolio`, exact lookup, and their buttons use it. Lookup also holds the parent lifecycle lock while awaiting both server reads and disables the command panels. A regression asserts the guards.

2. **Stale unsent allocation draft on exact lookup — resolved.** The successful exact-folio path now clears the allocation draft and posting-class view before selecting the new reservation and folio. The pending transfer attempt remains protected by the navigation lock.

3. **Sibling navigation test — resolved.** An intermediate targeted run yielded 23 pass / 1 fail because the reservation copy had not yet landed. Final reviewer rerun is green.

## Controls inspected

- The disclosure retains mounted children using `hidden`, and busy/uncertain states force the relevant panel open. Confirmation, preflight, same-key transfer/receivable recovery, exact receipt comparison and source/destination statement reconciliation remain in the existing command paths.
- Window and stay balances come from the server-returned folio statement. Statement rows keep their server running balances while query sorting/filtering only changes presentation. New table amounts use `bigint` minor units, including large and negative values; the independent UI tests are limited to these client behaviors.
- No API, command endpoint, or backend finance change was present in the inspected diff.

## Reviewer-executed proof

- `bun test tests/yellow-cashier-bill-window-allocation.test.ts tests/yellow-cashier-receivable-workbench.test.ts`: **14 pass, 0 fail, 124 assertions**.
- `bun test tests/yellow-cashier-bill-window-allocation.test.ts tests/yellow-cashier-receivable-workbench.test.ts tests/order672-folio-statement.test.ts tests/order672-folio-workbench.test.ts tests/order672-navigation.test.ts`: final personal run **25 pass, 0 fail, 184 assertions**. Earlier 23/1 intermediate result remains recorded above.

Verdict: **accepted for the scoped frontend finance-control review**, with no significant remaining finding in the inspected source. The browser journey, complete build, and database gates remain separate proof owned by the integrator; this review makes no claim about them or production readiness.
