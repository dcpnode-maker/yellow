# Question 141 — Order 118 cumulative gate inherits a founder-status login budget conflict

**From:** Order 118 builder  
**Date:** 2026-08-24  
**Status:** RESOLVED — correction isolated to READY Order 122; Order 118 is not widened

## Executed evidence

The complete 16-suite cumulative database runner was restarted from suite one on an
exclusive disposable PostgreSQL 16.15 cluster after Order 118 focused, migration,
deployment, schema, type/boundary and pristine referee proofs were green. The first
seven suites passed. `tests/founder-status.integration.test.ts` then passed its first
six tests, including authenticated P1, but P2 stopped at `loginToken()` with exact
status `429` where the inherited assertion requires `200`.

The module constructs one `LocalLoginService`/app for both database tests. P1 consumes
one successful normalized-account attempt. P2 calls the same helper three more times;
Order 117's approved account bucket capacity is exactly three and success clears only
backoff, not capacity. The fourth valid login is therefore deterministically denied.
This is not caused by migration 0012 or PostgreSQL role state.

## Hard floor

Order 118 Scope names `tests/founder-status.integration.test.ts` only for the honest
post-green build snapshot. Editing its inherited authentication fixture before all
proofs are green would silently broaden the order and could accidentally weaken the
approved Order 117 abuse policy. P5 cannot be claimed while the cumulative runner is
red.

## Narrow proposed correction

Authorize only the test fixture to create a fresh app and `LocalLoginService` for each
database test, while preserving the production bucket capacities, every HTTP assertion,
credentials, Argon2 behavior and all product code. Then restart the complete 16-suite
runner from suite one. Do not raise/disable the limiter, sleep/refill time, retry from
suite eight, or treat `429` as success.

May Order 118 Scope use `tests/founder-status.integration.test.ts` for that exact
fixture-isolation correction before the post-green snapshot update?

## Resolution

No. The coordinator accepted the fixture-only strategy as separate Order 122 on exact
Order 118 executable SHA `09070d97e1f457a2d3f87a2ab6dc33b558bc3895` and explicitly
forbade widening Order 118. Order 122 alone may implement the test-fixture lifecycle
correction and must restart all 16 suites. Until that reviewed lineage returns, Order
118 retains its exact implementation SHA and an honest incomplete P5 cumulative gate.
