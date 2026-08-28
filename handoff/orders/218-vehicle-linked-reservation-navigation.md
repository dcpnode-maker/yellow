# Order 218 — Vehicle linked-reservation navigation

**Status:** READY-D579 — intentional red must precede implementation
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/vehicle-linked-reservation-navigation`
**Base:** `3efaaf7` (built-unreviewed Order217)
**Risk tier:** 2 — UI-only composition of existing exact reads
**Owner:** Codex implementation; independent product review remains deferred by founder build-first direction

## Outcome

An operator viewing an exact Order216 vehicle detail can follow its already-validated
non-null reservation association into the existing canonical reservation drawer and
return through deterministic browser history. No vehicle, parking, task or reservation
authority is added.

## Fixed contract

- **Open linked reservation** exists only after a successfully validated current
  vehicle-detail row has a canonical non-null `reservationId`. Null/Party-only vehicles
  emit no action.
- The only target is the existing `/p/{property}/res/{reservation}` route and existing
  `openReservationDetail`/`syncReservationRoute` read flow. The existing
  `reservations.lifecycle:read` endpoint remains the sole server authority, including
  its existing 403 behavior. No new request, endpoint, scope or payload field is added.
- Before navigation, recheck the active Vehicles view, exact property, routed vehicle,
  frozen vehicle-detail vehicle/reservation ids, canonical nested pathname and the
  connected visible panel/action. Any changed or stale identity is inert.
- Exactly one history entry is added. Refresh and Forward reopen existing reservation
  detail; Close, Escape and Back return to exact vehicle detail, refetch authoritative
  vehicle truth and focus its title. A second Back retains Order216's exact register
  URL, filter and cursor behavior.
- This is read-only presentation composition: no POST/PUT/PATCH/DELETE, polling,
  storage, optimistic state, copied authority, vehicle/reservation/Party mutation or
  onsite/access/parking inference.
- The semantic action is at least 44px, Android 48px, wraps at 375px/200% zoom and has
  visible focus, forced-colour and reduced-motion containment across Apple iOS,
  Android, Windows 95/98, glassmorphism, neomorphism and ERP.

## Exact scope

- this order and its intentional-red test;
- `src/http/operator/operator.js` and focused styles in `operator.css`;
- focused route/history/stale/authority and six-appearance tests;
- Order218 section in `docs/UI-SPEC.md`, `BUILD-PLAN.md`, `handoff/PHASE-6-PLAN.md`;
- `DECISIONS.log` and `handoff/LEDGER.md`.

No HTML, API/adapter/domain/context, contract/security, schema/migration/seed,
dependency, scope/event or local promotion/deployment file is admitted.

## Pre-registered proof

- **P0 red:** linked-reservation action/helper is absent.
- **P1 gating:** only current canonical non-null association emits a semantic action.
- **P2 transport:** exact existing reservation route/read transport and server 403 remain unchanged.
- **P3 history:** refresh, Back/Forward, Close/Escape, vehicle-detail return then register return are exact.
- **P4 containment:** property/vehicle/reservation/path/view/panel/generation mismatches are inert.
- **P5 UX:** six appearances, 375px/200% zoom, focus, forced colours and reduced motion are explicit.
- **P6 standing:** Order216/reservation regressions plus type/boundary/licence/audit/JS/diff/schema/referee remain green.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Only the exact validated linked reservation is navigable.
- [ ] Existing reservation authority and vehicle/register history remain unchanged.
- [ ] Six-appearance and accessibility containment is green.
- [ ] Standing gates are green and result is recorded built-unreviewed.

