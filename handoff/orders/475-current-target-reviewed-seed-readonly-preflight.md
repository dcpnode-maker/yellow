# ORDER 475 — current-target reviewed-seed read-only preflight

**Phase:** 0 · **Branch:** `phase-0/current-target-reviewed-seed-readonly-preflight` · **Written by:** Codex · **Date:** 2026-09-20

## Goal

Establish, using read-only target-bound evidence, whether the already reconciled
synthetic clean-arrival prerequisites and the incoherent `PARKING-REVIEW` stay
match the reviewed seed's required shape before anyone considers rerunning the
idempotent reviewed provisioner.

## Scope

- `handoff/orders/475-current-target-reviewed-seed-readonly-preflight.md`
- `handoff/reviews/475-current-target-reviewed-seed-readonly-preflight.md`
- `handoff/LEDGER.md`

## Constraints

- Use only a transaction declared READ ONLY and transaction-local tenant context.
- Compare fixed reviewed identities and expected shapes in-process; record only
  booleans, relationship counts and non-sensitive hashes. Do not emit credentials,
  connection strings, raw guest/contact values, or arbitrary tenant records.
- Inspect only the clean-arrival Party/account/guest-role prerequisites and the
  fixed PARKING reservation, primary guest, segment occupancy, account, open
  primary folio and zero financial-row conditions.
- Do not invoke the seed, migration, reconciliation function, login, state command,
  direct DML, reset, restart or provider request.
- A failed/mismatched comparison is a stop result, not an invitation to broaden
  inspection or repair within this order.

## Acceptance

The review records a target identity check, the fixed prerequisite and PARKING
comparison results, transaction-read-only/RLS evidence, and an explicit conclusion:
either a separate deployment order is needed, or the reviewed provisioner remains
blocked. This order never authorizes a fixture mutation.
