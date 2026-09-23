# Order 222 — Departure-to-Folio return continuity

**Status:** BUILT-UNREVIEWED-D588
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/departure-folio-return-continuity`
**Base:** `c70b1c5` (built-unreviewed Order221)
**Risk tier:** 2 — UI-only repair of existing checkout-readiness to Folio navigation
**Owner:** Codex implementation; independent product review remains deferred by founder build-first direction

## Outcome

An operator who opens governed Folio controls from the existing departure-readiness
workbench can return to the exact reservation checkout journey. The visible Back action,
Escape and browser history no longer discard reservation context or focus hidden UI.

## Fixed contract

- Only a successfully validated current departure Folio card can create a return
  descriptor. Bind exact property, reservation id, confirmation number, reservation
  status, checkout workbench, folio id, readiness/detail generations and canonical
  origin path. No new authority or financial meaning is inferred.
- Opening reuses the existing canonical Folio route/read and adds exactly one history
  entry. The Folio page may carry only this minimized descriptor in history state; no
  browser storage or polling is admitted.
- Before open or return, recheck current property/reservation/folio/path/view/drawer/
  workbench/card/generation identity. Stale identity is inert. Direct Folio lookup and
  non-departure Folio opens retain their existing Back-to-lookup behavior.
- A contextual visible action says **Back to departure** only while an exact descriptor
  is current. It, Escape and browser Back return to the same canonical reservation with
  `?workbench=checkout`, refetch existing reservation detail and checkout readiness,
  then focus the matching Folio card or departure heading when the card no longer exists.
- Refresh and Forward reconstruct only a validated same-history descriptor. Dirty Folio
  confirmation remains mandatory; cancelling it changes neither URL nor focus.
- No POST/PUT/PATCH/DELETE is run by navigation. Existing Folio writes, readiness,
  checkout confirmation, server grants, 403/404/409 outcomes and immutable finance
  rules remain unchanged.
- The contextual control is at least 44px, Android 48px, wraps at 375px/200% zoom and
  has visible focus, forced-colour and reduced-motion containment across all six appearances.

## Exact scope

- this order and its intentional-red test;
- `src/http/operator/operator.js` and focused `operator.css` styles;
- focused departure/Folio return state, stale/history/focus/direct-route and
  six-appearance tests plus existing Orders203/204/219 and Folio regressions;
- `docs/UI-SPEC.md`, `BUILD-PLAN.md`, `handoff/PHASE-6-PLAN.md`;
- `DECISIONS.log` and `handoff/LEDGER.md`.

No HTML, API/adapter/domain/context, financial command, contract/security,
schema/migration/seed, dependency, scope/event or local promotion/deployment file is admitted.

## Pre-registered proof

- **P0 red:** contextual departure-Folio open/current/return helpers are absent.
- **P1 origin:** only exact current readiness Folio truth creates a minimized frozen descriptor.
- **P2 containment:** every property/reservation/confirmation/status/folio/path/view/drawer/workbench/generation/card mismatch is inert.
- **P3 history:** one Folio entry; refresh/Forward validate; Back/Escape/contextual control restore checkout intent and safe focus.
- **P4 compatibility:** direct/non-departure Folio behavior and dirty-exit confirmation are unchanged.
- **P5 UX:** exact contextual copy, six appearances, 375px/200% zoom, focus, forced colours and reduced motion.
- **P6 standing:** Orders203/204/219 and Folio regressions plus type/boundary/licence/audit/JS/diff green.

## Definition of done

- [x] Intentional red preceded implementation.
- [x] Exact departure Folio origin survives only the intended history round trip.
- [x] Back/Escape/history restore authoritative checkout readiness and safe focus.
- [x] Direct Folio and immutable financial controls remain unchanged.
- [x] Standing gates are green and result is recorded built-unreviewed.

## Builder evidence

- Focused Order222 plus Orders203/204/209/219 and Folio regression proof:
  `72 passed, 6 skipped, 0 failed`, 776 assertions.
- Standing suite: `576 passed, 629 skipped, 0 failed`, 6,293 assertions across
  1,205 tests in 216 files.
- Typecheck, 82 import boundaries, 23 dependency licences, audit with zero known
  vulnerabilities, JavaScript syntax and diff checks are green.
- The diff changes no TypeScript server/API/domain/database/schema/migration/seed/
  dependency authority, so the exact inherited Order220 schema/referee evidence is
  unchanged. Independent product review remains deferred by founder build-first direction.
