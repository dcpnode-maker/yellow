# Order692 — nested reservation journey ribbon

25 September 2026. IMPLEMENTING. Founder requests Individual / Groups / Calendar
with five visible phase views inside Individual, New reservation adjacent, and
compact same-screen filtering. Builder ecosystem_journey_gaps; independent proof
order679_independent_review; root integrates with Order693 (separate detail edits).

Natural solution: existing reservation/stay/fact/business_day read model, not a
new lifecycle. No migration, new state, guarantee inference, or incognito flag.

## Exact scope

- src/contexts/reservations/board.ts; src/http/operator.ts (board handler only).
- frontend/yellow/src/yellow-api.tsx (board types/loader only).
- frontend/yellow/src/reservation-board.ts; reservation-navigation.ts;
  ui/MovementTableControls.tsx; workspaces/reservation-journey.css.
- frontend/yellow/src/workspaces/ReservationWorkspace.tsx ONLY MovementGrid and
  ReservationBoardWorkspace plus required stage imports. Root owns detail above.
- Recovery guard amendment: ReservationCreateWorkspace may expose its existing
  working/uncertain-commit state through onBusyChange and cleanup only; board
  disables family/phase navigation while locked. No change to commit command.
- Root-owned frontend/yellow/src/App.tsx mount amendment: forward existing
  setReservationLifecycleFlight lock to board onLifecycleBusyChange, so external
  shell navigation cannot unmount an uncertain create. No routing rewrite.
- tests/reservation-board.integration.test.ts; yellow-reservation-board-pages.test.ts;
  yellow-reservation-board-attribute-performance.test.ts; reservation-workspace-routing.test.ts;
  order692-reservation-journey.test.ts; order692-reservation-journey-http.test.ts;
  order692-reservation-journey-ui.test.ts; tests/fixtures/order692/**.
- Compatibility fixture amendment: tests/operator-reservation-read-surface.integration.test.ts
  and tests/order675-http-codes.test.ts, only required board businessDate fixtures.
- This order; handoff/reviews/692-reservation-journey.md;
  handoff/receipts/692-reservation-journey.md; docs/PROJECT-STATUS.md;
  handoff/LEDGER.md; docs/design/KOLE-INTERACTION-SYSTEM.md;
  generated public/yellow-next/** and scoped D:/Yellow/temp release artifacts.

## Contract and visual acceptance

Astra review amendment: the Individual table's existing detail link carries its
validated phase as returnStage so Order693's Back button returns to that phase.
This changes no command, permission or reservation state.

Server returns persisted current open property business date, never browser or
calendar fallback. No open day: clear phase-view error, retain All access. Stage
predicate precedes LIMIT; cursor binds stage and business date; client rejects
mixed-day pages. Existing tenant and property grants remain authoritative.

Pre-arrival = future local stay start for reserved/due_in/waitlist (waitlist clearly
labelled, not an inventory confirmation). Arrival = start on business date for
reserved/due_in, plus fact-backed checked_in_today; In house = currently in_house
or due_out (distinguish checked_in_today/stayover using existing evidence).
Departure = occupied in_house/due_out with local end on business date.
Post departure = checked_out history. Overlap is intentional: an arrival checked
in today also appears In house. Same-day waitlist, overdue/anomalous records,
quotes, cancelled and no-show remain accessible through All reservations; do not
silently discard or relabel them as confirmed arrivals. Counts must describe the
selected view accurately, not imply these overlapping phases sum to inventory.

Parent family + inner five-phase capsule ribbon in one connected container, plus
All reservations. New reservation is directly beside the controls, not floating
above. Existing gray/white/yellow tokens; readable mobile targets, no clipped
labels, reduced-motion support, keyboard focus and pressed state. Preserve
advanced filters/sorts/columns per phase and draft/recovery navigation guards.
URL/back retains phase. No app rewrite and no unsupported guarantee categories.

Independent reviewer must personally execute real PostgreSQL tenant/property,
business-day/cursor/pagination/stage-overlap proofs. Test paused business day,
future waitlist, current arrived fact, today checkout, cancelled/history and empty
stage. Mounted desktop/mobile QA then one controlled live-app cutover with native
map preserved and exact rollback. No full ecosystem completion claim.
