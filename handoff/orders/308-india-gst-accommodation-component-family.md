# Order 308 — India GST accommodation component-family evidence

**Status:** APPROVED-D851
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-gst-accommodation-component-family`
**Base:** `0659658` (independently approved Order307 governance head)
**Risk tier:** 3 — statutory levy-component classification; fresh independent
executable review mandatory

## Outcome

Derive only the lawful GST component family for one complete approved India
accommodation supply-nature result: inter-State/SEZ supply yields IGST; ordinary
intra-State supply yields CGST plus SGST except where the place-of-supply code belongs
to the exact current UTGST Act territory set, which yields CGST plus UTGST.

## Exact contract

- Accept exactly `{tenantId,supplyNature}` where `supplyNature` is one complete
  `IndiaGstAccommodationSupplyNatureResult`; recompute its tenant-bound candidate hash.
- Revalidate exact property/reservation/folio/date/jurisdiction identity, supplier and
  place-of-supply state codes, supply nature, determination basis, SEZ direction and
  legal rule. The component family is derived, never caller selected.
- Use the current consolidated UTGST Act territory set only: GST codes `04`, `26`,
  `31`, `35`, and `38`. Delhi `07`, Puducherry `34`, and Jammu and Kashmir `01`
  remain on the State-tax side despite Union-territory constitutional status.
- Return recursively frozen, tenant-hidden lineage with one exact component family:
  `igst`, `cgst_sgst`, or `cgst_utgst`, its statutory source identifiers, predecessor
  candidate hash, and deterministic evidence hash.

## Scope

- this order, `DECISIONS.log`, `handoff/LEDGER.md`, bounded Phase-7 plan/roadmap;
- one pure tax-fiscal module and context exports;
- intentional-red and permanent hostile/mutation-sensitive unit proof;
- bounded contract/domain/security/QA documentation;
- fresh non-implementing Tier-3 review evidence.

## Forbidden boundary

No SQL/database/migration/schema/RLS/grant/seed/writer; no rate, taxable value,
component amount, split arithmetic, rounding/residual, account route, posting,
correction, zero-rating, authorized-operations, reverse-charge or payer conclusion;
no `SupTyp`, `IgstOnIntra`, `ItemList`, document, IRP submission, API/UI/local,
merge/deploy or Phase/application-complete claim. Order302–307 section14/calendar
work is neither consumed nor altered.

## Pre-registered proof

- **P0 red:** the component-family builder/export is absent.
- **P1 derivation:** inter-State and every SEZ direction yield IGST; ordinary
  intra-State yields CGST+SGST for State-tax codes and CGST+UTGST for all five and
  only the exact UTGST codes.
- **P2 hostility:** complete tenant-bound candidate hash, ids, state codes, supply
  nature/basis/direction/legal rule, symbols/proxies/accessors and surplus caller
  component/rate/amount fields fail closed.
- **P3 evidence:** output is recursively frozen, byte-stable, tenant-hidden and
  hash-bound to every legally relevant accepted field and both official sources.
- **P4 preservation:** source contains no SQL/write or downstream amount/document
  authority; standing/static and unchanged schema/referee evidence stay green.

## Definition of done

- [x] Intentional red precedes production.
- [x] Focused mutation-sensitive proof is green.
- [x] Standing/static/setup/schema/referee preservation gates are green.
- [x] Fresh non-implementing Tier-3 reviewer personally executes proof and approves.
