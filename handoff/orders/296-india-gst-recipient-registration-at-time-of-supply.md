# Order 296 — Compose India GST recipient registration at time of supply

**Branch:** `phase-7/india-gst-recipient-registration-at-time-of-supply`
**Base:** `912cc1f` (independently approved Order295 governance descendant)
**Risk tier:** 3 — statutory recipient-registration applicability evidence; fresh independent executable review mandatory
**Owner:** Codex implementation

## Outcome

Build one migration-free, read-only, deterministic composer that proves only that
the approved recipient GST registration/SEZ-status snapshot is active on the exact
approved ordinary accommodation time-of-supply date. It consumes complete approved
Order285 and Order294 evidence and grants no buyer-designation, supply-nature, place
of supply, rate, levy, tax-computation or invoice authority.

## Exact contract

- expose `resolveIndiaGstRecipientRegistrationAtTimeOfSupply(tx, input)` through the
  tax-fiscal boundary with explicit recipient party/registration/status identities,
  service/payment/invoice predecessor identities and caller-selected complete
  Order285 and Order294 evidence hashes;
- one tenant-leading, transaction-local, equality-bound SELECT composes the approved
  Order285 recipient status root and Order294 complete time-of-supply chain; no
  sequential resolver calls, latest/nearest selection, clock, network or write;
- require the exact Order285 `statusAsOf` to equal Order294 `timeOfSupplyDate`; a
  snapshot at another date is not an effective interval and fails closed;
- revalidate complete public Order285 and Order294 predecessor envelopes and hashes,
  including recipient registration evidence, taxpayer type and conditional SEZ
  approval shape, rather than trusting reduced caller claims;
- return a recursively frozen, fixed-order, tenant-bound result stating only
  `active_recipient_registration_at_time_of_supply`, complete predecessor identity
  and evidence; tenant identity and recipient GSTIN/address remain hidden;
- missing, malformed, duplicate, stale, contradictory, unsupported or cross-lineage
  evidence fails closed.

## Scope

- `src/contexts/tax-fiscal/india-gst-recipient-registration-at-time-of-supply.ts`
- `src/contexts/tax-fiscal/index.ts`
- Order296 intentional-red, focused hostile and live PostgreSQL integration tests
- bounded Order296 additions to `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`,
  `docs/SECURITY.md`, `BUILD-PLAN.md`, `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`
- Order296 decision, ledger and independent review evidence

## Forbidden boundary

No migration/schema/writer/API/UI/local promotion. No inferred registration validity
interval, historical/nearest/latest status, live portal lookup, recipient legal-buyer
designation, B2B/B2C/URP/export/deemed-export, `BuyerDtls`, `Pos`, `SupTyp`,
`IgstOnIntra`, CGST/SGST/IGST decomposition, rate/slab/exemption/ITC, section14,
invoice/item/value/document/numbering, journal/posting, IRP/submission, seed-fixture
mutation, Phase or application-complete claim.

The stale launch accommodation-rate fixture remains quarantined and is outside this
order. No current-rate or historical rate evidence may be consumed.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Focused hostile and fresh live predecessor proof are green.
- [ ] Standing/static/setup/referee gates are green.
- [ ] Fresh independent Tier-3 approval is recorded against the exact candidate.
