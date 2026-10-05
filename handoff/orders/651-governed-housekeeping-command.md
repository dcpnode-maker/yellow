# Order 651 — governed housekeeping command proof

## Purpose

Implement the first real database-backed public-demo operational command: a
confirmation-gated housekeeping room-condition update that writes `unit_condition`
and an `outbox` event in one tenant-scoped transaction, then rereads authoritative
PostgreSQL state.

## Scope

- `src/demo/governed-housekeeping-command.ts`
- `src/app.ts`
- `src/demo/proof-bundle.ts`
- `src/demo/share-packet.ts`
- `src/demo/colleague-readiness.ts`
- `docker-compose.yml`
- Tests for confirmation gating and safe route behaviour.

## Out of scope

- No occupancy mutation.
- No folio, journal, posting, payment, document, fiscal, statutory or checkout
  mutation.
- No ready/share notification; this proves one governed command family only.

## Acceptance

- Without exact confirmation, the route refuses execution and does not open a
  database transaction.
- With exact confirmation and configured `DATABASE_URL`, the route updates a
  synthetic demo room's `unit_condition`, writes one outbox event, and returns an
  authoritative reread.
- If `DATABASE_URL` is absent, the route reports database unconfigured instead of
  pretending success.
- Existing invariant battery remains green.
