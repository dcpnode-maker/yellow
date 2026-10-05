# Order 541 — Shared reservation query and Yellow follow-ups

## Objective

Make Yellow apply compound reservation qualifiers such as date, source and room
assignment to the same complete, virtualized reservation board used by manual
operators, and retain that finite query for conversational follow-ups.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/today-workspace.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/voice.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-reservation-query.test.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-voice-routing.test.ts`
- `handoff/reviews/541-shared-reservation-query-and-yellow-followups.md`
- `handoff/FOUNDER-JOURNEY-CAPABILITY-LEDGER.md`
- `handoff/LEDGER.md`

## Required behaviour

1. Define one typed reservation query contract for search, exact operational
   state, source, room assignment, room type, rate plan, inclusive property-local
   date range, movement direction and stable multi-level sorting. The manual grid
   and Yellow inline grid must use that same contract and the existing
   `filterAndSortMovementRows` authority.
2. Yellow deterministically interprets finite compound reads including current
   arrivals/departures/in-house, exact completed/stayover states, future movement
   dates, ISO date ranges, recorded sources, room assignment, room type, rate plan
   and supported sorting. It does not call Gemini for these reads.
3. A date-qualified future arrival/departure is a planned movement-date view. It
   must not fabricate a `due_in`, `due_out`, check-in or checkout event from the
   date. Exact completed states remain server-provided only.
4. Follow-ups such as `now only unassigned`, `clear the source filter` and
   `earliest first` refine the previous reservation query while Yellow is open.
   The finite context is property-bound and retained with the existing session
   memory; changing property cannot reuse it.
5. Unknown or ambiguous source, room type, rate plan or date wording produces a
   local clarification and no broad fallback result. An unavailable or incomplete
   complete-board read produces an unavailable state, never a partial lane.
6. Yellow renders the filtered rows inline, keeps the URL stable and retains the
   query when a row detail is opened and the operator returns to the result.
7. Manual controls remain keyboard/touch accessible, virtualized and usable at
   desktop, 375px portrait and phone landscape widths.

## Exclusions

- No reservation, occupancy, guest, housekeeping, rate, financial or database
  mutation.
- No API, schema, migration, provider, authentication, Gemini or dependency
  change.
- No inference of unrecorded channel, room, rate, travel or lifecycle facts.
- No image or change to the procedural neon field.

## Verification

- Record intentional failing tests for the reproduced qualifier-loss and follow-up
  failures before implementation.
- Prove equivalent manual/query and Yellow requests return identical IDs, count
  and order across a cursor-collected board larger than one page.
- Prove future-date, exact-state, ambiguity, clear/refine and failed-board cases.
- Run focused frontend suites, strict TypeScript and the production Vite build.
- Verify URL-stable inline interaction in Browser/IAB at desktop, 375px portrait
  and phone landscape before public promotion.
