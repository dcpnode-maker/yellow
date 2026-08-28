# Order 225 — Vehicle-register linked-reservation continuity

**Status:** READY-D593 — intentional red must precede implementation
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/vehicle-register-linked-reservation-continuity`
**Base:** `97431da` (built-unreviewed Order224)
**Risk tier:** 2 — UI-only composition of existing exact reads
**Owner:** Codex implementation; independent product review remains deferred by founder build-first direction

## Outcome

An exact current Vehicle Register card with the already-validated same-property
reservation association can open that canonical reservation directly and return to
the exact authoritative register page, filter and cursor with deterministic focus.

## Fixed contract

- Only an exact frozen row in the current successfully rendered Order205 register page
  with a canonical non-null `reservationId` may expose **Open linked reservation**.
  Null and Party-only rows emit no action.
- Before navigation, recheck the active Vehicles view, exact property, canonical
  register path, literal registration filter and cursor, page/request generation,
  frozen row vehicle/reservation identity, connected visible card and enabled action.
  Every mismatch is inert.
- Opening reuses only the existing canonical reservation-detail route/read and adds
  exactly one history entry carrying a minimized frozen return descriptor. No new
  request, endpoint, scope or server payload is admitted.
- Close, Escape and browser Back return to the exact register URL, refetch
  authoritative register truth and focus the same connected linked-reservation action
  or the safe register summary. Refresh and Forward reconstruct the same canonical
  reservation journey.
- Existing **Open vehicle**, vehicle-detail return and Order218 detail-to-reservation
  continuity remain unchanged.
- Navigation is read-only: no POST/PUT/PATCH/DELETE, polling, browser storage,
  optimistic truth, vehicle/reservation/Party mutation or parking/occupancy/onsite/
  access inference.
- The semantic action is at least 44px, Android 48px and supports all six current
  appearances, 375px/200% zoom, visible focus, forced colours and reduced motion.

## Exact scope

- this order and its intentional-red/focused navigation/UI tests;
- `src/http/operator/operator.js` and focused `operator.css` styles;
- only truly superseded vehicle/register/reservation navigation expectations;
- Vehicle Register continuity in `docs/UI-SPEC.md`;
- Phase-6 entries in `BUILD-PLAN.md` and `handoff/PHASE-6-PLAN.md`;
- `DECISIONS.log` and `handoff/LEDGER.md`.

No HTML, API/adapter/domain/context, contract/security, permission, schema/migration/
seed, dependency, scope/event or local promotion/deployment file is admitted.

## Pre-registered proof

- **P0 red:** the exact current-row/open/return helpers and contextual class are absent.
- **P1 admission:** only a frozen row in the exact current page with a canonical linked reservation emits an action.
- **P2 containment:** property/vehicle/reservation/filter/cursor/path/view/page-generation/card/action/DOM mismatches are inert.
- **P3 history:** one entry; Close/Escape/Back/Forward/refresh refetch and restore exact or safe focus.
- **P4 compatibility:** existing Open vehicle, vehicle-detail and Order218 journeys remain exact.
- **P5 authority:** existing read transport only; no write, polling, storage or inferred authority.
- **P6 UX:** six appearances, 44/48px, 375px/200%, focus, forced colours and reduced motion.
- **P7 standing:** vehicle/register/reservation plus static/full gates remain green.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Only the exact current linked register row can open its canonical reservation.
- [ ] History, authoritative refetch, compatibility and focus containment are exact.
- [ ] Focused and standing gates are green and result is recorded built-unreviewed.
