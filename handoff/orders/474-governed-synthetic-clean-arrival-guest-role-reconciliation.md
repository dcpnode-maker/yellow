# ORDER 474 — governed synthetic clean-arrival guest-role reconciliation

**Phase:** 0 · **Branch:** `phase-0/governed-synthetic-clean-arrival-guest-role-reconciliation` · **Written by:** Codex · **Date:** 2026-09-20

## Goal

Create a single-purpose governed correction for the deterministic synthetic
`ARR-CLEAN` Party's guest-role JSON detail so the accepted account correction can
be deployed without direct mutation of a role that has linked account/reservation
records.

## Scope

- `migrations/0095_governed_synthetic_clean_arrival_guest_role_reconciliation.sql`
- `tests/synthetic-guest-role-reconciliation.integration.test.ts`
- `docs/EVENTS.md`
- `docs/CONTRACTS.md`
- `handoff/reviews/474-governed-synthetic-clean-arrival-guest-role-reconciliation.md`
- `handoff/LEDGER.md`

## Constraints

- Hard-bind only the existing Yellow Demo tenant/property/Party/reservation/actor
  and exact guest role. Validate active Party, UTC property, active actor,
  canonical reservation/account/open primary folio and zero posting/payment activity
  under a shared Party → property → actor lock order.
- Compare-and-swap one expected role detail; update only that role detail; emit one
  minimized `party_role.reconciled` fact/outbox pair in the same transaction;
  canonical replay is a no-op.
- No generic role editor, Party/account/folio/reservation update, balance change,
  seed run, live deployment or account correction in this order.
- Prove direct mutation denial, raw tenant/role rejection, target/state hostility,
  CAS/no-op, outbox rollback, protected hashes and real race/revalidation on a
  fresh disposable database. Independent review is mandatory before any live order.
