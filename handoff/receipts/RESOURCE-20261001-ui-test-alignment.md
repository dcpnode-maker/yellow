# RESOURCE-20261001 — UI test alignment receipt

Date: 2026-10-01  
Order: `handoff/orders/RESOURCE-20261001-ui-test-alignment.md`

Aligned three stale UI assertions within the ordered test files. Today now renders the movement component and checks its three distinct accessible action labels and icons while retaining the operational callback wiring assertion. Reservation search now renders `TableControls` for Arrivals and Departures and checks each table-specific accessible name. Finance assertions now match the existing `IN-HOUSE BILLING` and `PRE-ARRIVAL BILLING` state labels. Exact reservation routing, charge eligibility, idempotency and recovery guards remain asserted.

## Proof

- Focused eleven-file suite: **42 passed, 0 failed, 626 assertions**. Exit code 0.
- `bun run typecheck`: exit code 0.
- `git diff --check` on the three ordered tests and this receipt: exit code 0.
- Logs: `E:\YellowWorkspace\Data\BuildArtifacts\yellow-laptop-20261001-resource-v1\ui-test-alignment-focused.log` and `.stderr.log`; typecheck logs are `ui-test-alignment-typecheck.log` and `.stderr.log` in the same directory.
- The order records the prior baseline as 39 passed and 3 failed. No baseline raw RED log was present in the artifact directory when this work began.

SHA-256 of the resulting ordered test files:

| File | SHA-256 |
|---|---|
| `tests/order611-today-glass-dashboard.test.ts` | `03C5CD1CBDA7E6D80B73027BE1D791CAB69338D95010465413093F820C462862` |
| `tests/yellow-reservation-command-surface.test.ts` | `6DBD55E80C1C3F28091FABD57C03AAB4AEED9C4D30D66253F429DBDB0F51818A` |
| `tests/yellow-reservation-finance-entry.test.ts` | `DE2B7AB974695DE17742D92C83BBC7403ECD43A73034484FD37D1468FF13C07B` |

Root independently inspected the ordered changes and verified the three recorded hashes. Root personally reran the eleven-file suite: 42 passed, zero failed, 626 assertions; root/frontend typecheck and scoped diff checks exited 0. Root logs are `root-ui-review-tests.log` and `root-ui-review-typecheck.log` in the same artifact directory. The original captured RED tool result is retained as `root-original-ui-red-tool-result.json`; its output was truncated at capture time.

Rendered server markup provides unit evidence for labels and controls. It does not verify interactive browser, keyboard, pointer or touch behavior; the separate browser security limitation remains unresolved.
