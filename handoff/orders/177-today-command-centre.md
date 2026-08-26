# Order 177 — Today command centre

**Status:** IN PROGRESS
**Phase:** 5 · founder-visible operations
**Branch:** `phase-5/today-command-centre`
**Base:** `e13b83d` (independently approved Order176)
**Risk tier:** 2 — bounded read-only composition over existing reservation APIs
**Owner:** Codex implementation; independent UI/accessibility review

## Outcome

Give an authenticated hotel operator a truthful, fast Today surface with three
independently loading property-local lanes: Due in, Due out and In house. The page
must reuse the approved bounded reservation board and UUID detail authority, never
invent totals or mutation controls, and remain usable from Simple through Expert.

## Scope

- `src/app.ts` — add the static `/p/:property/today` shell route;
- `src/http/operator/index.html`, `operator.js`, and `operator.css` — Today navigation,
  semantic lanes, bounded loading/pagination, stale-response guards and responsive UI;
- `tests/operator-today-command-centre.integration.test.ts`;
- this order, additive D-453, `handoff/LEDGER.md`, and one independent review.

No new API, database query, command, schema, migration, event, permission, credential,
dependency, timer, polling, browser persistence, external asset, public bind, check-in,
checkout, room assignment, payment, tax, fiscal, housekeeping, merge, push, promotion
or deployment is in scope.

## Required experience

1. Today is the first Front desk workspace and deep-links at `/p/:property/today`.
2. The header names the property-local date/timezone and explicitly states that the
   bounded pages are not hotel-wide totals.
3. Due in, Due out and In house each call only the existing reservation-board GET
   with exact `status`, paired property-local `[from,to)`, `limit=50` and optional
   cursor. Each lane owns loading, empty, error, retry and Load older state.
4. Page length is labelled as shown records; `nextCursor` is labelled only as more
   records available. No aggregate occupancy or arrival/departure count is inferred.
5. Property, active route, local-day window and per-lane generations prevent stale
   responses from painting. Property switching resets all lane state.
6. Reservation rows use existing safe board fields and open the existing UUID detail
   flow. Returning from detail restores Today and keyboard focus.
7. All themes/detail levels preserve 44px targets, visible focus, reduced motion,
   200% zoom and zero document overflow at 375/768/1024/1440.

## Proof

- focused static/served tests for route, semantic lanes, exact GET-only query shape,
  bounded cursor copy, stale guards and forbidden mutation/persistence/polling paths;
- property-timezone and DST-sensitive local-day boundary tests without claiming
  PostgreSQL business-date authority;
- real Browser proof for responsive containment, keyboard/focus, error/empty/retry,
  independent pagination and UUID detail return;
- existing reservation/folio/adaptive-shell suites, standing tests, typecheck,
  boundaries, licences, audit, gzip and fresh referee 11/11;
- independent non-implementing reviewer executes the Browser proof.

## Definition of done

- [ ] Today is a truthful, bounded operational command centre over existing reads.
- [ ] Three lanes fail and paginate independently without stale paint or false totals.
- [ ] Existing reservation creation, detail and folio journeys remain unchanged.
- [ ] Complete repository and real-Browser gates pass.
- [ ] Independent review approves the immutable candidate.
