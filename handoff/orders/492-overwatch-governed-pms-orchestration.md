# Order 492 — Overwatch governed PMS orchestration

## Objective

Turn Overwatch from a read-only voice guide into the signed-in operator's governed
action layer: it must render an intelligible live plan, complete existing authorised
PMS workflows through their canonical APIs, and present the resulting operational
screen in place.  The first delivered journeys are arrival preparation/check-in and
cashier charge posting; the command map establishes the extensible pattern for every
existing PMS capability.

## Scope

- `frontend/yellow/src/App.tsx`, `frontend/yellow/src/voice.ts`, and its supporting
  front-end modules/styles/tests
- the existing authenticated operator API contracts for read, readiness, preview and
  confirmation-gated commit operations only
- a typed client-side operation catalogue that maps natural-language intents to
  canonical existing routes and rendered work surfaces
- check-in readiness/commit and folio-charge preparation/commit using existing
  server-side authority, idempotency, ledger and outbox protections
- operator-facing tests for desktop and mobile staged journeys

## Required behaviour

1. A request such as “prepare Mira's check-in” resolves the selected stay, opens an
   Overwatch work surface, and visibly advances through guest/sharer review, stay and
   preference review, eligible clean/inspected-room selection, room assignment
   preview, folio/statutory readiness, and final check-in.  Each resolved prerequisite
   displays a status; a missing prerequisite offers the governed existing action or
   states exactly why it cannot proceed.
2. Room suitability is always computed by the canonical availability/readiness
   services; Overwatch never invents availability, bypasses occupancy, or assumes a
   dirty room is saleable.  The operator can override a proposal only through the
   existing permitted UI/API route and permissions.
3. A request to post a charge resolves guest, reservation, room or folio reference,
   opens a live folio workbench with its current immutable postings/windows, captures
   a typed transaction-code/amount/quantity/reason proposal, and sends only the
   explicit confirmation to the existing charge service.  The final screen reflects
   the committed posting or an authoritative denial.
4. The operation catalogue includes every existing operator surface by capability
   family (stays, guests, room/HK, folios/cashier, payments, rates/configuration,
   reports).  Unsupported or missing API functions are shown as unavailable rather
   than simulated, guessed, or silently routed to a manual link.
5. An operation never receives authority from speech or model output.  Confirmation
   remains required for every mutation; the server re-authorizes actor, property,
   object, state and input on every request.  No provider call, data export, recording
   persistence, payment credential, or new raw-DML path is added.

## Acceptance evidence

- Strict TypeScript and focused browser/component tests verify: intent-to-catalogue
  routing, progressive live steps, no state mutation before confirmation, denied and
  stale readiness paths, idempotent confirmed retry, and mobile presentation.
- A fresh PostgreSQL integration proof, executed by an independent non-implementing
  reviewer, proves that check-in and charge-posting use only their existing canonical
  services and preserve occupancy, journal balance, outbox and tenant/RLS invariants.
- The public runtime is not updated until the source proof and target release review
  pass.  The public data-reconciliation/migration gate remains independent under
  Orders 491 and its successor.

## Exclusions

- No new financial, occupancy, party, reservation, or room-status tables; no direct
  SQL mutation; no synthetic claim of unavailable capabilities; no channel/provider
  activation; no real guest data import; no public credential disclosure.
