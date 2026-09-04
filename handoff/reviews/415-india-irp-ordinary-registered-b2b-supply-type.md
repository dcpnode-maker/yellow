# Order 415 — Fresh independent Tier-3 review

**Verdict:** CHANGES REQUIRED — D1238

**Reviewed candidate:** `e65df58`

**Approved base:** `1ee5b5f`

**Reviewer:** `/root/order415_fresh_tier3`, fresh independent non-implementing Tier-3 reviewer

## Finding

Approval is withheld. `validateOrdinaryRegisteredB2b()` does not fail closed when
`supplyNatureAtTimeOfSupply.supplyNature` is outside the TypeScript union. Its switch
has only `intra_state` and `inter_state` cases and no rejecting terminal branch, so an
unsupported runtime value falls through and the caller receives `B2B`.

A reviewer-personal executable probe started from the exact frozen ordinary
`cgst_sgst` golden source, changed both the at-time and component-family
`supplyNature` to `export`, correctly recomputed both nested tenant-bound evidence
hashes and the outer Order413 evidence hash, and passed the result through the public
Order415 composer. Approved Order414 validation accepted the internally coherent
source, and Order415 incorrectly returned
`eligible_irp_ordinary_registered_b2b_supply_type` with `supplyTypeCode: B2B`.

This violates the exact Order415 contract and D1236 requirement to admit only
`intra_state`/`IGST_ACT_8_2` or `inter_state`/`IGST_ACT_7_3`, and to fail closed for
export/deemed-export/other runtime truth. TypeScript exhaustiveness is not a runtime
boundary.

## Reviewer-personal proof completed before withholding approval

- approved-base module and export absence: confirmed;
- permanent focused suite: **18 passed, 0 failed (244 assertions)**;
- reviewer-only correctly-rehashed unsupported-nature probe: **18 passed, 1 failed
  (245 assertions)** because the public composer returned `B2B` instead of throwing;
- strict TypeScript check and exact candidate diff check: green;
- candidate scope is migration-free and introduces no SQL, schema, runtime or local
  mutation.

The temporary reviewer probe was removed after execution. Full standing and isolated
PostgreSQL preservation gates were not repeated after the decisive statutory
fail-open finding because this exact candidate cannot be approved; the repaired
candidate and permanent regression must receive complete fresh Tier-3 proof.

## Required repair

Reject every runtime `supplyNature` other than exact `intra_state` or `inter_state`
before producing output (an exhaustive rejecting branch is sufficient), and add the
correctly-rehashed unsupported-value case as permanent regression evidence. Re-run
all focused, standing, static and applicable isolated PostgreSQL preservation gates,
then obtain review from a different fresh non-implementing Tier-3 reviewer.

No production/test/database/runtime/local/`.yellow` state was retained or changed by
this review. No downstream statutory, document, provider, API/UI, deployment, Phase7
or application-completion authority follows.
