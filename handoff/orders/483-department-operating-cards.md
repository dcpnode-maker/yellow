# Order 483 — Department operating cards

## Objective

Extend Yellow's Today workspace with a fast, role-oriented performance matrix
for HODs. The matrix must turn the governed operational facts already available
to the browser into useful drill-down cards without manufacturing financial,
forecast, review or out-of-service facts.

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/styles.css`
- focused Yellow front-end tests under `tests/`

## Required behaviour

- Add read-only General Manager, Front Office, Housekeeping, Revenue and
  Finance cards to Today.
- Use only the existing tenant-scoped Today lanes, inventory configuration,
  housekeeping conditions and housekeeping task feeds.
- The Housekeeping card must expose clean/inspected availability, dirty/pickup
  queue, assigned task count and arrival/departure pressure.
- The Front Office card must expose arrivals, departures, in-house and the
  readiness prerequisite for a specific check-in.
- Revenue, forecast, review, OOO/OOS and finance figures must state that their
  source is not connected where this UI has no authoritative feed. They must
  never be inferred from counts or configuration.
- Each card opens Overwatch with a narrow, read-only request. It must not write
  operational, occupancy, rate, payment or financial state.
- Preserve the mobile-first layout and accessible button labels.

## Exclusions

- No database/schema/API change; no financial calculation; no real-data import;
  no review/OTA scraping; no OOO/OOS calculation; no automatic early-check-in
  sale, payment or check-in command; no release/promotion.

## Follow-on boundary

Early check-in or late checkout can only become sellable after a separate
governed eligibility command revalidates the reservation, room readiness,
physical availability/OOO, hotel policy, approved price and any payment or
confirmation requirements in one authoritative workflow.
