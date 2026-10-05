# ORDER 470 — live clean-arrival account collision discovery

**Phase:** 0 · **Branch:** `phase-0/live-clean-arrival-account-collision-discovery` · **Written by:** Codex · **Date:** 2026-09-20

## Goal

Read-only, tenant-scoped comparison of the synthetic `ARR-CLEAN` account row that
blocks the reviewed provisioner, establishing whether the collision is limited to a
mutable non-financial account presentation field or touches protected ledger/folio
relationships.

## Scope

- Existing reviewed fixture source as expected-shape oracle.
- One private deploy-role `BEGIN TRANSACTION READ ONLY` query against the current
  synthetic demo target.
- This order and `handoff/reviews/470-live-clean-arrival-account-collision-discovery.md`.

## Required evidence

- Deterministic expected account UUID, current row count, tenant/property/Party
  relationship booleans, and fingerprints of the account shape and its folio/
  journal/posting/payment dependent rows.
- No raw account names, Party values, connection details or PII in records.

## Forbidden

- Any DDL, migration, seed, reset, direct account/folio mutation, journal/posting/
  payment/document change, or invocation of a reconciliation function.
- Concluding a repair is safe; a separate independently reviewed implementation
  order is mandatory even if the mismatch looks presentation-only.
