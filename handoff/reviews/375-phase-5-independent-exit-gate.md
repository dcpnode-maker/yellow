# Order 375 — Phase-5 independent exit-gate final full rereview

**Verdict:** CHANGES REQUIRED / WITHHELD

**Activation reviewed:** `7b0864fbcb466cd7260a7ae188318c0e8ea17e85`

**Frozen approved product ancestry:** `ac87eea22268d80d8d73727908ff042b7ee7cda1`

**Reviewer:** `/root/order375_final_after_apple`, fresh non-implementing Tier 3,
distinct from all prior Order375 and repair-order implementers/reviewers

**Date:** 2026-09-03

## Blocking finding

The mandatory from-item-1 restart is withheld on one deterministic stale permanent
oracle in `tests/setup-current-catalogue-oracle.test.ts:15`. The test derives the
authoritative migration directory as `64` files ending at migration `64`, but still
expects `63/63`; its independently derived `116` public base-table expectation is
current. The focused reproduction is **0/1 (1 assertion)**, and the full standing
suite is **1,224 passed / 956 expected environment skips / 1 failed (18,606
assertions; 2,181 tests / 402 files)** on the same exact reviewed checkout.

This is a test-oracle defect rather than an observed product failure, but Order375
forbids test repair or red waiver. A separately scoped one-assertion repair and
another distinct full rereview are mandatory; Phase5 remains unapproved.

## Reviewer-personal executable evidence before the mandatory stop

- A fresh Windows-native PostgreSQL17 disposable cluster applied migrations1–64;
  complete catalogue assertions returned exact `64/116/106/106/15/2`.
- Complete folio/posting/statement/correction/multi-window/row-lock proof passed
  **57/0 (362 assertions)**. This includes the 500-charge/1,000 balanced immutable
  posting-line load, exact-zero drift, replay, rollback, sealed-day and hostile
  tenant/property/role/`pg_temp` boundaries.
- Payment, hosted-deposit, settlement, cashier, receivable, both exact-zero journey
  paths and owner-trust proof passed **55/0 (1,636 assertions)**, including token-only
  evidence, different-user one-use approvals, races and raw-DML rejection.
- Day roll, worker wiring, close readiness, discrepancy carry and audited seal proof
  passed **56/0 (2,191 assertions)**, including strict lag/unknown attribution,
  immutable carry lineage, same/distinct-key races, unpublished-writer serialization,
  atomic fact/event/replay/rollback and exact-property actor containment.
- Authority/catalogue proof passed **17/0 (374 assertions)**: SECURITY DEFINER
  containment3, runtime-DML authority5, schema normalization4 and app-role
  containment5.

The reviewer's first combined financial invocation used legacy suites with runtime
credentials and exhausted the deliberately small default server connection pool;
all affected suites were rerun from their beginning with their declared deploy/runtime
roles and passed in the totals above. The first day-close invocation exposed that the
fresh server had not preloaded `pg_stat_statements`; after enabling that disposable
server prerequisite, the entire nine-file day-close batch was rerun and passed in the
56/0 total. Neither reviewer-environment correction changed repository or database
product/schema truth.

Standing/static/acceptance/referee completion stopped unclaimed as soon as the
permanent standing suite established the repository red. That red alone prevents
approval regardless of the already-green domain and authority evidence.

## Teardown and boundaries

The reviewer stopped PostgreSQL, verified port55483 refused connections, removed both
exact disposable roots created during the review, and confirmed that no
`C:\Users\astha\AppData\Local\Temp\wsl-crashes` directory was generated. No product,
test, migration, schema, permission, seed, dependency, HTTP/UI, local, Docker or
`.yellow` artifact was read or changed. The four Phase5 services remain unwired in
operator API/UI/status/local truth, and no application-completion claim is made.
