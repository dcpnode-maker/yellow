# Order 530 — Rich reservation operating record

## Objective

Turn the React reservation route into a complete read-only operating record
using the booking, stay, travel, alert, folio and history facts already returned
by the governed reservation-detail API.

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/styles.css`
- `tests/yellow-rich-reservation-record.test.ts`
- focused frontend verification and public phone proof
- `handoff/reviews/530-rich-reservation-operating-record.md`

## Required behaviour

1. Booking context shows channel, market/source/origin, currency, booked time,
   ETA/ETD and cancellation evidence when recorded.
2. Stay segments show exact dates, guest counts, assignment and lifecycle state.
3. Recorded alerts and travel details are visible; absent facts are explicit.
4. Reservation history displays recorded fact type, business date and recorded
   time in the property timezone.
5. Existing Party-ID guest links and confirmation-gated check-in/out remain.

## Exclusions

- No booking edit, lifecycle command, API, database, schema, fixture or
  financial change.
- No label or timestamp inferred from missing data.

## Verification

- Intentional failing focused surface test before implementation.
- Focused frontend tests, strict TypeScript and production build.
- Public phone reservation proof.
