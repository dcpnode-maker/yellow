# Order 297 — Bind India GST accommodation supply nature at time of supply

**Branch:** `phase-7/india-gst-accommodation-supply-nature-at-time-of-supply`
**Base:** `a9cb63e` (independently approved Order296 governance descendant)
**Risk tier:** 3 — statutory supply-nature applicability composition; fresh independent executable review mandatory
**Owner:** Codex implementation

## Outcome

Build one pure, migration-free, deterministic composer proving only that complete
approved Order287 supply-nature and Order295/296 supplier/recipient active-registration
results describe the same transaction on the exact approved time-of-supply date.

## Exact contract

- accept only exact frozen `tenantId`, complete Order287, Order295 and Order296 roots;
- independently validate and recompute all three complete envelopes and tenant hashes;
- equality-bind property, reservation, registration and service-location evidence,
  all shared time-of-supply identities, dates, lineage and hashes;
- require Order287 `supplyDate`, both status dates and both time-of-supply dates equal;
- return fixed-order recursively frozen, tenant-hidden minimized
  `supply_nature_and_registrations_bound_at_time_of_supply` evidence;
- malformed, mutable, proxy/accessor/symbol/surplus, stale, contradictory, reduced,
  cross-tenant or cross-lineage evidence fails closed.

## Scope

- `src/contexts/tax-fiscal/india-gst-accommodation-supply-nature-at-time-of-supply.ts`
- `src/contexts/tax-fiscal/index.ts`
- Order297 intentional-red and focused hostile tests
- bounded Order297 additions to `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`,
  `docs/SECURITY.md`, `BUILD-PLAN.md`, `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`
- Order297 decision, ledger and independent review evidence

## Forbidden boundary

No migration/schema/database/network/clock/writer/API/UI/local promotion. No legal-
buyer/B2B designation, new place/supply-nature decision, `BuyerDtls`, `Pos`, `SupTyp`,
`IgstOnIntra`, rate/slab/exemption/ITC, levy/tax calculation, amount, document/
numbering, journal/posting, IRP/submission, seed, Phase/application-complete claim.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Complete predecessor replay and exhaustive hostile proof are green.
- [x] Standing/static/setup/referee preservation gates are green.
- [x] Fresh independent Tier-3 approval is recorded against the exact candidate.
