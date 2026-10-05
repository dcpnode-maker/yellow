# Order 512 — unified virtual reservation-board review

## Verdict

**ACCEPT — deployed read-only reservation-board replacement.**

## Automated evidence

- Focused tests: 27 passed, 0 failed, 137 expectations.
- Added factual-state filtering test over reserved/checked-out records.
- Cursor collector still passes complete, order and repeated-cursor safety tests.
- TypeScript typecheck passed.
- Production build passed with 469 modules; bundle reduced to 479.69 kB
  (`index-BbUWcbs7.js`) from the preceding 484.74 kB bundle.
- Public Reservations route returned HTTP 200 and app container was healthy.

## Hosted browser evidence

- Public Locanda Reservations loaded `Reservations · All states (131)`.
- UI reported 131 total reservations but mounted/rendered 21 rows on demand,
  demonstrating the bounded virtual viewport rather than 131 live rows.
- First column is labelled `Arrival`; guest, reservation, nights, room type,
  assigned room, source, rate plan, attributes, readiness and status columns
  rendered in the shared spreadsheet grid.
- Advanced filter exposed operational state, source and room assignment.
- Selecting `Checked out · departed history` reduced the board from 131 to the
  factual 10 historical rows and updated the active-filter count.
- Clicking a filtered row directly opened reservation `L3R-HX-0127` and loaded
  its governed checked-out detail. No redundant Open button was involved.
- The component is the same mobile-tested MovementGrid accepted under Order507;
  this hosted pass did not separately emulate a physical phone.

## Safety

- The change reuses the read-only reservation-board projection and adds no
  reservation, guest, room, folio or financial mutation.
- Operational state falls back from the computed state to stored status only
  when the projection lacks an explicit computed state.
