# Review — Order 526 reservation board commercial filters

## Result

Accepted for the read-only reservation-board scope.

## Evidence

- Intentional red: the focused helper test returned both Agoda due-ins before
  exact room-type and rate-plan predicates existed.
- Final focused proof: 12 passed, 0 failed, 75 assertions across Today helpers,
  reservation paging, mobile navigation and ambient Yellow mode.
- Strict TypeScript passed.
- Vite production build passed with `index-KPsRTkqF.js` and
  `index-d8zkp09H.css`.
- The isolated public app rebuilt successfully and served the new asset.
- Public 375×812 proof exposed Room type and Rate plan selectors. Selecting One
  Bedroom Residence plus Best Available Rate reduced 131 reservations to 84,
  displayed an active-filter count of two, and retained a 360 px document width
  inside the 375 px viewport.
- A combined Source=booking.com, Room type=One Bedroom Residence and Rate
  plan=Best Available Rate proof reduced the same board to 30 and displayed an
  active-filter count of three.
- Initial 812×375 proof found the filter popover beyond the right edge. The
  responsive toolbar breakpoint was widened to 900 px; final public proof placed
  the 285 px popover at x=8–293 within an 812 px viewport. The fixed mobile bar
  remained at the viewport bottom and the override was reset.

## Boundaries

All filters operate on the already-loaded governed rows using exact values. The
existing virtualized table remains in place. No reservation, API, database,
schema, fixture, financial, voice or provider state changed. The procedural
neon-yellow field is unchanged and uses no image.
