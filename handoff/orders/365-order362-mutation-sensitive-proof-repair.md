# Order 365 — Order362 mutation-sensitive proof repair

**Status:** ACTIVE-D1030
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/order362-mutation-sensitive-proof-repair`
**Base:** exact withheld proof `b89d422` + `a90d3a6` / governance `cd392b4`
**Risk tier:** 3 — statutory authority and transaction-local tenancy proof
**Owner:** Codex proof implementation; different fresh non-implementing Tier-3 reviewer

## Outcome and exact scope

Close only the three surviving Order362 mutants in
`tests/india-gst-accommodation-final-component-tax-authority.integration.test.ts`:

1. corrupt ordinal authority alone while preserving each room-night date, value and
   aggregate total so only ordinal validation can reject it;
2. persist one zero-valued room night and adjust the valuation total to the remaining
   positive sum so only the positivity guard can reject it; and
3. prove `set_config(..., true)` transaction locality by checking the reserved
   connection after transaction end, while retaining the colliding same-UUID
   second-tenant RLS case.

Run explicit local mutants removing ordinal comparisons, removing positivity, and
changing `true` to `false`; each must fail its exact permanent case. Then run the full
Order362 authority and repository gate matrix and obtain different fresh Tier-3
approval.

## Forbidden

No product/service/migration/schema/catalogue/write/permission/route/UI/posting/
document/IRP/local/deploy/merge/`.yellow`/port3000 change. Do not combine mutations
so another guard masks the named authority.
