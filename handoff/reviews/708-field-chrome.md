# Order708 independent review — compact controls and field dictation

Reviewer: `/root/reservation_workspace_research` (non-implementer)
Review date: 2026-09-25
Scope reviewed: Order708 source/tests and the inherited Order686/694/703/707 regression surfaces. No product or test files were edited by this reviewer.

## Result

Source review approved; no blocking findings. Root's first mounted pass exposed three issues—overflowing Columns text at 320px, the dictation panel behind header/dock layers, and Reset restoring stale search/sort values. Q708 now explicitly admits the narrow Reset/Escape corrections and portal layering. I inspected the final fixes and independently reran the required source proof. Root's final mounted/browser checks remain outstanding; this receipt does not claim those checks.

The dictation path requests speech recognition only after the user opens the field disclosure and explicitly activates Start microphone. It discloses possible browser-vendor audio processing, keeps interim results out of the draft, requires Stop/review/Use text before applying a final transcript, and has no automatic save/apply path. The controller guards result/error/end/use against current field value, context, max length, availability, and visibility; cancellation, disable, field changes, disposal, and session replacement detach handlers and abort stale recognition. `maxLength` truncation is reflected in the draft and warning. Original `onChange` handlers remain intact, and the 26 consumer adapters’ `onVoiceValue` expressions match their typed-update expressions, including confirmation resets.

Compact controls retain a two-row search/count and Reset/Filter/Sort/Columns layout, one active editor, filter/sort levels, stay criteria and mobile target sizing. At narrow widths the concise “Cols” label is visible while the full active-column count remains accessible as the button's `aria-label`. Reset clears table query, movement criteria, and restores initial visible columns without using the stale stay-criteria closure. The column menu yields the first Escape to an open dictation field. Dictation portals into the nearest modal/dialog layer (or body), uses a higher stacking layer with mobile dock clearance, and restores focus to the mic on cancel or the input after Use. Dock idle opacity remains interactive and restores on hover/focus/drag; bottom-placement clearance is present. The field-control CSS specificity hardening was included in the final source pass.

## Personally executed proof

Command:

```text
bun test tests/order708-field-dictation.test.tsx tests/order708-field-coverage.test.ts tests/order708-compact-controls.test.tsx tests/order686-reservation-navigation.test.ts tests/order694-navigation-table.test.ts tests/order703-workspace-dock.test.tsx tests/order707-hospitality-chrome.test.tsx tests/order707-mobile-navigation.test.ts
```

Result: 42 pass, 0 fail, 424 assertions. Coverage includes disclosure-before-start, no interim application, explicit final Use, last phrase after Stop, permission denial/unsupported fallback, stale result/context/value/disable/unmount/session rejection, one active session, maxLength, native field props, secret/disabled exclusion, portal host/layer contract and focus-return wiring, all 26 adapter-equivalence checks, Q708 Reset/Escape regressions, toolbar/dock regressions, navigation and mobile chrome.

Commands:

```text
bun run typecheck
bun run boundaries
```

Results: full backend/frontend typecheck passed; import boundaries passed (208 TypeScript files scanned).

No browser, database, deployment, or live microphone action was performed by this reviewer. Synthetic recognition is test-only and does not establish microphone accuracy or browser support. Root owns the final mounted checks for 320px label fit, native column-menu voice-panel containment, header/dock layer, and release decision.
