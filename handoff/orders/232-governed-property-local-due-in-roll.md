# Order 232 — Governed property-local due-in roll

**Status:** ACTIVE-POLICY-CORRECTED-D612
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/governed-property-local-due-in-roll`
**Base:** `922c8a9` (built-unreviewed Order231)
**Risk tier:** 3 — reservation lifecycle transition and time-bound worker evidence
**Owner:** Codex implementation; independent high-risk review remains deferred by founder build-first direction

## Outcome

An ordinarily committed `reserved` reservation reaches the canonical `due_in` state
exactly when its database-derived property-local business date equals its current
arrival date. The bounded server worker performs the already-recorded transition and
emits the existing `reservation.due_in` evidence once, so Today and the governed
check-in journey become reachable without fixture or operator database intervention.

## Fixed policy

- Admission is database-derived from one active tenant/property scope, its exact
  transaction-stable property-local calendar business date and one coherent
  `reserved` reservation whose latest current `booked` segment begins on that same
  local date. Browser or process wall-clock arithmetic is never authoritative. The
  expression is the same PostgreSQL property-timezone derivation used by `recordFact`.
- Only the reservation parent `reserved -> due_in` transition is admitted. The exact
  current segment must remain `booked`: that is the canonical coherent arrival shape
  and the only segment state accepted by the later check-in transition.
- The roll reuses the existing `reservation.due_in` event, fact/outbox/idempotency and
  actor/correlation/causation conventions. No table, event, permission or browser
  command is added.
- A bounded worker discovers only currently due property scopes, processes a bounded
  batch, is restart-safe and supports deterministic one-cycle execution. Startup,
  shutdown and disabled-state behavior follow the existing worker composition.
- Exact rerun is a no-op. Concurrent workers and twenty contenders converge to one
  parent/segment transition and one fact/outbox effect. Publication or evidence
  failure rolls back the whole transition before an exact retry succeeds.
- Future arrivals, already-past missed arrivals, foreign properties, incoherent or
  absent current segments, and every non-`reserved` parent state fail closed without
  mutation. No no-show, due-out, check-in, checkout or repair inference is admitted.
- Success becomes visible through the existing Today due-in lane, reservation detail
  and check-in readiness. This order adds no new operator control or automatic
  check-in.

## Exact scope

- this order and focused intentional-red/domain/worker/server-wiring tests;
- `src/contexts/reservations/arrival-roll.ts`, `src/contexts/reservations/index.ts`;
- `src/workers/postgres-due-arrival-scopes.ts` and `src/server.ts`;
- `migrations/0034_runtime_due_arrival_scopes.sql` for one bounded read-only
  `yellow_runtime` scope-discovery function only;
- `src/app.ts` and project-status response/tests only if the existing worker-health
  contract requires the exact enabled flag already exposed for sibling workers;
- existing reservation lifecycle/idempotency/fact/outbox interfaces only where a
  narrow reuse or export is required;
- `scripts/seed-review.ts` only if a real committed reserved-arrival fixture is needed
  for deterministic end-to-end proof;
- directly affected reservation lifecycle, worker wiring, database authority,
  migration/SECURITY-DEFINER/schema, review-seed, Today, reservation-detail and
  check-in regression tests;
- `tests/schema/expected.sql`, migration/database-acceptance/runtime-DML/
  SECURITY-DEFINER containment manifests, and `setup.sh` only for exact migration
  count/name text if required;
- relevant contract/event/state/domain/security/operator documentation;
- Phase-6 entries in `BUILD-PLAN.md`, `handoff/PHASE-6-PLAN.md`, this order,
  `DECISIONS.log` and `handoff/LEDGER.md`.

`migrations/0001_init.sql` remains immutable. Executable preflight proved app-role
already owns only the exact reservation status-column update needed, while
`yellow_runtime` cannot read reservation/property tables and can execute only
owner-mediated discovery. Migration0034 therefore adds solely one stable bounded
fixed-search-path function that returns due tenant/property scopes; PUBLIC/app-role
execution and direct runtime table reads remain denied.

## Forbidden

- browser, caller or process wall clock deciding property business date;
- broad lifecycle repair, past-arrival catch-up, no-show, due-out or day-close logic;
- occupancy, assignment, condition, housekeeping-task, folio, identity, financial,
  statutory, key, document or travel mutation;
- automatic check-in, user-visible transition control or a new API route;
- new table/event/permission/dependency, generic scheduler framework or external job;
- local promotion, merge, push, deployment, Phase-6 or app-complete claim.

## Pre-registered proof

- **P0 red:** arrival-roll domain service, due-scope source, worker composition and
  production `reservation.due_in` emission are absent before implementation.
- **P1 exact date:** a real committed reservation stays `reserved` before arrival and
  rolls once only when the transaction-stable database-derived property-local
  calendar business date equals arrival.
- **P2 containment:** future, past, foreign-property, cancelled, waitlist,
  already-due-in and incoherent segment truth produce no artifact.
- **P3 atomicity:** the parent becomes due-in while the exact current segment remains
  byte-equivalent `booked`, with one minimized `reservation.due_in`
  fact/outbox/idempotency result and no unrelated row change.
- **P4 contention/replay:** rerun and twenty contenders converge to one transition and
  one evidence effect.
- **P5 rollback:** injected fact/publication failure leaves parent, segment,
  idempotency, fact and outbox unchanged; exact retry succeeds once.
- **P6 worker:** bounded scope/batch discovery, enabled/disabled server wiring,
  abort/shutdown and one-cycle behavior are executable.
- **P7 journey:** the rolled reservation appears through existing Today due-in,
  reservation-detail and check-in readiness without new UI authority.
- **P8 standing:** focused reservation/check-in/Today regressions plus typecheck,
  boundaries, licence, audit, JavaScript, full suite, exact schema and referee remain
  green.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Property-local due admission is database-authoritative and bounded.
- [ ] Parent transition/evidence is atomic, replay-safe and contention-safe while the
  coherent current booked segment remains unchanged.
- [ ] Existing Today and check-in journeys become reachable from a real commit.
- [ ] Standing gates are green and the result is recorded built-unreviewed.
