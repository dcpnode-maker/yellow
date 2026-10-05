# ORDER 469 — current-target synthetic fixture provisioning

**Phase:** 0 · **Branch:** `phase-0/current-target-synthetic-fixture-provisioning` · **Written by:** Codex · **Date:** 2026-09-20

## Goal

Run the reviewed synthetic fixture provisioner against the now-reconciled Yellow
Demo database to restore deterministic cashier and in-house workflow coverage, with
preserved before/after content fingerprints and independent current-target proof.

## Scope

- Existing reviewed `scripts/seed-review.ts` only; no source or migration change.
- Private deployment control environment and read-only evidence in
  `handoff/reviews/469-current-target-synthetic-fixture-provisioning.md`.

## Required controls

1. Before any write, capture deterministic, tenant-scoped content fingerprints and
   counts for Party/role/contact, reservation/segment/guest, occupancy, account/
   folio, journal/posting/payment, document/identity, fact/outbox and the exact
   fixture identities. Store hashes/counts only, never values or URLs.
2. Confirm live ledger 93 and the canonical `ARR-CLEAN` Party relationship; abort
   otherwise.
3. Execute `seed-review.ts` once using only its private reviewed environment. Record
   exit status and aggregate created/no-op census without raw data.
4. Rerun it once to prove idempotent no-op. Compare required protected-table
   fingerprints; only the reviewed fixture rows and their explicitly allowed facts/
   outbox rows may differ from preflight.
5. Independently review the current target, including the cashier selected-stay
   browser/API proof required by Order461. No migration, reset, reseed of other
   fixtures, or public assertion of overall readiness is authorized here.

## Forbidden

- Any use of real guests, contact data, OTAs, payments, provider accounts, reset,
  restore, deletion, migration, or direct SQL repair.
- Any changes outside the reviewed synthetic provisioner or its existing fixture
  contract.
