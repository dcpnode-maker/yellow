# Order 375 — Phase-5 independent exit-gate post-carry full rereview

**Verdict:** CHANGES REQUIRED / WITHHELD

**Activation reviewed:** `94431ca2c30761f093fdcb3d20b631c0408b1c3c`

**Frozen approved product ancestry:** `c84ab29f46541c58770b3a671f82b28e2bacf633`

**Reviewer:** `/root/order375_postcarry_full_reviewer`, fresh non-implementing Tier 3,
distinct from all prior Order375/376/377/378 implementers and reviewers

**Date:** 2026-09-03

## Blocking finding

The required from-item-1 restart is withheld on a deterministic stale strict catalogue
assertion in `tests/app-role-nonlogin.integration.test.ts:232`. On the fresh required
64-migration frontier the suite expects `89/79/79` public tables/RLS relations/policies,
while authoritative live truth is `116/106/106`. Its other authentication, unrelated
principal, tenant isolation and atomic retry cases passed.

This is a test-oracle defect rather than an observed product failure, but Order375
forbids test repair or red waiver. A separately scoped repair and another distinct
full rereview are mandatory; Phase5 remains unapproved.

## Reviewer-personal executable evidence before the mandatory stop

- A fresh Windows-native PostgreSQL 17 disposable cluster applied migrations 1–64
  and returned exact catalogue `64/116/106/106/15/2`.
- Complete folio/posting/statement/correction/multi-window/row-lock proof passed
  **57/0** after the reviewer supplied every declared deploy/runtime variable. This
  includes 500 charges, 1,000 balanced immutable posting lines, exact zero drift,
  replay, rollback, sealed-day and tenant/property/role/`pg_temp` hostility.
- Payment, hosted deposit, settlement, cashier, receivable, both exact-zero financial
  journeys and owner-trust proof passed **55/0 (1,636 assertions)**, including token
  only evidence, different-user one-use approvals, races and raw-DML rejection.
- Day roll, worker wiring, close readiness, discrepancy carry and audited seal proof
  passed **56/0 (2,191 assertions)**, including strict lag/unknown attribution,
  immutable carry lineage, same/distinct-key races, unpublished-writer serialization,
  atomic fact/event/replay/rollback and exact-property actor containment.
- The authority/catalogue batch passed SECURITY DEFINER containment **3/0**, runtime
  DML authority **5/0**, schema normalization **4/0**, and four of five app-role
  containment cases before the decisive stale-catalogue red above.

Other reds observed in that final combined command are not represented as repository
findings: the mandated PG17 server intentionally differs from the deployment
acceptance suite's pinned PG16.15 expectation; acceptance was invoked on the already
used hostile-fixture database instead of its required canonical-seed database; and
the reviewer-created deploy/registrar role tuple was not the production provisioning
tuple. None can waive or obscure the independently sufficient app-role oracle red.
Standing/static/acceptance/referee completion stopped unclaimed once that deterministic
repository failure made approval impossible.

## Teardown and boundaries

The reviewer stopped the PostgreSQL server, verified port 55481 had no listener,
removed and verified absent exact disposable root
`E:\yellow\order375-review-a61f39c2`, and confirmed no
`C:\Users\astha\AppData\Local\Temp\wsl-crashes` directory was generated. No product,
test, migration, schema, permission, seed, dependency, HTTP/UI, local, Docker or
`.yellow` artifact was read or changed. The four Phase5 services remain unwired in
operator API/UI/status/local truth, and no application-completion claim is made.
