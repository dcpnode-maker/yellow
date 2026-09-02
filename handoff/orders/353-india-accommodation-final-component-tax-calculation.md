# Order 353 — India accommodation final component-tax calculation

**Status:** REVIEW-WITHHELD-D1018 — repair Order360 active
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-accommodation-final-component-tax-calculation`
**Base:** exact approved D1012 production frontier `f634d16`; coordination head `bed36c0`
**Risk tier:** 3 — statutory tax calculation
**Owner:** Codex implementation; fresh non-implementing Tier-3 reviewer

## Outcome

Produce one pure, read-only and recursively immutable calculation from approved
Order350 ordinary final valuation evidence. For every positive final room-night value,
replay the complete approved Order340/337/341 ancestry, reselect the applicable slab
from the final value, calculate each ordered levy component independently using exact
rational arithmetic and half-up INR-minor-unit rounding, then return component,
room-night, valuation-tax and grand totals without an aggregate residual.

## Activation prerequisites

1. Order350/354 is freshly independently approved at its exact final migration0062
   and service head.
2. The actual post-approval schema, exports and canonical evidence hashes are bound
   into this order before intentional red.
3. Approved Orders337, 340 and 341 remain exact ancestors and their permanent proofs
   are green.

All three prerequisites were discharged at D1014. The bounded activation replay binds
the approved Order341 `cgst_sgst` fixture (service 2025-09-21, books 2025-09-23,
bank/invoice 2025-09-24, values 700000/800000) to canonical evidence hash
`53fbe0a88b2184a0130c786ec23223f1f0f91643e27e8e56b0dda401e15ceb16`.
The real migration0062 replay then produced one ordinary generation-0 value and one
ordinary generation-1 correction, both 1000 INR minor units/one room-night, with
evidence hashes `17a2825b125ef3547d01a8fb15c988e39447ca06bcdcac3aaca0c00aafae04d2`
and `281e7adeef69d695d59ec57359b13e2b018f9a611226715d11f8eac6041ad638`;
source-set `4527c5af24b300cab6854287ec9d58bc6444ea9ef1c2b66f22cbb1991dbeb9bc`,
fragment `82ca54ba73b8b1abd4c48ea297c0948931e40ddca9dcb41a5e2051977b090eb2`
and classification `40e3e3d00cecec27eea22c8ae469c3ec4802b44b0bf5c795e1c06f3c418d807b`.
These are fixture-bound activation evidence, never portable caller authority.

## Scope

- One tax-fiscal pure/read-only service and its context export.
- Focused pure tests and bounded real-PostgreSQL lineage/tenant/hostility proof.
- Exact D1005 rate reselection, component order, rational arithmetic, half-up rounding,
  signed-safe sums and recursively frozen result.
- Governance evidence, review record and exact required static/standing/referee gates.

## Excluded

- No migration, table, write, permission, route, UI or local-runtime change.
- No calculation for `manual_valuation_required`.
- No invoice/item grouping, document residual allocation, section170 settlement
  rounding, journal/posting, document/IRP issue, credit note or corrective fiscal flow.
- No caller-supplied slab, rate, component, taxable value, tax amount or evidence hash.

## Proof contract

Before implementation, register an intentional red for the absent service. Permanent
proof must include final values immediately below/at/above every approved threshold;
IGST, CGST+SGST and CGST+UTGST paths; unequal fractional and exact-half component
cases; bigint bounds/overflow rejection; zero/negative/manual rejection; stale,
superseded, duplicate, foreign-tenant/property and incomplete ancestry; deterministic
ordering; immutable results; one bounded read snapshot; and zero writes. A fresh
non-implementing Tier-3 reviewer must personally execute focused proof, standing/static
gates, exact PostgreSQL catalogue and referee 11/11 before approval.
