# Order 362 — Order361 exact-scope and snapshot proof completion

**Status:** ACTIVE-D1023
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/order361-exact-scope-snapshot-proof-completion`
**Base:** exact withheld product/proof `b6aaa1f` + `e79b935` + `d4d6662` / governance `7557112`
**Risk tier:** 3 — statutory taxable-value executable authority proof
**Owner:** Codex proof implementation; different fresh non-implementing Tier-3 reviewer

## Outcome

Close only the five permanent proof omissions found by the fresh Order361 reviewer.
Keep the repaired production boundary and exact `63/116/106/15/2` catalogue unchanged
unless a new executable red proves an exact defect.

## Exact scope and proof

Extend `tests/india-gst-accommodation-final-component-tax-authority.integration.test.ts`
and bounded test helpers only to prove, through the real production service and real
Order341 resolver on fresh PostgreSQL:

1. reservation mismatch and folio mismatch;
2. colliding same UUID rows in a second tenant and transaction-local RLS isolation;
3. reordered ordinals, business-date mismatch, zero night and explicit persisted
   valuation-total versus room-night-sum mismatch;
4. an otherwise-valid exact scope with zero current valuation heads; and
5. instrumentation that Order341 resolution plus valuation and room-night reads all
   execute through one supplied transaction/snapshot.

Then run the complete authority/statutory matrix, exact catalogue, migration,
acceptance, runtime-DML, SECURITY-DEFINER, seed/review-seed, ancestor/standing/static/
schema and fresh referee `11/11`. A different fresh non-implementing Tier-3 reviewer
must personally approve.

## Forbidden

No mocked resolver, weaker substitute, migration/schema/catalogue/write/permission/
route/UI/posting/document/IRP change, local/deploy/merge/`.yellow`/port3000 mutation.
