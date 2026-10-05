# Order 648 — operational action safety matrix

## Purpose

Expose one deterministic public-demo safety matrix that proves all currently visible
operator action surfaces are confirmation-gated and that real PMS mutation remains
disabled until governed database-backed commands and independent proof are connected.

## Scope

- `src/demo/action-safety-matrix.ts`
- `src/app.ts`
- `src/demo/proof-bundle.ts`
- `src/demo/colleague-readiness.ts`
- `src/demo/mobile-shell.ts`
- `tests/demo-action-safety-matrix.test.ts`
- Existing readiness/proof tests if expectations need the new route.

## Out of scope

- No new tables, migrations, RLS, occupancy, journal, payment, document, statutory or
  outbox writes.
- No real check-in, checkout, posting, settlement, room move, housekeeping or block
  mutation enablement.
- No public-ready notification.

## Acceptance

- `/api/v1/demo/action-safety-matrix` returns every current demo action surface with
  `realPmsExecutionEnabled=false`, exact confirmation phrase, and zero enabled real
  mutations.
- Proof bundle and readiness evidence reference the matrix while remaining
  `readyToShare=false`.
- Focused tests, typecheck and boundaries pass.
