# Order 415 — India IRP ordinary registered B2B supply type

**Status:** CHANGES REQUIRED — D1238
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** independently approved Order414 coordination head `1ee5b5f`
**Risk tier:** 3 — statutory fiscal-payload field
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Add one migration-free pure Tax-Fiscal composer that admits only the exact approved
Order413 statutory envelope after approved Order414 validation and returns the single
ordinary registered Indian IRP supply-type decision `B2B`. This is a narrow statutory
field prerequisite, not an invoice, item list or submission payload.

## Natural-Solution Test

Order413 already contains the explicit persisted legal buyer, registered recipient,
SellerDtls, BuyerDtls, domestic accommodation classification/place of supply and the
approved Order297 supply nature at time of supply. Order414 is now the approved pure
exact validator of that complete frozen source. Reuse it rather than duplicate its
large validation contract or add SQL, persistence, configuration or caller policy.
Ordinary registered non-SEZ intra- and inter-State accommodation supplies both map to
notified IRP `SupTyp` value `B2B`; SEZ, export, deemed-export and unregistered cases
remain fail-closed and separate.

## Exact contract

`composeIndiaIrpOrdinaryRegisteredB2bSupplyType(input)` accepts only a canonical
tenant UUID and exact frozen `IndiaIrpAccommodationSourceResult`. It first executes
the approved Order414 composer over that exact source, then requires:

- the exact registered legal buyer/recipient and BuyerDtls lineage already bound by
  Order413;
- domestic accommodation service truth and INR source;
- `determinationBasis: ordinary_registered_state_comparison` and
  `sezDirection: none`;
- either `intra_state` with `IGST_ACT_8_2` and the matching ordinary intra-State
  component family, or `inter_state` with `IGST_ACT_7_3` and `igst`.

It returns a recursively frozen fixed-shape result containing only state
`eligible_irp_ordinary_registered_b2b_supply_type`, `supplyTypeCode: B2B`, exact
Order413 source evidence lineage and a deterministic tenant-bound evidence hash. The
tenant is not returned. Approved D1234 lineage hashes prove deterministic integrity,
not secret-key authenticity.

## Exact scope

- new `src/contexts/tax-fiscal/india-irp-ordinary-registered-b2b-supply-type.ts` and
  public context export only;
- new exact intentional-red and permanent pure hostile/mutation tests;
- `docs/CONTRACTS.md`, Phase7 `BUILD-PLAN.md`, this order/review, `DECISIONS.log` and
  `handoff/LEDGER.md`.

Any other path requires a recorded scope amendment before edit.

## Required proof

1. Genuine intentional red proves the exact module/export absent.
2. Golden ordinary registered intra-State CGST+SGST, intra-State CGST+UTGST and
   inter-State IGST sources return only exact `B2B` truth.
3. Exact approved Order414 validation is mutation-sensitive and invoked; mixed,
   malformed, mutable, proxy, accessor, symbol, sparse, cyclic, surplus, stale or
   correctly rehashed hostile Order413 graphs fail closed.
4. SEZ directions/bases/rules, export/deemed-export/unregistered-like truth,
   wrong legal rule/nature/component family/currency/classification/party lineage and
   embedded caller `SupTyp` authority fail closed.
5. Input remains byte-unchanged; replay is byte-equivalent; output is deeply frozen;
   tenant influences only the evidence hash and is recursively absent from output.
6. Orders413/414, relevant statutory predecessors, acceptance, exact catalogue and
   schema, referee11/11, standing and static gates remain green.
7. A fresh non-implementing Tier-3 reviewer personally executes complete proof.

## Forbidden

No migration/schema/table/RLS/permission/SQL/transaction/read/write/lock/entity/event/
fact/outbox/idempotency; no SEZWP/SEZWOP, EXPWP/EXPWOP, DEXP, B2C/URP selection or
fallback; no zero-rating, authorized-operations, payer/payment/refund, reverse-charge,
`RegRev`, `IgstOnIntra`, `EcmGstin`, `TranDtls`, `TaxSch`, `DocDtls`, `ItemList`,
item/value/tax recalculation, document/series/number/hash-chain/issue, provider/
submission/IRN/QR, API/UI/seed/runtime/local/deploy/merge/push, Phase7 or application-
completion authority.
