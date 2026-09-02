# Order 352 — Order349 PostgreSQL COALESCE and hostile-fixture repair

**Status:** ACTIVE-D997
**Phase:** 5 — Financials
**Branch:** `phase-5/order349-postgresql-coalesce-fixture-repair`
**Base:** exact Order349 candidate `64f31a4` / implementation `533217e`
**Risk tier:** 3 — repair to financial close-readiness executable proof
**Owner:** Codex repair implementation; different fresh non-implementing Tier-3 rereviewer

## Outcome

Repair only the two exact executable defects found by Order349's fresh reviewer:

1. replace invalid `pg_catalog.coalesce(transition.safe,false)` with PostgreSQL
   `COALESCE(transition.safe,false)` in the one readiness CTE; and
2. bind the forged hostile outbox payload as one typed SQL parameter rather than
   interpolating a parameter placeholder inside a SQL string literal.

The parent integration proof also contains only three broad cases and does not
execute the complete preregistered P2/P4/P5 matrix. Add bounded integration cases for
each typed due-in/out, cashier, discrepancy and fiscal blocker; pending-payment,
statutory and channel unknown attribution; forged payload exclusion; one-statement,
zero-write and concurrent-change coherence. No readiness semantics, attribution,
threshold, result shape, schema, permission or authority changes.

## Exact scope

- `src/contexts/financials/business-day-close-readiness.ts`, only the exact invalid
  COALESCE expression;
- `tests/business-day-close-readiness.integration.test.ts`, the exact forged payload
  parameterization and missing P2/P4/P5 executable cases named above;
- this order, its review evidence, `DECISIONS.log` and `handoff/LEDGER.md`.

## Proof

- Reproduce PostgreSQL `42883` and fixture `42P18` against the parent candidate.
- On the repaired candidate, personally execute the full Order349 focused unit and
  fresh-PostgreSQL integration proof, including tenant/actor/property containment,
  strict 4m59.999/exact-5m/future lag, typed/unknown attribution, payload hostility,
  one-statement/zero-write behavior and exact `61/111/101/10/2` catalogue.
- Run affected permanent gates, full standing/static proof and fresh referee 11/11.
- A different fresh Tier-3 reviewer must execute the proof before Order349 approval.

## Forbidden

- Any other product/test refactor, query or fixture change, or weakening a required
  blocker/unknown assertion;
- migration/schema/permission/event/fact/write/seal/carry/API/UI/local/Docker/stable
  port3000 change;
- weakening or deleting assertions to obtain green results;
- self-review or Phase5/application completion claim.

## Definition of done

- [ ] Both parent failures are reproduced before repair.
- [ ] The exact two-line repair makes complete Order349 proof green.
- [ ] Different fresh non-implementing Tier-3 approval is recorded.
