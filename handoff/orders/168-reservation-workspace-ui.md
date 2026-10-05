# Order 168 — Reservation workspace UI

**Status:** APPROVED — independent review at `ca024eee`
**Phase:** 5 · founder-visible operations
**Branch:** `phase-5/reservation-workspace-ui`
**Base:** `0e88417` (independently approved Order166 candidate)
**Risk tier:** 2 — operator UI over existing governed reservation APIs
**Owner:** Codex implementation; independent UI/accessibility review

## Outcome

Replace the long reservation-form page with a fast operational reservation workspace:
a bounded reservation board, non-PII filters, guided four-step booking, and a
deep-linked read-only reservation drawer. Preserve the already-proven create and
lifecycle authority exactly; expose only actions the server truthfully authorizes.

## Scope

- `src/http/operator/index.html`, `operator.js`, and `operator.css`;
- the HTML-shell deep-link route in `src/app.ts` only;
- additive reservation-workspace/operator asset tests;
- this order, additive D-435, `handoff/LEDGER.md`, and one additive review;
- exact integration of the independent Order166 review evidence before this order is
  declared reviewable.

No schema, migration, database query, domain command, event, permission, role,
credential, dependency, public bind, payment, fiscal, folio-creation, tax,
check-in/check-out, merge, push or local replacement is in scope.

## Required experience

1. Reservations opens on a bounded board with one primary **New reservation** action,
   exact server statuses, stay-overlap filters and cursor-based **Load older**. Guest,
   contact and confirmation data never enter GET query strings.
2. Creation is a four-step inline flow — Stay, Guest, Offer, Review & book — composed
   from the existing Party, availability, hold and commit calls. Back preserves input;
   validation focuses the first exact error; a 409 retains Stay/Guest and returns to
   Offer; success refreshes the board and opens the returned reservation.
3. `/p/:property/res/:uuid` opens a nonmodal read-only detail drawer containing only
   the approved aggregate. Browser Back, Escape and close restore the board and focus;
   property switching invalidates stale list/detail work. Lifecycle actions are
   rendered only from server-provided flags and existing handlers.
4. Loading, empty, stale/error, forbidden, not-found and conflict states are explicit
   and recoverable. Status is never conveyed by color alone. No client timer, storage
   or inferred transition becomes authority.
5. At 375/768/1024/1440 widths the page has no horizontal overflow, uses semantic cards
   on narrow screens and a dense table on desktop, keeps 44px targets and the existing
   visible focus treatment, supports keyboard j/k/Enter/Escape outside text controls,
   and honors reduced motion and 200% zoom.
6. No framework, font, icon or animation dependency is added. Combined gzipped
   operator HTML/CSS/JS stays at or below 90 KiB; bounded board rendering never exceeds
   100 rows per page; cached row/drawer interaction-to-paint target is under 100ms.

## Proof

- focused asset, workbench, booking and new reservation-workspace suites;
- served board default/filter/empty/two-page cursor and direct deep-link shell;
- detail/property-switch stale-response denial and generic 403/404 handling;
- served Party → offer → commit success plus 409 recovery/idempotency proof;
- browser walkthrough at 375/768/1024/1440 including Back/focus/keyboard/zoom/reduced
  motion/accessibility tree/contrast/target sizes and zero page overflow;
- gzip budget/dependency invariance, full standing tests, typecheck, boundaries,
  licences, audit, schema/protected hashes and fresh referee 11/11.

## Definition of done

- [x] Order166 is independently approved and its review evidence is integrated.
- [x] The complete reservation board/create/detail human journey works against real APIs.
- [x] Accessibility, responsive, performance and full repository gates pass.
- [x] Independent review approves the immutable candidate before local promotion.

## Independent review

Approved by an independent non-implementing OpenAI Codex reviewer at immutable candidate
`ca024eeeebe6560e3e7983c155ee2b344beb1c1d`. See
`handoff/reviews/168-reservation-workspace-ui.md` for exact served, Browser, gate,
referee, rejected-predecessor and incident evidence. Approval does not authorize merge,
push, local founder-stack replacement or production deployment.
