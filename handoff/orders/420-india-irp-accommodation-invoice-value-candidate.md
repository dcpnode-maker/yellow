# Order 420 — India IRP accommodation invoice-value candidate

**Status:** INDEPENDENTLY APPROVED — CLOSED — D1259
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** independently approved Order419 coordination head `1ebb3f5`
**Risk tier:** 3 — statutory fiscal-payload fields
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Add one migration-free pure Tax-Fiscal composer that consumes the exact approved
Order419 room-night item candidates and derives only the applicable IRP `ValDtls`
invoice-value candidate. This remains intermediate evidence: it is not an invoice,
document number, complete payload, provider call or submission.

## Natural-Solution Test

Order419 already supplies one exact persisted room-night item per dense ordinal with
canonical two-decimal assessable, component-tax and item-total values. Exact integer
minor-unit aggregation of those approved fields is the sole authority required for
`AssVal`, the applicable `IgstVal` or `CgstVal` plus `SgstVal`, and `TotInvVal`.
Optional discount, cess, state cess, other-charge and round-off values are not
invented when the admitted source has none.

## Exact contract

`composeIndiaIrpAccommodationInvoiceValueCandidate(input)` accepts only the exact
deeply frozen canonical tenant UUID and Order419 source input. It must invoke the
approved Order419 composer and derive:

- `AssVal` as the exact sum of item `AssAmt` values;
- either `IgstVal`, or `CgstVal` plus `SgstVal`, as exact sums of the applicable item
  component fields, with Order419's UTGST already occupying `SgstAmt`;
- `TotInvVal` as the exact sum of item `TotItemVal` values;
- canonical two-decimal non-negative INR strings using integer arithmetic only;
- fixed-shape provider-neutral lineage containing the approved item-candidate
  evidence hash, item count and component family, plus a tenant-bound deterministic
  evidence hash.

It must reject mixed component families, non-dense/empty items, noncanonical money,
overflow, inconsistent `AssVal + applicable tax != TotInvVal`, and every malformed,
mutable, proxy, accessor, symbol, sparse, cyclic, surplus, stale, foreign or correctly
rehashed unsupported source already rejected by Order419. The result is deeply frozen
and tenant-hidden.

## Exact scope

- new `src/contexts/tax-fiscal/india-irp-accommodation-invoice-value-candidate.ts`;
- `src/contexts/tax-fiscal/index.ts` public export;
- new exact intentional-red and permanent pure hostile/mutation tests;
- `docs/CONTRACTS.md`, Phase 7 `BUILD-PLAN.md`, this order/review,
  `DECISIONS.log` and `handoff/LEDGER.md`.

Any other path requires a recorded scope amendment before edit.

## Required proof

1. Genuine intentional red proves the exact module/export absent.
2. Exact 5/12/18-percent IGST, CGST+SGST and CGST+UTGST fixtures prove applicable
   field families and two-decimal totals; forbidden optional fields are absent.
3. One, multiple and 366 nights prove deterministic exact aggregation, explicit zero
   component totals, fixed lineage and no float/rounding drift.
4. Order419 validation is demonstrably load-bearing: removing its call makes a
   permanent coherently rehashed unsupported-supply test red.
5. Input remains byte-unchanged; replay is byte-equivalent; output is deeply frozen;
   tenant affects only the evidence-hash preimage and is absent from output.
6. Orders414–419, schema/catalogue/referee, standing and static gates remain green;
   a fresh non-implementing Tier-3 reviewer personally executes complete proof.

## Forbidden

No migration/schema/table/RLS/permission/SQL/transaction/read/write/lock/entity/event/
fact/outbox/idempotency; no tax/rate/value recalculation or rerounding, cross-currency,
discount, cess, other-charge or round-off inference; no Qty/UQC decision; no seller,
buyer, transaction or document sections; no document/series/number/hash-chain/issue,
provider/submission/IRN/QR, API/UI/seed/runtime/local/deploy/merge/push, Phase7 or
application-completion authority.
