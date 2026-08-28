# Order 224 — Reservation-to-Folio return continuity

**Status:** READY-D591 — intentional red must precede implementation
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/reservation-folio-return-continuity`
**Base:** `f70d69e` (built-unreviewed Order223)
**Risk tier:** 2 — UI-only repair of existing reservation-detail Folio navigation
**Owner:** Codex implementation; independent product review remains deferred by founder build-first direction

## Outcome

Opening an existing Folio or a successfully resolved primary Folio from canonical
reservation detail can return to that exact authoritative reservation journey. The
visible Folio Back action no longer discards context or focuses a disconnected trigger.

## Fixed contract

- Only an exact current connected reservation-detail Folio control or the exact
  current successful primary-Folio command receipt may create a minimized frozen
  return descriptor. Bind kind/source, property, reservation id, confirmation/status,
  folio id, canonical origin path/workbench intent and detail generation.
- Existing-Folio origin rechecks the connected visible button and exact Folio list;
  primary-receipt origin rechecks command generation/identity and validated response.
- Opening reuses the existing canonical Folio route/read and exactly one history entry.
  The minimized descriptor lives only in that state; no storage, polling or new request.
- A current descriptor changes visible copy to **Back to reservation**. Order222's
  exact **Back to departure** takes precedence; direct/non-reservation opens remain
  **Back to folio lookup**.
- Back, Escape and browser Back/Forward/refresh retain dirty-exit confirmation, reopen
  the exact canonical reservation/workbench, refetch authoritative detail and restore
  the matching Folio button or Folios heading when the source no longer exists.
- Every property/reservation/confirmation/status/folio/path/view/drawer/workbench/
  generation/source mismatch is inert. Navigation runs no command and infers no
  financial, checkout, readiness, balance or occupancy meaning.
- The contextual control is at least 44px, Android 48px and supports all six current
  appearances, 375px/200% zoom, visible focus, forced colours and reduced motion.

## Exact scope

- this order and its intentional-red/focused navigation/UI tests;
- `src/http/operator/operator.js` and focused `operator.css` styles;
- only truly superseded reservation/Folio navigation expectations;
- reservation/Folio continuity in `docs/UI-SPEC.md`;
- Phase-6 entries in `BUILD-PLAN.md` and `handoff/PHASE-6-PLAN.md`;
- `DECISIONS.log` and `handoff/LEDGER.md`.

No HTML, API/adapter/domain/context, financial command, permission, schema/migration/
seed, dependency, scope/event, local promotion/deployment file is admitted.

## Pre-registered proof

- **P0 red:** `reservationFolioReturnIsCurrent`, `openReservationFolioWorkspace`,
  `returnFromFolioWorkspaceToReservation` and `.folio-reservation-return` are absent.
- **P1 origin:** existing button and successful primary receipt create only exact frozen descriptors.
- **P2 containment:** the complete identity/route/view/generation/source mismatch matrix is inert.
- **P3 history:** one entry; Back/Escape/refresh/Forward refetch and restore safe focus.
- **P4 compatibility:** dirty cancel, Order222 departure and direct Folio lookup remain exact.
- **P5 UX:** six appearances, 44/48px, 375px/200%, focus, forced colours and reduced motion.
- **P6 standing:** reservation detail/primary Folio/Folio/Order222 plus static/full gates remain green.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Both exact reservation origins round-trip through the canonical Folio route.
- [ ] Dirty-exit, departure and direct-Folio compatibility remain exact.
- [ ] Focused and standing gates are green and result is recorded built-unreviewed.
