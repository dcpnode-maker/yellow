# Order 413 — India accommodation statutory-envelope eligibility

**Status:** ACTIVE — D1227
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** independently approved Order412 coordination head `0317c5f`
**Risk tier:** 3 — statutory/fiscal composition
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Add one migration-free, read-only Tax-Fiscal boundary that composes the approved
current unreversed Order412 fiscal source with the existing approved India seller,
legal-buyer, place-of-supply, accommodation classification, time-of-supply/supply-
nature and component-family evidence. Return one recursively frozen deterministic
`eligible_irp_invoice_source` envelope whose tenant is hash-bound but hidden.

This is statutory eligibility evidence only. It does not build an IRP payload, issue
or number a document, choose supply type, create items or submit anything.

## Natural-Solution Test

Every required identity already exists: Financials owns the posted fiscal source;
Tax-Fiscal owns supplier, recipient, property, classification, time and statutory
composition; the approved final valuation stores the explicit legal buyer. Compose
those through public surfaces and one exact read of that stored buyer identity. No new
entity, extension, event, state transition, migration or persistence is warranted.

## Exact contract

`IndiaIrpAccommodationSourceService.resolve(tx,input)` accepts an exact frozen input
containing only tenant/property/reservation/folio/journal, recipient Party and GST
registration, accommodation classification identities, plus one complete approved
Order297 supply-nature-at-time result. It must rerun Order412 through the Financials
public index, reread the exact final valuation's persisted `buyer_party_id`, resolve
the approved seller/buyer/Pos/classification paths, build existing `SellerDtls` and
`BuyerDtls`, revalidate the complete Order297 envelope, derive Order308 component
family, and equality-bind every identity, date, jurisdiction, hash, amount and INR
source coordinate. Absence/RLS concealment is not-found; stale, reversed, foreign,
mixed, malformed, duplicated or divergent truth conflicts.

## Exact scope

- new `src/contexts/tax-fiscal/india-irp-accommodation-source.ts` and public export;
- new exact Order413 intentional-red and permanent real-PostgreSQL integration tests;
- directly affected Order412/statutory ancestor tests only for a proved compatibility
  correction;
- `docs/CONTRACTS.md`, Phase7 `BUILD-PLAN.md`, this order/review, `DECISIONS.log` and
  `handoff/LEDGER.md`.

Any other production, migration, schema, permission, seed, server/API/UI, dependency,
runtime or local file requires a recorded scope amendment before edit.

## Required proof

1. Intentional red proves the module and public export are absent before work.
2. Fresh PostgreSQL16 executes all 5/12/18-percent and IGST/CGST+SGST/CGST+UTGST
   sources, multi-night and zero-rounded components through the real Order412 service.
3. Seller/buyer, legal buyer, Pos, SAC/`IsServc`, time/supply nature, component family
   and every predecessor identity/hash are mutation-sensitive.
4. Foreign selectors, stale/reversed fiscal sources and mixed frozen statutory graphs
   fail closed with a complete unchanged census.
5. Repeated reads are byte-equivalent, deeply frozen and write/lock-free.
6. Orders272/275/278/279/281/282/297/308/367/407/408/412, acceptance, exact schema/
   catalogue, referee11/11, standing/static gates stay green.
7. A fresh non-implementing Tier-3 reviewer personally executes complete proof.

## Forbidden

No migration/schema/table/extension/event/fact/outbox/idempotency/write/lock; no
document/series/number/hash-chain/issue/status; no `ItemList`, `DocDtls`, `TranDtls`,
`SupTyp`, `IgstOnIntra`, reverse-charge, SEZ zero-rating or authorized-operations
inference; no description/SlNo/grouping/quantity/UQC/unit-price/residual allocation;
no provider/submission/IRN/QR, API/UI/seed/runtime/local/deploy/merge/push, Phase7 or
application-completion authority.
