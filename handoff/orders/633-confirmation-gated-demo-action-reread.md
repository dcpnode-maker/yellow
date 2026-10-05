# Order 633 — Confirmation-gated demo action reread

## Scope

- Add a confirmation-gated demo action endpoint that exercises the command/reread
  shape for every current operating-journey action.
- Require the exact confirmation phrase before the endpoint will return a confirmed
  command envelope.
- Always keep real execution disabled in this thin checkout and return the current
  operating journey as the authoritative reread.

## Out of scope

- Mutating PMS state.
- Writing reservations, occupancy, folios, journals, tasks, outbox rows or documents.
- Claiming governed workflow services are complete.

## Acceptance

- `POST /api/v1/demo/actions/confirm` rejects missing/unknown actions.
- Without the exact confirmation phrase, the endpoint returns `confirmed:false`.
- With the exact phrase, the endpoint returns `confirmed:true`, `executed:false`, and
  a current authoritative reread snapshot.
- Tests prove cashier/check-in style actions stay non-mutating and reread-backed.
