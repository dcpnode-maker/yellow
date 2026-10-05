# ORDER 471 — governed synthetic clean-arrival account reconciliation

**Phase:** 0 · **Branch:** `phase-0/governed-synthetic-clean-arrival-account-reconciliation` · **Written by:** Codex · **Date:** 2026-09-20

## Goal

Add a security-definer, offline-only correction command for the deterministic
synthetic `ARR-CLEAN` guest account display name that blocks fixture provisioning.

## Constraints

## Scope

- `migrations/0094_governed_synthetic_clean_arrival_account_reconciliation.sql`
- `tests/synthetic-account-reconciliation.integration.test.ts`
- `docs/EVENTS.md`
- `docs/CONTRACTS.md`
- `handoff/reviews/471-governed-synthetic-clean-arrival-account-reconciliation.md`
- `handoff/LEDGER.md`

- It must hard-bind the Yellow Demo tenant/property, canonical Party, reservation,
  account and primary folio UUIDs; lock/revalidate all relationships and require no
  postings or payments before mutation.
- Compare-and-swap only expected account name; update only `account.name`; emit one
  minimized `account.reconciled` fact/outbox pair in the same transaction. A
  canonical replay is a no-op.
- No generic account editor, direct `UPDATE`, account balance change, folio change,
  journal/posting/payment/document/identity mutation, seed execution or live use in
  this order.
- Isolated proof must include race, target/tenant/role/folio mismatch, direct update
  denial, after-outbox rollback and protected-table fingerprints. Independent
  reviewer must run focused proof and 11/11 referee before deployment.
