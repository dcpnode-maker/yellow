# Order 425 — India IRP accommodation service quantity/UQC compatibility candidate

**Status:** ACTIVE — D1275
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** independently approved Order424 coordination head `d5b2aa5`
**Risk tier:** 3 — statutory fiscal-payload fields
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Add one migration-free pure Tax-Fiscal composer that enriches exact approved Order419
one-item-per-room-night service candidates with `Qty:"1.000"` and `Unit:"OTH"` solely
as current IRP validation-compatibility evidence. It is not provider-certified or
submission-ready until authenticated sandbox proof.

## Natural-Solution Test

Current official layers conflict: the notified schema and IRIS web-form describe
quantity/unit as optional for services, while the current IRIS validation catalogue
unconditionally lists missing-quantity/UQC errors 2238/2239. Order419 already defines
each line as exactly one room-night and `UnitPrice === TotAmt`, making one the only
positive quantity that preserves that exact arithmetic without recalculation. GSTN
guidance permits `OTH` for services and IRIS states its UQC master mirrors GSTN. These
are compatibility constants, not configurable commercial quantity or a claim of
provider acceptance.

## Exact contract

`composeIndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate(input)` accepts
only the approved Order419 exact deeply frozen input, invokes Order419, and emits one
item per unchanged candidate with exact schema order: `SlNo`, `IsServc`, `HsnCd`,
`Qty`, `Unit`, `UnitPrice`, `TotAmt`, `AssAmt`, `GstRt`, applicable component fields,
`TotItemVal`. `Qty` is exactly `1.000`; `Unit` exactly `OTH`.

The fixed result must retain item count/order, Order419 source/evidence backlinks,
component family and B2B/INR truth; use deterministic fixed-order JSON, tenant-bound
hashing, recursive freeze and tenant concealment. It must reject any condition where
the inherited `UnitPrice` and `TotAmt` differ, plus every hostile input Order419
rejects. No child amount is recalculated.

## Exact scope

- new `src/contexts/tax-fiscal/india-irp-accommodation-service-quantity-uqc-compatibility-candidate.ts`;
- `src/contexts/tax-fiscal/index.ts` public export;
- new exact intentional-red and permanent pure hostile/mutation tests;
- `docs/CONTRACTS.md`, Phase 7 `BUILD-PLAN.md`, this order/review,
  `DECISIONS.log` and `handoff/LEDGER.md`.

Any other path requires a recorded scope amendment before edit.

## Required proof

1. Genuine intentional red proves the exact module/export absent.
2. One, multiple and 366 room nights across every approved component family produce
   exact `Qty:1.000`, `Unit:OTH`, unchanged count/order and byte-exact child values.
3. Structural field-order/absence proof shows no other optional item field is added;
   callers cannot supply quantity/UQC.
4. Order419 remains demonstrably load-bearing under its coherent unsupported-supply
   mutation; inherited lineage/hash/count/family/currency/B2B mismatches reject.
5. Input remains unchanged; replay is byte-equivalent; output is deeply frozen and
   tenant-hidden; removal of compatibility fields turns permanent 2238/2239 coverage
   red.
6. Orders413–424, standing/static/schema/referee gates remain green; a fresh
   non-implementing Tier-3 reviewer personally executes complete proof.

## Forbidden

No migration/schema/table/RLS/permission/SQL/transaction/read/write/lock/entity/event/
fact/outbox/idempotency; no quantity aggregation or derivation from stays/rooms/guest
counts; no UQC alternative/configuration or claim that `OTH` is provider-certified;
no amount/rate/tax recalculation/rerounding; no complete/submission-ready payload,
DocDtls, document/series/number/hash-chain/issue, provider/submission/IRN/QR, API/UI/
seed/runtime/local/deploy/merge/push, Phase7 or application-completion authority.
