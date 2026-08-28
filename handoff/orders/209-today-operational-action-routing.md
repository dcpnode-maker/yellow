# Order 209 — Today operational action routing

**Status:** READY-D561 — intentional red committed before implementation
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/today-operational-action-routing`
**Base:** `8004f1f` (built-unreviewed Order208)
**Risk tier:** 2 — human routing adjacent to governed check-in and checkout
**Owner:** Codex implementation; independent product review deferred under founder build-first direction

## Outcome

Today due-in cards offer **Prepare check-in** and due-out cards offer **Prepare
checkout**. Each action deep-links into the already governed reservation workbench,
restores through browser navigation and focuses the authoritative readiness result.
In-house cards receive no inferred operational action.

## Fixed routing policy

- Due-in action exists only when both lane and row status are exact `due_in`, routing
  to `/p/{property}/res/{reservation}?workbench=check-in`.
- Due-out action exists only when both lane and row status are exact `due_out`, routing
  to `/p/{property}/res/{reservation}?workbench=checkout`.
- In-house, mismatched and unknown lane/status combinations return no action. Travel,
  room, folio and readiness evidence are never consulted to invent one.
- Reservation-detail presentation accepts zero or exactly one `workbench` value from
  `check-in|checkout`. Duplicate, empty, unknown or extra query keys canonicalize to
  the plain detail URL with `history.replaceState`; this changes no product truth.
- Refresh, Back, Forward and same-reservation query-only navigation reapply the exact
  presentation intent. The current intent is tracked separately from reservation id.
- After authoritative detail loads, check-in intent is compatible only with `due_in`;
  checkout intent is compatible with the existing domain-legal `in_house|due_out`.
  This never creates a Today CTA for in-house rows.
- Incompatible or stale status removes the query, keeps plain detail open, announces
  the fallback, focuses the detail drawer and performs no command.
- Compatible intent calls existing readiness GET flows and focuses their existing
  headings only after the current guarded request settles. Error focus lands on the
  existing refresh/retry control. Existing explicit confirmation remains mandatory
  for every POST.

## Exact scope

- `handoff/orders/209-today-operational-action-routing.md`
- `src/http/operator/operator.js` and minimal `src/http/operator/operator.css`
- new `tests/operator-today-operational-routing.intentional-red.test.ts`,
  `tests/operator-today-operational-routing.integration.test.ts`, and
  `tests/operator-today-operational-routing-ui.integration.test.ts`
- focused additions to `tests/operator-today-command-centre.integration.test.ts` and
  `tests/operator-reservation-workspace.integration.test.ts` only where needed for
  route/history/focus regression proof
- Today-routing section in `docs/UI-SPEC.md`
- Phase-6 only in `BUILD-PLAN.md` and `handoff/PHASE-6-PLAN.md`
- this order, a question only if executable proof requires scope correction,
  `DECISIONS.log`, and `handoff/LEDGER.md`

No HTML, API, domain/context, migration, dependency, permission, seed, route, local,
event or product-state change is admitted.

## Required work

1. Commit P0 intentional red before implementation.
2. Add one pure lane/status-to-action helper and strict detail workbench query parser.
3. Carry workbench intent through detail open, route parsing, refresh, popstate and
   same-reservation query changes with all existing stale guards.
4. Render one semantic bounded CTA on exact due-in/due-out Today cards only; preserve
   the existing confirmation-number detail action and stable return focus.
5. Apply compatible intent only after authoritative detail, focus current readiness
   success/error targets, and canonicalize incompatible intent without mutation.
6. Preserve 44px controls, Android 48px, 375px/200%-zoom containment,
   reduced-motion, forced-colour and all supported appearances.

## Forbidden

- POST/automatic confirmation, new idempotency key, background polling, browser
  storage, timer, inferred readiness/action or changed check-in/checkout authority
- action on Today in-house/mismatched/unknown rows, travel/room/folio inference,
  stale response paint/focus or detached-DOM focus
- API/domain/HTML/permission/migration/seed/dependency/local promotion, second local,
  merge, push, deployment, Phase-6 or app-complete claim

## Pre-registered proof

- **P0 red:** exact labels/queries, pure action helper, strict workbench parser,
  same-id query routing and async intent application are absent.
- **P1 pure routing:** exact lane/status truth table and query allowlist/canonical
  fallback are green.
- **P2 Today rendering:** one due-in/check-in and due-out/checkout CTA, none in-house
  or mismatch, unchanged counts/order and no evidence inference.
- **P3 navigation:** click/push, refresh, Back/Forward, same-id query change, close and
  stable Today focus restoration are exact.
- **P4 async/fallback:** current detail/readiness guards, success/error focus and
  incompatible-status plain-detail fallback are mutation-free.
- **P5 safety:** no new endpoint/scope/API/domain/migration/seed; CTA causes no POST,
  storage, timer or confirmation bypass.
- **P6 UX:** semantic 44/48px controls, 375px/200%-zoom containment, visible focus,
  reduced motion, forced colours and every appearance remain green.
- **P7 standing:** focused Today/detail/check-in/checkout, JS/type/boundary/licence/
  audit/diff/full suite, schema and fresh referee11/11 remain green.

## Definition of done

- [x] Intentional red precedes implementation.
- [ ] Exact Today actions route without inferring or mutating product truth.
- [ ] Refresh/history/same-id query and stale fallback remain exact.
- [ ] Readiness focus is current, accessible and confirmation-gated.
- [ ] Result is built-unreviewed without approval, Phase6/app completion, local
  promotion, merge, push or deployment.
