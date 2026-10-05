# ORDER 464 — live-demo-clean-arrival-party-reconciliation

**Phase:** 0 · **Branch:** `phase-0/live-demo-clean-arrival-party-reconciliation` · **Written by:** Codex · **Date:** 2026-09-20

## Goal
Define and independently prove the governed correction required to restore the one drifted, fully synthetic `ARR-CLEAN` Party presentation record without altering any reservation, financial, occupancy, identity-document, or external data.

## Why now
Order 463 proved the current live synthetic demo Party is the sole blocker before the reviewed fixture provisioner can establish the cashier demo. This restores deterministic demo data while preserving existing operational relationships.

## Scope — files Codex may create or change
- `handoff/orders/464-live-demo-clean-arrival-party-reconciliation.md`
- `handoff/reviews/464-live-demo-clean-arrival-party-reconciliation.md`
- A subsequent implementation order, if and only if it names an existing approved
  Party correction contract that emits the correct same-transaction audit/outbox
  effect. Direct live database mutation is not authorized by this order.

## Contracts to honour (read before any write)
- `PROJECT.md` invariants 1, 3, 5, 7, 8 and 9
- `handoff/orders/461-unified-cashier-billing-desk.md`
- `handoff/orders/463-live-demo-fixture-collision-discovery.md`
- `handoff/reviews/463-live-demo-fixture-collision-discovery.md`
- `docs/CONTRACTS.md` party and reservation boundaries

## Definition of done
- [ ] The required Party correction contract is identified. It must publish the
  correct same-transaction audit/outbox effect; it must not fabricate a
  `party.created` event.
- [ ] Candidate source and exact SQL/API request fingerprints are frozen without
  disclosing secrets or raw Party values.
- [ ] An isolated synthetic database proves the candidate once and on replay,
  including wrong tenant/UUID, missing or mismatched relationship, stale prior
  values, and injected-failure cases. Each rejected case leaves zero delta.
- [ ] The candidate uses transaction-local tenant scope, locks and asserts exactly
  one deterministic Party with expected tenant/kind/lifecycle, one canonical guest
  role, and one canonical `ARR-CLEAN` reservation/property reference. It performs
  a compare-and-swap against the observed drift and can change only the approved
  presentation/attribute fields. An already canonical Party is a verified no-op.
- [ ] Deterministic protected-table content fingerprints (not counts alone) prove
  that reservation, segment, guest, Party-role, contact, account, folio,
  occupancy, journal, posting, payment, document, identity, user, fact, and every
  unrelated Party record are unchanged. Any explicitly approved audit/outbox row
  has its own exact assertion.
- [ ] An independent reviewer who did not implement the candidate personally
  executes current-target pre/post proof and records it. This order alone does not
  authorize running the review provisioner or claiming Order 461 acceptance.

## Forbidden in this order
- Any reset, reseed, review-provisioner run, migration, DDL, `INSERT`, `DELETE`, or `TRUNCATE`.
- Direct SQL mutation of `party`, or any mutation to occupancy, reservation,
  guest-role, account, folio, journal, posting, document, payment,
  identity-document, outbox, fact-log, or user data.
- Any raw-name/contact/credential disclosure in logs or handoff records.
- Updating by display name, confirmation number, or an unscoped query; the fixed UUID plus tenant are mandatory.
- Claiming public-demo readiness until the independent proof is complete.

## Open questions already answered
> Q: Is rerunning the reviewed seed sufficient to resolve the collision?
> A: No. Order 463 proved its Party exact-shape guard will fail deterministically before it can proceed.

> Q: Can a one-off SQL Party update be used because the record is synthetic?
> A: No. The Party is cross-module-visible; its correction requires the approved
> same-transaction audit/outbox contract and independent proof.
