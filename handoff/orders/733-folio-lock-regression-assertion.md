# Order733 — keep the adjacent billing lock regression proof current

Scope: tests/order672-folio-workbench.test.ts (one expected deposit-lock literal),
this order, handoff/questions/733-folio-lock-regression-assertion.md,
handoff/receipts/727-folio-charge-correction.md and handoff/LEDGER.md.

Root updates the expected ownership expression to include the correction lease.
Preserve every other assertion. Personally execute this test plus Order727 tests;
nonimplementing financial reviewer checks the final assertion. No application,
backend, financial policy, database, or unrelated baseline changes.
