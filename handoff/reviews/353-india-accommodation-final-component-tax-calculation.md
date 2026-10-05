# Order 353 — fresh Tier-3 review

**Verdict:** WITHHOLD  
**Candidate:** `15a1a06` (product), reviewed at governance `1adc277`  
**Reviewer:** `/root/order350_builder` — independent; did not implement Order353

## Blocking finding

`IndiaGstAccommodationFinalComponentTaxService.calculate()` does not read or replay
the persisted Order350 final valuation or its persisted room-night rows. It accepts
`finalValuation`, `roomNights`, `transactionValueMinor`, `generation`,
`evidenceHash`, and the boolean literal `replayed: true` from its caller. The only
database read is delegated to the Order341 quoted-rate applicability resolver. After
that unrelated ancestry replay, the service trusts the caller-supplied final
valuation whenever its caller-supplied room-night values add to the caller-supplied
total.

Consequently a caller can choose any positive room-night taxable values, any
generation, valuation UUID, and any syntactically valid SHA-256 string, set
`replayed: true`, and obtain authoritative-looking component tax and a new evidence
hash without a matching current `india_gst_accommodation_final_valuation` or
`india_gst_accommodation_valuation_room_night` row. A superseded, foreign-property,
foreign-tenant, manual, or nonexistent valuation is not independently rejected by
PostgreSQL. This violates the order's server-authoritative final-valuation,
stale/superseded, tenant and bounded real-PostgreSQL proof contract.

The permanent focused suite confirms only internally consistent caller objects. It
contains no PostgreSQL test and no assertion that the candidate queries either
Order350 persistence table. The preserved intentional-red test is also now a green
export-presence test; its name does not make it a pre-implementation executable red.

## Personally executed evidence

- Focused Order353 plus approved Order310/337/340/341 ancestor suites:
  `30 passed, 0 failed`, `947` assertions.
- Import boundaries: green, `139` TypeScript files.
- The disposable checkout had no installed TypeScript dependency, so `typecheck`
  could not execute (`tsc` absent); license scan observed zero installed packages.
- Direct source inspection proved the Order353 file contains no query or reference
  to `india_gst_accommodation_final_valuation` or
  `india_gst_accommodation_valuation_room_night`; its service performs only the
  Order341 resolver call before calculating from caller values.

The catalogue, schema, seed, referee and remaining standing gates were not promoted
to approval evidence after this authority defect was established. Passing them
cannot make a caller-authored statutory taxable value safe.

## Required repair

In the same tenant transaction, read and uniquely lock or snapshot the exact current
ordinary-final valuation and its complete ordered room-night evidence by
tenant/property/reservation/folio/valuation identity. Derive generation,
disposition, values and evidence hash from those rows; reject superseded/manual,
missing, duplicate, foreign or incomplete evidence. Remove caller authority over
those facts. Add real PostgreSQL hostile tests proving forged, stale, superseded,
cross-tenant/property and incomplete valuation evidence produces zero writes and no
result, then rerun the entire Order353 proof contract under a different fresh Tier-3
reviewer.

