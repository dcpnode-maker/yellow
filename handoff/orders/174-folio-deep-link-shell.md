# Order 174 — Folio UUID deep-link shell correction

**Status:** READY
**Phase:** 5
**Branch:** `phase-5/folio-deep-link-shell`
**Base:** `f48428805dae628f8c5b14dd83050375ce4f3f14`
**Risk tier:** 2 — founder-critical served route; no financial-authority change
**Owner:** Codex implementation; independent Order171 reviewer restarts P1–P6

## Trigger and outcome

Independent review stopped the combined Order171/173 candidate because the client emits
`/p/{property}/folio/{uuid}` while the server shell registers only
`/p/{property}/folios`. Clicking a normal folio or directly refreshing its UUID route
therefore returns `404 text/plain` instead of the authenticated operator shell.

Register exactly the already-specified singular UUID shell route, add a permanent served
regression, and rebuild an immutable candidate for a complete independent Order171
P1–P6 restart. This correction supplies navigation only; all folio data and authority
remain behind the existing authenticated APIs.

## Scope

- `src/app.ts` — add only `/p/:property/folio/:folio` beside the existing shell routes;
- `tests/operator-folio-workspace.integration.test.ts` — permanent Base-red/candidate-
  green shell-route regression and exact neighboring-route assertions;
- this order plus additive `DECISIONS.log` and `handoff/LEDGER.md` evidence;
- Order171/173 governance may be updated only after independent review.

No HTML, CSS, client JavaScript, financial domain/store, API handler, response body,
permission, schema, migration, package, runtime configuration, credential, container or
live port is in scope.

## Pre-registered proof

- **P0:** exact Base plural `/p/{property}/folios` is `200 text/html`, but singular
  `/p/{property}/folio/{uuid}` is `404 text/plain`.
- **P1:** candidate singular route is `200 text/html` and byte-identical to the plural
  shell; root, reservation detail and static assets remain unchanged.
- **P2:** malformed/extra-segment/unknown routes remain `404`; the shell does not read a
  folio, disclose data or grant authority.
- **P3:** served authenticated normal folio navigation and direct refresh keep the UUID
  URL, render the statement workspace and issue only the existing protected API reads.
- **P4:** focused tests, full suite, typecheck, boundaries, licenses, audit, exact schema
  and fresh referee 11/11 pass.
- **P5:** the non-implementing reviewer restarts the complete Order171 P1–P6 oracle on
  the new immutable candidate; no stopped evidence is reused as approval.

## Definition of done

- [ ] P0 is reproduced on exact Base.
- [ ] P1–P4 pass with a permanent served regression.
- [ ] Independent reviewer executes and approves the complete Order171 P1–P6 restart.

## Forbidden

Catch-all SPA fallback, redirect that drops the UUID, client-only assertion, weakening
404 behavior, unauthenticated folio data, route/body/API/finance changes, stale proof
reuse, scope widening, live-port replacement, merge, push or deployment.
