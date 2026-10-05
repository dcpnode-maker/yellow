# ORDER 473 — live clean-arrival guest-role collision discovery

**Phase:** 0 · **Branch:** `phase-0/live-clean-arrival-guest-role-collision-discovery` · **Written by:** Codex · **Date:** 2026-09-20

## Goal

Read-only discovery of the unexpected `ARR-CLEAN` guest-role detail mismatch that
stopped Order472 before migration or live account correction.

## Scope

- `handoff/orders/473-live-clean-arrival-guest-role-collision-discovery.md`
- `handoff/reviews/473-live-clean-arrival-guest-role-collision-discovery.md`
- `handoff/LEDGER.md`

## Constraints

- Read only. Do not apply migrations, seed data, update role/Party/account/folio,
  invoke any correction, expose raw details, or inspect unrelated guest data.
- Establish whether exactly one target guest role exists; compare its metadata and
  a deterministic detail fingerprint against the reviewed canonical synthetic
  expectation; enumerate only dependent relationship counts needed to design a
  possible governed correction.
- Any repair is outside this order and needs a new target-bound source order,
  isolated proof and independent review.
