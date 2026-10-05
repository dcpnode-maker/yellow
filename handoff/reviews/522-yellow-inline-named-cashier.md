# Review — Order 522 Yellow inline named cashier

## Result

Accepted for the bounded read-only cashier-selection scope in Order 522. This is
not acceptance of live financial posting or a complete cashier workflow.

## What was verified

- A unique named folio request renders the existing cashier workbench inside
  Yellow AI mode and keeps the Today URL stable.
- The requested reservation is selected when the embedded workbench opens.
- Switching immediately from `Open L3R-DI-0016 folio` to
  `Open L3R-IH-0001 folio` refreshes the embedded workbench from Meera Iyer to
  Aarav Mehta. A stale local selection found during public proof was corrected
  by keying the embedded workspace to the requested reservation.
- Generic cashier requests continue to use the existing cashier workspace.
- No posting, settlement, transfer, invoice, reservation or database write was
  attempted, and the existing confirmation and financial guards were not
  changed.
- At 375 px viewport width the document remained 375 px wide and the 1,296 px
  cashier content remained reachable within a bounded 469 px scroll region.

## Executed proof

- Focused voice, ambient and Today tests after the final context-switch repair:
  37 passed, 0 failed, 329 assertions.
- Focused cashier workbench tests after the final repair: 19 passed, 6 skipped,
  0 failed, 191 assertions. The skipped cases are authenticated database proofs
  requiring their integration setup; they are not reported as passes.
- Strict TypeScript: passed.
- Vite production build: passed.
- Published bundle: `index-lNVg3lxn.js` with `index-vf6ZwBNz.css`.
- Public desktop proof selected Aarav Mehta / `L3R-IH-0001` after first selecting
  Meera Iyer / `L3R-DI-0016`, with the public Today URL unchanged.

## Explicit limitation

The current Locanda scenario contains zero folio windows and zero cashier
drawers for the tested reservations. Consequently no posting form is rendered
and no real charge-posting or checkout-ready financial path has been
demonstrated. Creating that governed financial fixture is high-risk follow-up
work and requires an independent non-implementing reviewer to execute the
relevant proof before deployment.

