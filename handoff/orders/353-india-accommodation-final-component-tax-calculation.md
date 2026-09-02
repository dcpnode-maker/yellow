# Order 353 — India accommodation final component-tax calculation

**Status:** DRAFT-D1005 — activation waits approved Order350/354
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-accommodation-final-component-tax-calculation`
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
