# Order 497 — Reservation command surface

## Objective

Replace separated operational reservation views with one fast, searchable,
filterable reservation command surface. It must preserve legal PMS status semantics
and open the existing factual guest/stay/folio record in place.

## Scope

- `frontend/yellow/src/App.tsx`, `frontend/yellow/src/styles.css`,
  `frontend/yellow/src/voice.ts`, and focused frontend tests
- existing read-only reservation-board, reservation-detail, party-profile/history
  API contracts only

## Required behaviour

1. One board supports name, confirmation, room/rate and status filtering, with
   explicit stored-state labels: due-in = expected arrival, due-out = departure
   today, in-house = in house, checked-out = departed history. “Checked in today” and
   “stayover” are future derived operational views and must not be inferred from a
   scheduled arrival or a stored `in_house` status alone.
2. Operators can expand an item in place to see its existing guest, stay, room/rate
   and folio context; no duplicate state or fabricated history.
3. Search/filter never changes reservation state, occupancy, room, party or money.
4. The result remains usable at phone widths and routes named voice searches into
   the same governed surface rather than a dead link.

## Exclusions

- No new database/API contracts, direct DML, record changes, financial actions,
  party/contact disclosure, or synthetic/real data import.
