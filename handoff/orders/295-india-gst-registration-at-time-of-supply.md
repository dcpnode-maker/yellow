# Order 295 — Compose India GST supplier registration at time of supply

**Branch:** `phase-7/india-gst-registration-at-time-of-supply`
**Base:** `92f2036` (independently approved Order294 descendant)
**Risk tier:** 3 — statutory registration-applicability evidence; fresh independent executable review mandatory
**Owner:** Codex implementation

## Outcome

Build one migration-free, read-only, deterministic composer that proves only that
the approved supplier GST registration snapshot is active on the exact approved
ordinary accommodation time-of-supply date. It consumes complete approved Order289
and Order294 evidence and grants no rate, levy or tax-computation authority.

## Exact contract

- expose `resolveIndiaGstRegistrationAtTimeOfSupply(tx, input)` through the tax-fiscal
  boundary with exact explicit predecessor identities, dates,
  `supplierRegistrationStatusEvidenceHash` and `timeOfSupplyEvidenceHash`;
- one tenant-leading, transaction-local, equality-bound SELECT composes the approved
  Order289 active-status root and Order294 complete time-of-supply chain; no sequential
  resolver calls, latest/nearest selection, clock, network or write;
- require `statusAsOf` to equal `timeOfSupplyDate`; a snapshot at any other date is not
  an effective interval and fails closed;
- revalidate the complete public predecessor envelopes and deterministic hashes rather
  than trusting only the two supplied hashes; both recomputed hashes must equal the
  caller-selected approved hashes;
- return a recursively frozen, fixed-order, tenant-bound result stating only
  `active_at_time_of_supply`, with complete predecessor identity and evidence;
- missing, malformed, duplicate, stale, contradictory, unsupported or cross-lineage
  evidence fails closed.

## Scope

- `src/contexts/tax-fiscal/india-gst-registration-at-time-of-supply.ts`
- `src/contexts/tax-fiscal/index.ts`
- Order295 intentional-red, focused hostile and live integration tests
- bounded Order295 additions to `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`,
  `docs/SECURITY.md`, `BUILD-PLAN.md`, `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`
- Order295 decision, ledger and independent review evidence

## Forbidden boundary

No migration/schema/writer/API/UI/local promotion. No inferred registration validity
interval, historical/nearest/latest status, inactive/suspended/cancelled composition,
rate/slab/exemption/ITC, section14 change-in-rate, levy/decomposition, invoice/document,
journal/posting, IRP/submission, seed-fixture mutation, Phase or application-complete claim.

The stale launch accommodation-rate fixture identified during admission is explicitly
quarantined for a separately verified effective-dated correction order; Order295 may
not consume, repeat or silently correct it.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Focused hostile and fresh live predecessor proof are green.
- [x] Standing/static/setup/referee gates are green.
- [ ] Fresh independent Tier-3 approval is recorded against the exact candidate.
