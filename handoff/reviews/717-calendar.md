# Order717 independent calendar review — 25 September 2026

Reviewer: `/root/review709` (did not implement Order717). Scope: Order717 helper, host calendar, legacy scroll wrapper/CSS and focused tests. No database write, public app restart, tunnel, deployment or credential access was performed.

## Findings and disposition

- The initial tone helper painted a departed room-move segment active when its parent reservation remained in house. Corrected by prioritizing canonical `segmentStatus === "departed"`; executable regression added.
- The initial month helper rejected valid November 9999 because its exclusive end is `9999-12-01`. Corrected and regression added; December 9999 remains unavailable because the backend requires a four-digit exclusive-end year.
- The initial Year view had only decorative dots. It now makes at most twelve bounded, lazy authenticated month reads as cards enter view, and gives per-card unavailable/partial state. A dot denotes a recorded stay, not sellability.
- The initial date sheet held a row snapshot and was hidden by inherited mobile sidebar CSS. It now re-reads the selected month/row and has a scoped visible fixed-position rule. The root owner is performing actual loopback browser QA of the resulting placement and interactions.
- Mobile Month bars initially hid status text, making color the only visible state cue. The current source keeps a compact text badge and legend; departed room-move segments use `Departed segment` in bar, list and date-detail labels.

## Reviewer-executed proof on the current source

`bun test tests/order717-host-calendar.test.tsx tests/order717-calendar-scroll.test.ts tests/reservation-calendar-ui.test.ts tests/reservation-calendar.test.ts` — **18 pass, 0 fail, 103 expect calls**.

`bun run typecheck:frontend` — **pass** (`tsc --noEmit -p frontend/yellow/tsconfig.json`).

`bun run boundaries` — **pass**, 208 TypeScript files scanned.

Read-only source review checked property/timezone/date response binding, per-month 31-day requests, half-open stay clipping and week wrapping, separate overlapping lanes, authoritative status tone, partial/error/empty disclosures, reservation navigation, and absence of fabricated rates or availability. The new shared month renderer accepts optional externally supplied day content but the Reservations controller supplies none. No canonical occupancy or pricing command changed.

## Limits and verdict

Source and focused proof are acceptable for **loopback-only UI QA**. The tests include helper and static-render assertions, not mounted event/refetch transitions; this review does not claim live browser interaction, visual parity with the reference screenshots, native-phone behavior, or release readiness. Root's independent mobile/desktop browser checks and final receipt remain required before an Order717 completion claim. Public site stays off.
