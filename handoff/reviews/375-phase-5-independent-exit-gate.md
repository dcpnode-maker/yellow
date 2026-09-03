# Order 375 — Phase-5 independent exit-gate full rereview after setup repair

**Verdict:** CHANGES REQUIRED / WITHHELD

**Activation reviewed:** `939913b69d4708132027ea5e5965615c450fe10e`

**Frozen approved product ancestry:** `578ea1e3e6edf13e47bcc65fc28760c90ff9413f`

**Reviewer:** `/root/order375_after_setup_full`, fresh non-implementing Tier 3,
distinct from all prior Order375 and repair-order implementers/reviewers

**Date:** 2026-09-03

## Blocking finding

The mandatory from-item-1 run is withheld because
`tests/business-day-roll.integration.test.ts` produced a real concurrent unique-key
violation in **twenty contenders converge to one atomic effect**. The database raised
SQLSTATE `23505` on `business_day_tenant_property_date_uq`: migration0061 inserts the
property-local current day with `ON CONFLICT ON CONSTRAINT business_day_pkey DO
NOTHING`, but the competing identity is protected by the distinct
tenant/property/date unique constraint. The failed contender rejected instead of
converging. Its committed winner then made the immediately following injected-event
rollback test resolve as an existing day, so the complete nine-file batch was
**54 passed / 2 failed (2,187 assertions)**.

The exact six-test day-roll file passed once on a second newly created and freshly
migrated 64-migration database (**6/0, 25 assertions**). That non-reproduction does
not erase the personally observed required-run failure or authorize a flaky-race
waiver. Order375 explicitly requires every concurrency gate to pass and says any red
withholds approval. A separate bounded repair and another fresh full rereview are
required; the reviewer made no repair.

## Reviewer-personal executable evidence before the mandatory stop

- Windows-native PostgreSQL17 applied migrations1–64 from the exact activation and
  provisioned the separated deployment, runtime and extension-registrar roles.
- The required fresh catalogue returned exact `64/116/106/106/15/2`.
- Complete folio/posting/statement/correction/multi-window/row-lock proof passed
  **57/0 (385 assertions)**, including 500 charges/1,000 posting lines, zero drift,
  immutable originals, replay, rollback and hostile authority.
- Payment, hosted-deposit, settlement, cashier, receivable, both exact-zero journey
  paths and owner-trust proof passed **55/0 (1,636 assertions)**, including token-only
  evidence, different-user one-use approvals, races and raw-DML rejection.
- The day-close batch passed 54 cases before the two linked day-roll failures above;
  readiness, discrepancy-carry, audited-seal and legacy seal-authority cases that ran
  were green.

Authority aggregation, standing/static/acceptance and fresh referee completion stop
unclaimed after the mandatory red. Previously produced results are not reused.

## Teardown and boundaries

PostgreSQL was stopped, port55529 refused connections, the exact disposable review
root and its second reproduction database were removed, and no
`C:\Users\astha\AppData\Local\Temp\wsl-crashes` directory was generated. No product,
test, migration, schema, permission, seed, dependency, HTTP/UI, local, Docker or
`.yellow` artifact was read or changed. The four Phase5 services remain unwired in
operator API/UI/status/local truth, and no Phase5 or application-completion claim is
made.
