# Question213 — Put the task above workspace chrome

Accepted2026-09-07 under Order444, following root's actual a108/85 phone capture
and Astra's queue→subject→permitted action contract. This is a separate source
slice from the frozen Q211 publication candidate; do not alter its archive/index.

## Design and scope

One compact app bar contains the brand and a native, keyboard-accessible Workspace
options disclosure. Put the existing layout selector, authenticated identity and
Sign out inside it. Sign out stays unavailable while signed out. Retain the same
control IDs and command handlers, close disclosure on Escape with focus restored
and on an outside pointer action without stealing its focus. No simulated OS,
extra theme, profile image, dependency, global expertise or new business action.

The repeated global heading/technical signed-in paragraph must not consume
another visual hero above each module. Retain the accessible workbench heading
and labels, but give the actual module/task heading visual priority. Property
context, navigation, current invoice identity and Back-to-queue remain available.
Do not hide denials, errors, blocking states or authorized workflow information.

Coordinator owns only:

- src/http/operator/index.html
- src/http/operator/operator.css
- src/http/operator/operator.js (disclosure presentation and login visibility only)
- tests/operator-focused-task-chrome.test.ts (new)
- tests/operator-workspace-layout.browser.test.ts
- tests/operator-adaptive-experience.test.ts
- tests/operator-app-bar-responsive-containment.intentional-red.test.ts
- handoff/questions/213-focused-task-chrome.md
- handoff/orders/444-partner-review-and-astra-ui-integration.md
- handoff/reviews/444-native-review-and-ci.md
- docs/design/ASTRA-IMPLEMENTATION-HANDOFF.md
- docs/PROJECT-STATUS.md
- DECISIONS.log
- handoff/LEDGER.md

Preserve all current resource, font fallback, icon, authorization and workflow
assertions; legacy fixture markup may follow the new header composition but may
not discard its adversarial long-label or narrow-width cases. No financial code,
invoice controller, API, migration, fixture database or serving runtime changes.
Report additional path requirements before editing.

## Proof

Add failing semantic/behavior tests first. Actual Chromium must demonstrate the
focused task begins materially higher at390px than the existing captured layout,
while every44px control remains reachable at320px, long names reflow, the options
panel stays in the viewport, keyboard Escape restores focus and outside clicks
preserve their target. Three layouts keep the same mounted subject, drafts,
property and request identity. No network request or business mutation is caused
by opening/closing options or changing composition. Keep reduced motion/forced
colours, and inspect screenshots before a visual-completion statement.
