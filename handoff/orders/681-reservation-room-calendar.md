# Order 681 — Reservation room calendar

DELIVERED BOUNDED CALENDAR — 2026-09-24; see receipt681. Founder requests reservation completion in parallel with
native God's Eye diagnosis. This is the first implementation slice, not a claim
that group booking/pickup is completed. Vendor registration remains deferred.

## Product and contract

Keep one Reservations SPA with List / Room calendar / Groups navigation and the
existing guided New reservation flow, shared universal search and reservation
detail navigation. The room calendar must use every applicable stay segment, not
the board's latest-segment summary. Show room/room type, guest, confirmation,
journey/status, local dates, unassigned stays, explicit loading/error/empty/limited
states, and bounded previous/next date navigation. Clicking a stay opens the same
canonical reservation detail. Mobile keeps all data reachable without page overflow.

Add a property-scoped read-only endpoint `/api/v1/properties/:property/reservation-calendar`
with strict ISO local date bounds (maximum 31 days), appropriate reservation-read
authorization, transaction-local tenant isolation, and bounded result counts.
The backend resolves property timezone and local-day clipping. Include actual
segment identity, room identity, labels, half-open stay range, status, clipping/
continuation metadata and applicable out-of-service/cleaning context. Never imply
an empty visual cell is sellable inventory. Any limits must be explicit so incomplete
data cannot be represented as complete availability. No N+1 detail fetches.

Backend implementer publishes the exact response contract before frontend transport
is wired. Reuse primitives and existing scope guards; no new table, event, migration,
write transition, drag-to-book, synthetic reservation, financial or occupancy mutation.
Groups remain honestly read-only until a separate governed write order passes.

## Exact code scope / ownership

Backend owner:
- `src/contexts/reservations/calendar.ts` (new), `src/contexts/reservations/index.ts`
- `src/http/operator.ts`, `src/app.ts`
- `tests/reservation-calendar.test.ts`, `tests/reservation-calendar.integration.test.ts`
- `tests/reservation-calendar-http.test.ts`

Frontend owner:
- `frontend/yellow/src/workspaces/ReservationWorkspace.tsx`
- `frontend/yellow/src/workspaces/ReservationRoomCalendar.tsx` (new)
- `frontend/yellow/src/workspaces/reservation-room-calendar.css` (new)
- `frontend/yellow/src/yellow-api.tsx`
- `frontend/yellow/src/reservation-calendar.ts` (new pure helpers/types)
- `tests/reservation-calendar-ui.test.ts`

Coordinator/reviewer:
- This order, `handoff/questions/681.md` if a scope issue arises
- `handoff/receipts/681-reservation-room-calendar.md`
- `handoff/reviews/681-reservation-room-calendar-independent.md`
- `handoff/LEDGER.md`, `docs/PROJECT-STATUS.md`
- generated `public/yellow-next/**` and temporary isolated delta-build Dockerfile
  under `D:/Yellow/temp/order681-*`, preserving the exact deployed 679 base.

## Proof and release

Independent non-implementing reviewer must personally execute targeted DB proof
for property/tenant scoping, multi-segment room moves, local midnight/timezone,
half-open date edges, cancelled rows and bounded/limited responses. Execute
frontend typecheck, backend targeted checks, import boundaries and relevant tests.
Mount the actual frontend in the existing app and verify desktop and mobile date
navigation, stay-to-detail navigation, empty/error handling and no app replacement.
Deploy only reviewed exact deltas over live Order679; preserve all unrelated dirty
source and existing images/data. No claim of group mutation or 50ms SLA.
