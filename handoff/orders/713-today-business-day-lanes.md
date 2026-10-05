# Order713 — Today lanes use the property's open business day

Founder continuation, Phase7. Founder explicitly defines Arrival and Departure by
the system/property business day, with checked-in arrivals also visible in In-house.
The active Today screen still uses status-wide queues including older due-ins/outs.
Existing five-stage reservation-board API is authoritative. No new API/domain,
date policy, occupancy mutation or browser-clock business-day calculation.

Read stage=arrival/departure/in_house using the same existing permission, stable
server businessDate across all cursor pages and the same phase membership as the
reservation board. Arrival includes checked-in-today as documented; do not exclude
these to manufacture a pending-only count. Today counts and its selected table
must use the identical response. Keep existing broad loadLane consumers unchanged
for assistant/operational queues. Provide a compact explicit past-due arrivals/
departures path; only fetch its status-wide queue on demand and derive past-date
membership from authoritative businessDate plus property timezone/stay boundary.
Never substitute the browser date, show a false zero on error, or silently hide
overdue work. Do not add another large KPI ribbon or change shared table controls.

Scope and owners:
- Builder: new frontend/yellow/src/today-business-day.ts and
  tests/order713-today-business-day.test.ts. Export an injected loader for three
  canonical stages and on-demand past-due status queue plus pure past-due filter.
  Use existing Stay type supplied by the App to a minimally constrained generic
  loader and collectReservationJourneyPages; no yellow-api edit. See Q713 for the
  non-JSX root test compiler boundary; do not bypass typecheck gates.
  Return readonly reservations and businessDate. Stable date/page limits and
  wrong/missing date fail closed. No client-side business-day inference.
- Root: frontend/yellow/src/App.tsx only active Today query/data selection,
  compact Today/Past-due scope control, header business-day copy and identical
  dashboard/ribbon/table data wiring. Preserve assistant and other workspaces.
  frontend/yellow/src/ui/movement-ribbon.css only new date-scope control layout,
  replacing the nonexistent app.css path explicitly per Q713 browser finding;
  tests/order713-today-integration.test.ts.
- Governance: this order, handoff/questions/713.md, handoff/reviews/713-today.md,
  handoff/receipts/713-today.md, docs/PROJECT-STATUS.md, handoff/LEDGER.md,
  DECISIONS.log append-only supersession of D453's browser-day wording.
- Generated public/yellow-next/**; external D:/Yellow/temp/order713-* build proof.

Independent review and focused executable loader/filter tests for timezone date
boundaries, arrival's checked-in overlap, stable pagination, missing/open-day
failure, matching counts/table and overdue visibility. Full types/boundaries/build;
real mobile/desktop read-only UI with live server date, not invented fixtures.
No DB fixtures, migrations, permissions, backend changes or live hotel writes.
Keep711/712 reviewed release as rollback and publish only after its verification.
