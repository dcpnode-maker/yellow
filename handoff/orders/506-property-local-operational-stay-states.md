# Order 506 — Property-local operational stay states

## Objective

Make the reservation command surface distinguish expected arrivals, actual
check-ins today, stayovers, due-outs, check-outs today and departed history from
authoritative property-local facts. A scheduled arrival must never be presented as
an actual check-in.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/src/contexts/reservations/board.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/src/http/operator.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/reservation-board.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/styles.css`
- focused reservation-board and public-surface tests
- `handoff/reviews/506-property-local-operational-stay-states.md`

## Required behaviour

1. The board returns a typed operational state derived in PostgreSQL from the
   property's current local business date, stored reservation state, segment
   period and canonical `reservation.checked_in` / `reservation.checked_out`
   facts.
2. `due_in` means expected arrival and never actual arrival. An `in_house` record
   is `checked_in_today` only when its canonical check-in fact business date is
   today; otherwise a stay beginning before today is `stayover`. `due_out`
   remains departure today. `checked_out_today` requires today's canonical
   checkout fact; older terminal stays remain departed history.
3. Missing or contradictory event evidence fails to a truthful stored-state
   fallback, never to a fabricated completed event.
4. The React command surface displays and filters these operational states while
   preserving stored state, fast local search, expansion and mobile layout.
5. The query remains tenant/property scoped, property-timezone based, read-only,
   paginated and contact-free.

## Exclusions

- No reservation/segment/fact mutation, no synthetic event insertion, no state
  transition, no schema/migration, no occupancy or financial write, and no claim
  that planned dates prove a physical check-in/check-out.

## Independent review

An independent non-implementer must execute timezone-bound event/state fixtures,
RLS/isolation, zero-write, API serialization, frontend tests and build proof
before public deployment.
