# Order 365 — Order362 mutation-sensitive proof repair

**Status:** APPROVED-D1044 — fresh independent Tier-3 statutory proof complete
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

## Builder evidence — D1032

Exact test-only candidate `cb22cb5` adds isolated ordinal-only, coherent-total zero
night and post-transaction tenant-context reset proofs. Removing ordinal comparisons,
removing positivity and changing transaction-local `set_config(..., true)` to `false`
each makes its exact permanent case red. Restored fresh PostgreSQL authority passes
**17/0 (612)**; runtime-DML **5/0**; SECURITY-DEFINER **3/0**; canonical acceptance
**23/0**; typecheck and diff hygiene pass. Disposable resources were removed. Fresh
independent Tier-3 review remains mandatory.
