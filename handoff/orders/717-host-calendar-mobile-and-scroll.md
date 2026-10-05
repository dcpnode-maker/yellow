# Order717 — host calendar, mobile views and scroll recovery

Founder25September resumes after calendar feedback: use supplied Airbnb host
screenshots (List/Month/Year, listing chooser, continuous months, booking bars,
date-detail sheets), replacing pink with neon green. Calendar first, then resume
714/715/716 and the wider ecosystem. Keep public site OFF until asked to reopen.
Use verified free-model quota first where practical; never claim a free provider
was used without an actual result. Preserve all existing dirty source.

## Scope

- frontend/yellow/src/workspaces/ReservationRoomCalendar.tsx
- frontend/yellow/src/workspaces/reservation-room-calendar.css
- frontend/yellow/src/workspaces/HostReservationCalendar.tsx
- frontend/yellow/src/workspaces/host-reservation-calendar.css
- frontend/yellow/src/reservation-calendar-views.ts
- frontend/yellow/src/reservation-calendar.ts (pure presentation helpers only)
- tests/order717-host-calendar.test.tsx
- tests/order717-calendar-scroll.test.ts
- tests/reservation-calendar-ui.test.ts (existing safeguards preserved)
- docs/design/CALENDAR-INTERACTION-20260925.md
- this order, handoff/questions/717.md, handoff/reviews/717-calendar.md,
  handoff/receipts/717-calendar.md, docs/PROJECT-STATUS.md, handoff/LEDGER.md

## Sequence and boundaries

Founder refinement (Q717): replace the DEFAULT calendar experience rather than
polishing the legacy grid. Build reusable read-only presentation/data props for
Reservations now and a future RMS pricing controller. Do not conflate a room
calendar blank with sellability, or render inert pricing switches as delivered.

1. Fix the existing room-plan scroll trap: vertical scroll chains to the page;
   no touchmove/wheel prevention or body lock. Keep horizontal room-plan scrolling.
2. Build compact property-scoped room/listing picker and working List/Month/Year
   views from existing authenticated calendar reads; keep Room plan accessible.
   Month reservation bars span nights and wrap at week/month boundaries; clicking
   opens the real reservation. Completed statuses mute; an overdue occupied stay
   must never become completed from its date alone. Show status without color only.
3. Respect existing 31-day / 500-room / 1000-segment bounds per request, bounded
   visible month queries, partial-result notices, per-month errors, and retry.
   Empty/unknown cells do NOT imply sellability. No invented nightly prices,
   photos, guest counts or forecasts absent from the current read contract.
4. Calendar/day selection is local only. Existing reservation navigation works.
   Price/availability/policy writes and cross-property comparison remain explicit
   follow-on slices, not fake working settings. No backend/schema/occupancy edits.
5. Neon-green accent (#b6ff00) with dark ink; white canvas, grey blocked/secondary
   surfaces, compact icon view menu, clear focus, reduced motion, normal page scroll.
   User screenshots are the accepted reference; no new paid image generation.

## Verification

Pure tests: leap years, ISO edges, clipping/half-open departures, week wrapping,
overlapping stays, status-derived colors, no fabricated rates, partial/error states.
Keep existing calendar tests and type/boundary checks; verify desktop and mobile
in IAB using a LOCAL-only app. Public tunnel stays stopped. Record differences
from the reference where source capability is missing instead of claiming parity.
Independent reviewer runs relevant proof; no live hotel writes for QA.

## Runtime action already authorized/executed

Founder asked to stop the live website. Root gracefully stopped exact containers
yellow-public-demo-tunnel and yellow-public-demo-app-1. Database/cache volumes,
images and source retained. The same app may run loopback-only for local QA;
no public restart, new database, destructive cleanup or security-service shutdown.
