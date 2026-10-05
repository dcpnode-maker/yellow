# ORDER 467 — governed synthetic clean-arrival reconciliation

**Phase:** 0 · **Branch:** `phase-0/governed-synthetic-clean-arrival-reconciliation` · **Written by:** Codex · **Date:** 2026-09-20

## Goal

Add one narrowly scoped, auditable command that can reconcile only the fully
synthetic `ARR-CLEAN` demo Party's presentation and approved fixture attributes,
without weakening the review seeder's exact-shape guard or changing any hotel,
guest-role, reservation, occupancy, financial, document, identity, or external
data.

## Natural-solution test

This is not a new Party type or a second CRM store. It uses the existing `party`
primitive, the existing `fact_log` bitemporal spine and existing `outbox`. The sole
new capability is a security-definer correction command for the already proven,
fixed synthetic demo identity.

## Scope — files Codex may create or change

- `migrations/0093_governed_synthetic_clean_arrival_reconciliation.sql`
- `scripts/reconcile-synthetic-clean-arrival.ts`
- `tests/party-profiles.integration.test.ts`
- `docs/CONTRACTS.md`
- `docs/EVENTS.md`
- `handoff/orders/467-governed-synthetic-clean-arrival-reconciliation.md`
- `handoff/reviews/467-governed-synthetic-clean-arrival-reconciliation.md`

## Definition of done

- [x] The command is limited to the deterministic Yellow Demo tenant, demo
  property, canonical clean-arrival Party UUID and `ARR-CLEAN` reservation
  relationship; it verifies active person status and the exact one guest role.
- [x] It accepts expected/current and desired `display_name`, `legal_name` and
  `attrs`, uses compare-and-swap under a row lock, and rejects any attribute shape
  other than the reviewed synthetic `{source: local-review, checkin_example: clean}`
  object. It must not create a generic PII attribute editor.
- [x] It changes only Party `display_name`, `legal_name` and `attrs`; a changed
  operation writes exactly one minimized `party.reconciled` fact and matching
  outbox event in the same transaction. The records contain IDs and changed field
  names only, never raw synthetic or user values. A canonical rerun is a no-op.
- [x] Direct Party update remains denied; the function has the same governed
  runtime role, transaction-local tenant and security-definer checks as Order 466.
- [x] The offline reconciler reads current values through the runtime RLS boundary,
  invokes only the governed function, is idempotent and does not log raw profile
  values or connection strings.
- [x] Isolated proof covers changed/replay/no-op/stale CAS/wrong tenant-property-
  actor/identity/role/reservation relationship, direct update denial, injected
  outbox failure rollback and protected-table content fingerprints before and
  after successful commands and rollback.
- [x] A nonimplementing reviewer executes focused proof, typecheck and the 11/11
  referee against disposable synthetic databases before any live invocation.

## Forbidden

- Generic Party attribute editing, public HTTP/UI exposure, or accepting arbitrary
  JSON attributes.
- Live seed/reset/reseed, direct `party` SQL mutation, `INSERT`/`DELETE`/`TRUNCATE`,
  or changes to reservations, roles, contacts, occupancy, accounts, folios,
  journals, postings, payments, documents, identity documents or users.
- Recording raw Party values, credentials or database URLs in source, tests, logs,
  orders or reviews.
- Treating a source review as approval for live migration or reconciliation.
