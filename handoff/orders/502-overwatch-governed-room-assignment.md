# Order 502 — Overwatch governed due-in room assignment

## Objective

Extend the existing embedded Overwatch arrival journey so a staff member can inspect
the server-owned eligible room candidates for an unassigned due-in, deliberately
select one candidate, visibly confirm the exact room assignment, and receive refreshed
authoritative readiness before any separate check-in confirmation.

## Scope

- `frontend/yellow/src/App.tsx`, `frontend/yellow/src/styles.css`, focused frontend
  tests in the current runtime source
- Existing only:
  - `GET .../due-in-room-assignment/candidates`
  - `POST .../due-in-room-assignment`
  - canonical reservation detail and check-in readiness reads

## Required behaviour

1. Render candidates only from the no-store server response. The active screen may
   retain an ephemeral selection snapshot solely to bind visible consent and an exact
   retry body; it must use no HTTP/persistent availability cache, calculate,
   sort-as-recommendation, invent or automatically select availability.
2. Show the exact candidate room/unit/condition and require a separate visible
   confirmation for the chosen room. The command body must faithfully contain the
   authoritative current reservation/segment status, unit type, unassigned state,
   period and selected candidate identity required by the canonical API.
3. Use one stable per-selection idempotency key. On success or failure refetch
   reservation detail and check-in readiness; do not fabricate an assigned room,
   occupancy, room condition, housekeeping state, folio or check-in result.
4. Never call the assignment route for an already assigned stay, non-due-in state,
   errors, empty candidates, missing selection or missing confirmation. Assignment is
   never check-in.

## Exclusions

- No backend/domain/schema/inventory/occupancy/condition/task/folio/check-in changes,
  automatic allocation, bulk assignment, room moves, guest/contact changes or public
  deployment in this order.

## Review protocol

This invokes a canonical occupancy-affecting command. An independent reviewer who did
not implement it must personally prove the source component controls and the relevant
existing authenticated API preservation/denial behaviour before any public release.
