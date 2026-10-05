# Order 362 — Order361 exact-scope and snapshot proof completion

**Status:** APPROVED-D1044 — fresh independent Tier-3 statutory proof complete
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

## Builder evidence — D1026

Exact proof candidate `b89d422` plus fixture hardening `a90d3a6` changes only
`tests/india-gst-accommodation-final-component-tax-authority.integration.test.ts`.
Fresh PostgreSQL authority passes **14/0 (608)**; exact catalogue remains
`63/116/106/15/2`; acceptance passes **23/0 (65)**; runtime-DML **5/0 (120)**;
SECURITY-DEFINER **3/0 (192)**; real Order341 ancestor **5/0**; migration integration
**39/0 (187)**; and seed **10/0 (63)**. Typecheck is green. The initial acceptance
attempt shared authority fixtures and is excluded; a rebuilt clean volume passed.
The first migration invocation correctly refused protected `yellow_dev`; the fresh
unprotected run passed. Disposable containers, network and volume were removed; a
transient Windows handle prevented deletion of one non-secret temp directory.
Fresh independent Tier-3 review remains mandatory and no downstream tax authority
follows from builder evidence.
