# Order 667 - Focused single-app continuation

2026-09-23. Status: DEPLOYED; scoped browser proof passed.

## Changes

Live source: `D:/Yellow/git-live-order611-source-v2` (same service as Order666).
No new model infrastructure, paid-provider call, app instance, database operation,
backend change, commit or broad staging. All existing dirty work preserved.

- Reuse the existing API problem parser for room candidates, retaining the
  server's detail/title instead of replacing every failure with a generic message.
- Explain the unique active booked-segment gate without guessing dates or changing
  eligibility. Link the failed room step to the actual stay; show recovery advice.
- Add read-only refresh for detail/readiness/room candidates. Clear old approvals
  and selections; disable while reads or actions are in progress. No write runs.
- Label `roomsAvailable` as Room capacity / occupancy denominator, not rooms left.
  Reporting `operating-performance.ts` divides roomNights by this value; no new
  availability arithmetic was added to the UI.

## Focused proof

Red tests detected the old label, generic error, missing recovery copy and retry.
Green: 12 tests, 93 assertions in order667, order611 Today, order666 hooks and
order620 demo path. Tests exercise actual extracted HTTP/parser/refresh functions
and React static rendering, alongside source wiring checks. Root/frontend
typecheck and 205-file import boundary check passed. Vite build passed.
The initial test import failed root TypeScript because root tests do not enable
JSX; using a runtime import of the real TSX component repaired that harness issue.
Two pre-existing whitespace warnings remain in dirty yellow-api.tsx (713, EOF);
they were not introduced by this order's one-line replacement.

Backend byte comparison before build: 252 local files = 252 running container
files; 0 SHA256 mismatches. Prior working image tagged `before-order667` for rollback.

Independent reviewer `/root/journey_service_research` (GPT-6 Luna) inspected the
scoped edits and personally ran all 12 tests/93 assertions and root/frontend types:
no findings. Parent additionally verified module boundaries and the live browser.
Browser screenshot prompted using the existing checkin-button class for the new
refresh button; that final class-only refinement passed focused5/0 and Vite build.

## Live proof

Same URL: https://lying-jones-terminal-church.trycloudflare.com/
Final image: `sha256:0613de7c82281e033c3f5a8c088120a95a5c1cc1b618780a297aca892ccdba3d`.
Entry `index-Co0daWr9.js`, reservation chunk `ReservationWorkspace-CMt57p7q.js`.
Dirty-tree build remains honestly unknown-revision; no clean-HEAD claim.

In-app browser, default approximately893x683: exact Yellow URL/title, meaningful
render, no framework overlay, no fresh console errors/warnings, screenshots emitted.
Today now shows Room capacity20 / occupancy denominator and14sold/20capacity.
L3R-FU-0024 -> Resolve with Yellow now returns inspected rooms109/110/113/114.
The earlier active-segment blocker is no longer present without any date/data
edit; this supports the earlier temporal diagnosis but is not stored-offset proof.
Select109 (local draft only) -> Refresh clears selection and disables the assignment
confirmation again, retaining reservation as due_in and room unassigned. Final
styled rebuild was reloaded, the flow reopened and refresh re-exercised. No write
button was confirmed. HTTP-error branches were exercised in tests, not by inducing
a live outage. The first case-sensitive button wait missed CSS-uppercase text;
fresh AX then confirmed the correct deployed capacity label.

One application service remains; no second server was launched. Browser left at
the live app. End-to-end successful arrival/folio/checkout and mobile matrix remain
separate acceptance work; the new UI is not represented as completing those flows.

## Search discovery (read-only, GPT-6 Luna)

No completed cross-entity search found in the two known source lineages and
targeted Git history. The future-workbench palette is a static suggestion mock.
Actual Party, reservation-board and cashier searches already exist. History:
0479f980 reservation date search, f038629c availability offer search, 24f82c16
Party-search order metadata. This does not prove absence in every external branch.
Next bounded implementation should compose authorized existing searches behind
one shared UI, preserve per-result access and navigate real records; do not claim
that a guest-only search is universal. No search implementation in this order.

## Remaining boundary

Better recovery UI is not successful check-in proof. Backend eligibility and
earlier unresolved workflow limitations remain. No check-in, assignment, payment,
folio or guest data was changed. Temporary tunnel remains temporary.
