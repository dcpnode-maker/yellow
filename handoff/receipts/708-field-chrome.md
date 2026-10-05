# Order708 — compact controls and field dictation

Status: bounded update live and verified. This receipt records failures as well
as successful checks; it does not declare the whole ecosystem complete.

## Scope

The founder approved removing the floating Ask Yellow launcher, two mobile table
toolbar rows, a see-through idle icon dock, and field microphones. The expanded
sidebar stays left; only the icon dock moves. Implemented 26 eligible text/search/
textarea control definitions across eight active shared UI/workspace files. Dates,
amounts, passwords, structured controls, disabled/read-only fields and inactive
legacy pages are excluded. Native onChange handlers remain; dictation invokes
equivalent draft callbacks only after review and Use text. It does not save a form,
submit a booking, call the assistant, or write hotel data.

Recognition starts only after disclosure and explicit Start microphone. The UI
warns that browser-vendor servers may process audio. Yellow adds no transcription
API key/service or audio storage. Unsupported browsers retain typing. Tests cover
permission errors, stale context/value/visibility, cancellation, unmount, session
replacement, final results after Stop and visibly truncated max-length drafts.
Synthetic recognition tests do not prove real phone speech accuracy.

## Executable checks and corrections

- Initial full typecheck found TS6142 because the component-rendering test had a
  .ts extension. The order explicitly admitted .tsx; full typecheck then passed.
- Independent non-implementer reservation_workspace_research personally ran the
  initial final-source 37 tests / 0 failures / 403 assertions, full backend/frontend
  typecheck and boundaries (208 files), documented in review708.
- Root Vite build passed, 539 modules. Existing large map chunk warning remains.
- First app-only candidate 338e0035c0074b0c7e469d9f735e7c82b2d52a639c2bbdd49d8b63fb83868da8
  served with healthy container and local/public health200. DB ledger remained101.
- Mounted public browser measured toolbar94px versus144px before, two44px rows;
  input padding48px and mic44x44. Search Priya returned1of14; floating launcher gone.
- Mounted QA found Columns (12) overflowing at320/390px. Mobile labels were made
  concise with full accessible names/counts. It also found fixed microphone-panel
  buttons intercepted by the higher ancestor stacking context of the dock: Cancel
  navigated to Front desk rather than closing. No hotel command was submitted.
  The prior707 build was restored while a portal/placement correction is verified.
- Mounted Reset retained previous search/sorts. Q708 documents explicit narrow
  scope revision to correct the inherited stale callback closure and add proof.

## Final corrected release

Independent reviewer personally re-ran the final combined suite:42 passed,
0 failed,424 assertions; full typecheck and208-file boundaries passed. Root's
Order708-only suite passed17/0/176; final Vite539-module build passed. Reviewer
also caught missing focus restoration after Use text; both field adapters now
return focus after the guarded draft application. Recognition proof remains
synthetic, including this source-level focus regression.

Final image aeaa116053767feb4ec5c25756f2edc1acc895a86a61befbe37d7b3bbbbc3607
is serving on the original app container. JS index-D74PvdcE.js and CSS
index-DXDbkAra.css. Container healthy, local and public /health200, DB migration
ledger101 unchanged. Existing707 remains tagged before-order708. Only app was
recreated; PostgreSQL, Valkey and tunnel were not rebuilt or replaced.

Root personally checked the public app at320/390/1280 CSS-pixel widths:

- Mobile toolbar94px (previous144), exactly two44px rows. No action text overflow
  at320; full accessible labels preserve filter/sort/visible-column counts while
  compact mobile labels fit. Desktop retains full labels and a36px single row.
  Field mic44x44 with48px reserved input padding; no floating Ask Yellow launcher.
- Search Priya and an explicit Guest contains Priya filter each return1of14.
  Reset returns14of14, clears the search/filter and restores default sorting and
  columns. Guest descending resets to ascending, priority2. Sort and Columns
  editors open/close, and the multi-level controls remain present.
- Voice disclosure mounts in BODY for ordinary fields, in the column-menu DOM
  for header filtering, and in native DIALOG for universal search. Actual
  elementFromPoint confirms Start and Cancel are the hit targets, not the dock.
  Cancel preserves the page URL. First Escape closes voice only; second Escape
  closes the containing column menu. Native search remains open after voice Escape.
  Desktop panel is viewport-clamped near the field; mobile panel clears the dock.
- Opened an existing reservation's Notes editor and microphone disclosure; Cancel
  retained the exact original note and Confirm/save stayed disabled. No hotel
  data was saved. Browser recognized the speech API, but Start was never activated.
- Dock opacity .48 idle and1 on hover/focus; activation switches bottom to left;
  actual mouse drag returns it to bottom. Expanded sidebar remains unchanged.
  No browser console errors were observed in this QA tab. Physical Android touch,
  permission grant and real-audio transcription accuracy were not tested.

Final screenshots: D:/Yellow/temp/order708-final-mobile.png,
order708-final-disclosure.png and order708-final-desktop.png. Reviewed visually against the supplied screenshot
and the original toolbar baseline. The in-app browser's host scaling affects
captured physical pixels; reported viewport/target sizes are measured CSS pixels.

Evidence outside the repo: D:/Yellow/temp/order708-before.png,
order708-after.png and order708-disclosure.png. Early screenshots are failure/
intermediate evidence, not proof of final release. Browser CSS viewport checks
are not physical Android touch or microphone-quality tests.

## Local versus live audit

voice_field_audit inspected the actual container /app/src and serving checkout
D:/Yellow/git-live-order611-source-v2. All225 backend TypeScript files matched by
SHA256:225 identical, zero missing/extra/mismatched (including five untracked files
already in the container). A dirty Git tree does not imply undeployed functionality.
The generated frontend difference was this Order708 update, not a second backend.

EcosystemHub is reachable and operational cards already route to their workspaces.
No fully ready hidden UI module was found to switch on. Preview/planned/blocked
cards remain explicitly non-operational. Order705's local JSON intake is deliberately
a CLI receiver, with no API/UI/DB consumer or scheduler; it is not a ready live module.
Order704 is calendar research, not a completed replacement calendar.

The next useful incomplete integration is new guest-profile creation: existing
backend create/duplicate machinery and integration tests exist, while the active
React booking flow searches/attaches existing profiles. A governed create form,
explicit duplicate review and exact receipt/readback reconciliation remain to be
implemented and independently proved. It is not reported as live or complete.

## Release boundary

No backend API, migration, provider activation, application-side model/API integration, new stack, database
change, deletion, repository cleanup, commit/PR or full-ecosystem completion in this
order. Existing /ready503 build_revision_unavailable is outside this frontend scope.
Rollback707 remains available. Public tunnel remains temporary:
https://faq-lift-iso-completely.trycloudflare.com/ ; local http://localhost:3010/.
