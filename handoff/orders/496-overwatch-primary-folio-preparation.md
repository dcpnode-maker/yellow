# Order 496 — Overwatch primary-folio arrival preparation

## Objective

Allow Overwatch's live arrival journey to prepare the single missing primary folio
through the existing canonical API, following a visible operator confirmation, then
immediately re-read server readiness.  This turns clean/inspected due-ins into a
truthful, executable check-in demo without bypassing finance controls.

## Scope

- `frontend/yellow/src/App.tsx`, `frontend/yellow/src/styles.css`, and focused
  frontend tests only
- existing `POST /api/v1/properties/:property/reservations/:reservation/primary-folio`
  contract only

## Required behaviour

1. Show the option only when current authoritative readiness reports exactly the
   `primary_folio_not_open` blocker and the arrival is otherwise physically/identity
   ready.
2. Require a clear, separate visible confirmation before the canonical endpoint is
   called, with a stable idempotency key per pending action.
3. Refetch reservation detail and readiness after success or denial; never claim
   the folio was opened based on an optimistic UI state.
4. Do not create an accounting posting, invoice, settlement, room-status change or
   direct database write. The server retains all authorization, audit/outbox and
   financial-series decisions.

## Acceptance evidence

- Focused tests/typecheck prove the guarded rendering, body/header contract,
  confirmation gate and authoritative refresh.
- A different agent independently runs a fresh PostgreSQL/API proof against the
  existing folio service before public release.
