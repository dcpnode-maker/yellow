# Review — Order 527 reservation board property-local date range

## Result

Accepted for the read-only reservation-board scope.

## Evidence

- Intentional red: the timezone-boundary test retained both rows before date
  predicates existed.
- Final focused proof: 13 passed, 0 failed, 76 assertions across Today helpers,
  reservation paging, mobile navigation and ambient Yellow mode.
- Strict TypeScript and Vite production build passed. The deployed assets are
  `index-DFlrnspC.js` and `index-CsyCKI-m.css`.
- Public 375×812 proof exposed Arrival from and Arrival to native date fields.
  The inclusive 1–31 October 2026 range reduced 131 rows to 64 and showed an
  active-filter count of two; document width remained 360 inside the 375 px
  viewport.
- Public 812×375 proof retained the filter popover at x=8–293 and document
  width 797 inside the effective viewport. The viewport override was reset.

## Boundaries

Arrival filtering uses existing scheduled-arrival/stay-start timestamps;
departure filtering uses stay end. Calendar keys are calculated in the
property timezone and boundaries are inclusive. No reservation, API, database,
schema, fixture, financial, voice or provider state changed. The image-free
procedural neon-yellow field is unchanged.
