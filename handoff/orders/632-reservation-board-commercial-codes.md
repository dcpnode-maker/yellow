# Order 632 — Reservation-board commercial codes

## Intent

Expose market and source codes in reservation-board rows so the public demo can
summarize business contribution by the hotel hierarchy the founder described
(market segment group → market segment → source/company/profile), without
detail-drilling each reservation.

## Scope

- `src/contexts/reservations/board.ts`
- `tools/provision-public-commercial-codes.ps1`
- `tools/probe-colleague-demo-readiness.ts`
- `tests/order632-reservation-board-commercial-codes.test.ts`
- `handoff/LEDGER.md`

## Non-goals

- No schema changes.
- No write workflows.
- No client-side revenue invention.
- No production/client data changes; the provisioning script targets only the
  public synthetic Locanda demo property.

## Acceptance

- Reservation-board API rows include `marketCode` and `sourceCode`.
- Synthetic public-demo reservations have realistic board-visible market/source
  codes.
- The public readiness probe fails if the synthetic demo loses board-level
  market/source/channel contribution evidence.
- Focused source test, typecheck and live colleague-readiness probe pass.
