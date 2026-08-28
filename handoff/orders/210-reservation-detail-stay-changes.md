# Order 210 — Reservation-detail stay changes

**Status:** READY-D563 — intentional red required before implementation
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/reservation-detail-stay-changes`
**Base:** `ae54d44` (built-unreviewed Order209)
**Risk tier:** 2 — UI routing over already-governed segment mutations
**Owner:** Codex implementation; independent product review deferred under founder build-first direction

## Outcome

The canonical reservation-detail drawer offers one **Stay changes** action. It loads
the existing authoritative segment history for that exact reservation and exposes
the already-governed departure-change and room-move controls without forcing an
operator to leave the reservation, copy a confirmation number, or use a detached
advanced lookup.

## Fixed contract

- The drawer action is presentation only. It sets the exact loaded confirmation into
  the existing segment lookup, performs the existing no-store segment GET, and moves
  the existing segment editor into the current detail action region.
- The latest server segment's `actions.canChangeDeparture` and `actions.canMoveRoom`
  remain the sole control-visibility truth. The client never infers permission,
  occupancy, timing, assignment or move eligibility.
- Existing PATCH departure and POST move endpoints, request shapes, idempotency keys,
  PostgreSQL arbitration, confirmation semantics and server errors are unchanged.
- A request generation plus property/reservation/confirmation guards prevent stale
  segment results or focus from painting into a later drawer. Close, property change,
  sign-out and a different reservation invalidate the request and restore the editor
  to its inert home.
- Loading, success, error and retry are announced in the current drawer. Successful
  segment commands refresh both segment truth and reservation detail before focus is
  restored to the current Stay changes panel.
- The legacy exact-confirmation lookup remains available only in its existing inert
  home and is not exposed as a second workflow.

## Exact scope

- this order and `tests/operator-reservation-detail-stay-changes.intentional-red.test.ts`
- `src/http/operator/operator.js` and minimal `src/http/operator/operator.css`
- new `tests/operator-reservation-detail-stay-changes.integration.test.ts` and
  `tests/operator-reservation-detail-stay-changes-ui.integration.test.ts`
- focused additions to `tests/operator-reservation-workspace.integration.test.ts`
  and `tests/operator-reservation-segments.integration.test.ts` only if necessary
- the Order210 section in `docs/UI-SPEC.md`
- Phase-6-only wording in `BUILD-PLAN.md` and `handoff/PHASE-6-PLAN.md`
- `DECISIONS.log`, `handoff/LEDGER.md`, and a question only if proof requires a real
  scope correction

No HTML, API/domain/context, migration, permission, seed, dependency, route, event,
local, schema or product-state authority change is admitted.

## Required work

1. Commit the intentional red before implementation.
2. Add one semantic Stay changes drawer action and reuse the existing segment editor.
3. Add exact request-generation, identity, lifecycle and focus guards.
4. Preserve existing endpoint/method/body/idempotency and server-action gating.
5. Refresh canonical detail after a successful command without duplicate mutation.
6. Preserve 44px controls, Android 48px, 375px/200%-zoom containment, visible focus,
   reduced motion, forced colours and all six current appearances.

## Forbidden

- new segment API/domain behavior, inferred eligibility, automatic write, timer,
  polling, browser storage, destination invention or changed confirmation rule
- stale response/focus, detached-DOM focus, nested forms, second editor or exposed
  confirmation-number lookup
- HTML/permission/migration/seed/dependency/local promotion, second local, merge,
  push, deployment, Phase6 or app-complete claim

## Pre-registered proof

- **P0 red:** drawer Stay changes action, guarded detail integration and refresh are absent.
- **P1 routing:** one current-detail action loads only the exact current confirmation.
- **P2 authority:** server action flags alone expose forms; existing methods/bodies/
  keys/endpoints are byte-equivalent and no automatic mutation exists.
- **P3 stale/lifecycle:** late result after close/property/sign-out/different detail
  cannot paint or focus; editor returns to inert home.
- **P4 command refresh:** success refreshes exact segment and detail truth once;
  failure retains retry-safe key and current focus.
- **P5 UX:** semantic controls, announcements, 44/48px targets, narrow/zoom
  containment, focus, forced colours, reduced motion and every appearance are green.
- **P6 standing:** focused segment/detail tests, JS/type/boundary/licence/audit/diff,
  full suite, schema and fresh referee11/11 remain green.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Exact current-detail stay changes are usable without copied identifiers.
- [ ] Server authority and governed mutation semantics are unchanged.
- [ ] Stale paint/focus and detached editor states fail closed.
- [ ] Result is built-unreviewed without approval, Phase6/app completion, local
  promotion, merge, push or deployment.
