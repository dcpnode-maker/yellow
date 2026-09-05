# Order 211 — Reservation-detail guest allocation

**Status:** BUILT-UNREVIEWED-D566 — implementation and required executable gates green
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/reservation-detail-guest-allocation`
**Base:** `0a58cc8` (built-unreviewed Order210)
**Risk tier:** 2 — UI routing over the already-governed reservation guest command
**Owner:** Codex implementation; independent product review deferred under founder build-first direction

## Outcome

The canonical reservation-detail drawer offers one **Guests & shares** action. It
loads the existing authoritative guest occurrence/allocation for that exact
reservation and hosts the existing audited allocation editor without copied
confirmation numbers or a detached advanced lookup.

## Fixed contract

- The drawer action is presentation only. It sets the exact loaded confirmation into
  the existing guest lookup, performs the existing no-store guest GET, and moves the
  one existing guest editor into the current detail action region.
- The primary Party/role remains server-owned and immutable. Accompanying guests
  carry no share; explicit primary plus sharer basis-point percentages must total
  exactly 100.00 when sharers exist. The client does not invent identity, remainder,
  role, folio ownership or financial allocation.
- The existing PUT endpoint, request body, actor-bound idempotency, validation,
  facts/events and no-op semantics are unchanged.
- A request generation plus property/reservation/confirmation guards prevent stale
  guest results or focus from painting into a later drawer. Close, property change,
  sign-out and a different reservation invalidate the request and restore the editor
  to its inert home.
- Stay changes and Guests & shares are mutually exclusive presentation panels. Each
  restored editor returns to its own existing inert home; no editor is cloned.
- Loading, success, error and retry are announced in the current drawer. A successful
  guest command refreshes authoritative detail and guest allocation exactly once
  before focus returns to the current Guests & shares panel.

## Exact scope

- this order and `tests/operator-reservation-detail-guest-allocation.intentional-red.test.ts`
- `src/http/operator/operator.js` and minimal `src/http/operator/operator.css`
- new `tests/operator-reservation-detail-guest-allocation.integration.test.ts` and
  `tests/operator-reservation-detail-guest-allocation-ui.integration.test.ts`
- focused additions to `tests/operator-reservation-workspace.integration.test.ts`
  only if needed for executable stale/transport regression proof
- the Order211 section in `docs/UI-SPEC.md`
- Phase-6-only wording in `BUILD-PLAN.md` and `handoff/PHASE-6-PLAN.md`
- `DECISIONS.log`, `handoff/LEDGER.md`, and a question only if proof requires a real
  scope correction

No HTML, API/domain/context, migration, permission, seed, dependency, route, event,
local, schema or product-state authority change is admitted.

## Required work

1. Commit the intentional red before implementation.
2. Add one semantic Guests & shares drawer action and reuse the existing guest editor.
3. Add exact request-generation, identity, lifecycle, mutual-exclusion and focus guards.
4. Preserve existing endpoint/method/body/idempotency and server-owned primary truth.
5. Refresh canonical detail and guest allocation exactly once after successful PUT.
6. Preserve 44px controls, Android 48px, 375px/200%-zoom containment, visible focus,
   reduced motion, forced colours and all six current appearances.

## Forbidden

- new guest API/domain behavior, inferred identity/share/remainder/role, automatic
  write, timer, polling, browser storage, Party creation or financial allocation
- stale response/focus, detached-DOM focus, nested forms, second editor or exposed
  confirmation-number lookup
- HTML/permission/migration/seed/dependency/local promotion, second local, merge,
  push, deployment, Phase6 or app-complete claim

## Pre-registered proof

- **P0 red:** drawer Guests & shares action, guarded integration and detail refresh are absent.
- **P1 routing:** one current-detail action loads only the exact current confirmation.
- **P2 authority:** one existing editor preserves primary/role/share and exact PUT transport.
- **P3 stale/lifecycle:** late results after every drawer identity boundary cannot paint/focus.
- **P4 command refresh:** success refreshes detail and guest truth once; failure retains key.
- **P5 coexistence/UX:** guest/stay panels restore mutually, contain and remain accessible.
- **P6 standing:** focused, JS/type/boundary/licence/audit/diff, full suite, schema and
  fresh referee11/11 remain green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact current-detail guest allocation is usable without copied identifiers.
- [x] Governed mutation and server-owned primary semantics are unchanged.
- [x] Stale paint/focus and detached editor states fail closed.
- [x] Result is built-unreviewed without approval, Phase6/app completion, local
  promotion, merge, push or deployment.
