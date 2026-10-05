# Order706 — Today Guest movement capsule correction

25September2026. Root implemented; movement_hover_review independently inspected
and executed focused tests/typecheck. No operational/API/database implementation
change. Existing dirty worktree preserved; no clean Git/PR/whole-app claim.

## Reproduction and cause

Founder screenshot showed the Today dashboard capsule, not the separate table
ribbon exercised in702's live hover proof. Root reproduced with actual browser
mouse movement on the public Today route: index changed to1, yet computed transform
was none and pill x278.2 stayed on Arrivals instead of Departures x514.325.
The mixed :is() theme rule had specificity0,3,1 and reset transform to none;
the later intended translation rule had0,2,0. Existing11tests still passed.

Root moved the static transform reset into a selector that excludes the moving
Today pill. Appearance,220ms transition and reduced-motion behavior retained.
Touch pointerdown previews that item; navigation remains the same onClick callback.
Buttons suppress text selection and use touch-action manipulation. This is press
feedback, not a claim that touchscreens have persistent mouse hover.

## Tests and independent review

New regression tests first failed2/2 against old source. After fix root and
independent reviewer each personally ran19tests/0fail/115assertions across706,
702,696,700and shared ribbon depth. Full frontend/backend types passed; root import
boundaries208 and Vite535module build passed. Existing large map chunk warning
unchanged. Source tests are structural guards, not rendered cascade proof.
Review: handoff/reviews/706-today-pill.md.

## Root real browser proof

Tool: existing connected in-app browser, actual CDP mouse input/keyboard through
CUA, read-only DOM/computed styles; no synthetic state/handler injection.
URL: https://faq-lift-iso-completely.trycloudflare.com/p/6081b544-22a1-534f-a86d-bb1ae0519e14/today

- Desktop1280x720 after reload: hover Departures moved pill to x514.325,
  transform translate236.125, exactly its button left; hover In house moved to
  x750.45 versus button750.4625. URL remained Today during all hover/focus checks.
- Pointer exit restored Arrivals. Keyboard focus on Departures moved its pill;
  later hover In house followed by exit restored focused Departures.
- Reduced-motion emulation yielded transition0s while still translating472.25.
  Preference override cleared afterward.
- Responsive390x844: three buttons108px wide/62px high. In house pill x241.575
  versus button241.6, no document-width overflow. Computed user-select none and
  touch-action manipulation. Root inspected screenshots before/after desktop and
  phone-width. The phone capture includes the keyboard focus outline.
- Clicking Departures opened ?lane=due_out and rendered14departures, with the
  Departures tab selected. No booking/finance/other hotel write performed.
- Correct title/nonblank application, no framework overlay, captured error/warn
  logs empty. Emulation reset and owned QA tab closed.
- Physical Android touch/long-press is NOT verified: connected browser backend
  does not support native touch injection. Narrow browser mouse tests are not
  represented as a physical-phone test.

Screenshots (outside repository): D:/Yellow/temp/order706-before.png,
order706-after-desktop.png, order706-after-phone.png. Mismatch ledger: founder's
stationary white capsule reproduced; post-fix actual capsule aligns with hovered
button. Neutral rail, labels/counts, touch target and navigation retained.

## Release boundary

Generated frontend-only overlay on ba4633c0. Single app service recreated;
database/cache/tunnel left running. Current image:
7e00035dd6640e6649f0cc5fefe76346bcb60656303c22c54c5a8af6deed6718.
Previous ba4633c0 retained as yellow-public-demo-app:before-order706.
Container healthy; local/public health200; read-only migration ledger101 unchanged.
Inherited readiness503/missing build revision remains outside this change.
No calendar/data-collector/ecosystem completion claim.
