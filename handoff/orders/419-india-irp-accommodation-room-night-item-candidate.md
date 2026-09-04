# Order 419 — India IRP accommodation room-night item candidate

**Status:** REPAIRED — AWAITING DIFFERENT FRESH INDEPENDENT TIER-3 REREVIEW — D1252
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** independently approved Order415 coordination head `d42b0fc`
**Risk tier:** 3 — statutory fiscal-payload fields
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Add one migration-free pure Tax-Fiscal composer that converts the exact approved
Order414 numeric room-night sources, after exact Order415 ordinary registered B2B
admission, into recursively frozen IRP item candidates. It emits one candidate per
existing dense room-night and only the mandatory notified item fields plus the
applicable persisted tax-component amounts. It is not a document, invoice number,
submission payload or provider call.

## Natural-Solution Test

Order414 already preserves the final persisted per-room-night taxable value, aggregate
rate, component amounts and statutory SAC/service classification. Order415 already
admits the exact ordinary registered non-SEZ B2B branch. Preserving one candidate per
existing room-night avoids a new aggregation, averaging, residual or allocation
authority and retains direct audit lineage. The notified IRP schema requires
`SlNo`, `IsServc`, `HsnCd`, `UnitPrice`, `TotAmt`, `AssAmt`, `GstRt` and
`TotItemVal`; it does not require quantity, unit, description, discount or
`PreTaxVal`. The IRP web-form guidance identifies the SGST field as the SGST/UTGST
slot. Therefore no presentation text, service UQC or discount decomposition is
invented.

## Exact contract

`composeIndiaIrpAccommodationRoomNightItemCandidates(input)` accepts only a canonical
tenant UUID and exact frozen `IndiaIrpAccommodationSourceResult`. It must invoke the
approved Order414 and Order415 composers over the same source before deriving:

- one item per existing ordered room-night, with `SlNo` equal to its one-based dense
  ordinal string;
- `IsServc: "Y"` and exact approved six-digit accommodation SAC as `HsnCd`;
- `UnitPrice`, `TotAmt` and `AssAmt` as the exact room-night final transaction-value
  minor units serialized to two-decimal INR without floating point;
- `GstRt` as the exact aggregate basis-point rate serialized to two decimal places;
- `IgstAmt`, or `CgstAmt` plus `SgstAmt`, from the exact persisted component family;
  the approved `utgst` component maps to the notified SGST/UTGST `SgstAmt` slot;
- `TotItemVal` as the exact persisted transaction value plus exact persisted tax,
  serialized without recalculation or rerounding;
- exact business-date, source and component lineage only in provider-neutral
  metadata outside the IRP field object, plus a tenant-bound deterministic hash.

The result is deeply frozen, tenant-hidden and fixed-shape. INR conversion accepts
only canonical non-negative signed-int64 minor-unit strings and emits canonical
decimal strings with exactly two fractional digits. Rates accept only the existing
safe non-negative basis-point integer and emit exactly two fractional digits.

## Exact scope

- new `src/contexts/tax-fiscal/india-irp-accommodation-room-night-item-candidate.ts`;
- `src/contexts/tax-fiscal/index.ts` public export;
- new exact intentional-red and permanent pure hostile/mutation tests;
- `docs/CONTRACTS.md`, Phase 7 `BUILD-PLAN.md`, this order/review,
  `DECISIONS.log` and `handoff/LEDGER.md`.

Any other path requires a recorded scope amendment before edit.

## Required proof

1. Genuine intentional red proves the exact module/export absent.
2. Golden 5/12/18-percent IGST, CGST+SGST and CGST+UTGST cases prove exact required
   fields, two-decimal serialization, correct component slots and exact item totals.
3. One, multiple and 366 nights prove dense deterministic serials and no aggregation;
   zero-rounded components remain explicit exact zero amounts.
4. Order414 and Order415 validation is demonstrably invoked; every malformed,
   mutable, proxy, accessor, symbol, sparse, cyclic, surplus, stale, foreign, mixed,
   correctly rehashed or unsupported supply graph fails closed.
5. No caller item/serial/description/quantity/unit/value/rate/tax/SupTyp authority is
   accepted. Overflow, negative, noncanonical money/rate, wrong family, missing,
   duplicated or reordered components fail closed.
6. Input remains byte-unchanged; replay is byte-equivalent; output is deeply frozen;
   tenant affects only the evidence-hash preimage and is absent from output.
7. Orders413–415, acceptance, exact catalogue/schema, referee11/11, standing and
   static gates remain green; a fresh non-implementing Tier-3 reviewer personally
   executes the complete proof.

## Forbidden

No migration/schema/table/RLS/permission/SQL/transaction/read/write/lock/entity/event/
fact/outbox/idempotency; no tax/rate/value recalculation, rerounding, cross-night
grouping, discount, residual, whole-rupee rounding, quantity/UQC/unit/description,
cess or other-charge inference; no SEZ/export/deemed-export/B2C/URP/reverse-charge,
`TranDtls`, `DocDtls`, document/series/number/hash-chain/issue, provider/submission/
IRN/QR, API/UI/seed/runtime/local/deploy/merge/push, Phase7 or application-completion
authority.
