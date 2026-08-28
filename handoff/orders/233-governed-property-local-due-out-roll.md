# Order 233 — Governed property-local due-out roll

**Status:** READY-D614
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/governed-property-local-due-out-roll`
**Base:** `ab49e31` (built-unreviewed Order232)
**Risk tier:** 3 — reservation lifecycle transition and time-bound worker evidence
**Owner:** Codex implementation; independent high-risk review remains deferred by founder build-first direction

## Outcome

An ordinarily checked-in `in_house` reservation reaches canonical `due_out` exactly
when PostgreSQL's transaction-stable calendar date in the property's stored timezone
equals the local departure date of its latest current `in_house` segment. The bounded
server worker changes only the reservation parent, preserves that exact segment
byte-for-byte and records one existing `reservation.due_out` evidence chain, so the
existing Today, reservation-detail and checkout-readiness journeys observe the state
without a new command or automatic checkout.

## Fixed policy

- PostgreSQL is sole clock authority. Discovery and transition derive
  `(transaction_timestamp() AT TIME ZONE property.timezone)::date`; departure is
  `(upper(latest.period) AT TIME ZONE property.timezone)::date`.
- Admission requires an active tenant, exact active property, one `in_house` parent
  and its latest `(seq DESC,id DESC)` current segment also in `in_house`, with exact
  date equality. A later row in any other state makes the candidate incoherent.
- Only the parent changes `in_house -> due_out`. The exact segment, including status,
  period, assignment and sequence, remains byte-equivalent `in_house`.
- The roll reuses the existing `reservation.due_out` event, fact/outbox/idempotency
  and audit conventions. Its minimized payload is reservation id, previous/current
  parent status, segment id, unchanged segment status and property-local date.
- Fixed worker actor is `00000000-0000-0000-0000-000000000058`; the command operation
  is `reservation.departure_roll` and the deterministic key is scoped by property,
  property-local date and reservation.
- A bounded worker discovers only currently due tenant/property scopes, processes a
  bounded batch, is restart-safe, supports one-cycle execution and follows Order232
  disabled, abort/shutdown and sanitized-error composition.
- Exact rerun is a no-op. Twenty contenders and concurrent workers converge to one
  parent transition and one evidence effect. Publication failure rolls everything
  back before exact retry.
- Future departures, missed-past departures, foreign scopes, non-`in_house` parents,
  absent segments and incoherent latest-segment truth are no-op.
- D-612 remains controlling: `business_day` is neither clock authority nor a
  prerequisite. There is no open-day query, day mutation or delayed catch-up.
- Checkout remains separately explicit and continues to own readiness, occupancy
  release and financial effects. The roll never calls checkout.
- Existing runtime status may expose only the exact configured/disabled departure-roll
  worker flag already used for sibling workers; it is not proof of a successful cycle.

## Exact scope

- this order and focused intentional-red/domain/worker/server-wiring/journey tests;
- `src/contexts/reservations/departure-roll.ts`, `src/contexts/reservations/index.ts`;
- `src/workers/postgres-due-departure-scopes.ts` and `src/server.ts`;
- `migrations/0035_runtime_due_departure_scopes.sql` for one bounded read-only
  `yellow_runtime` scope-discovery function only;
- project-status response and directly affected tests only for the exact sibling
  configured/disabled worker-health flag;
- directly affected migration, database-acceptance, runtime-authority, runtime-DML,
  SECURITY-DEFINER and schema snapshot tests;
- existing Today, reservation-detail, checkout-readiness and checkout tests as
  run-only regressions unless an exact test assertion needs the new parent truth;
- relevant contract/event/state/domain/security/operator documentation;
- Phase-6 entries in `BUILD-PLAN.md`, `handoff/PHASE-6-PLAN.md`, this order,
  `DECISIONS.log` and `handoff/LEDGER.md`.

`migrations/0001_init.sql` remains immutable. Order232's fresh executable authority
proof remains directly applicable: app-role already owns only the exact reservation
status-column update and segment read needed, while `yellow_runtime` cannot read
reservation/property truth. Migration0035 therefore adds solely one stable bounded
fixed-search-path function returning due tenant/property scopes; PUBLIC/app-role
execution and direct runtime table reads remain denied.

## Forbidden

- browser, process, caller or server-local date authority;
- `business_day` lookup, opening, sealing, mutation or catch-up meaning;
- past-departure repair, late-checkout inference, no-show, due-in or check-in logic;
- any segment mutation, occupancy claim/release, checkout invocation or automatic
  checkout;
- checkout-readiness, financial, folio/account, journal/posting, payment, document,
  room-condition, housekeeping-task, key, identity, statutory, travel or guest effect;
- new API route, browser command, Today/checkout UI behavior or generic scheduler;
- new table/event/permission/dependency or external job;
- modifying migration0034 or `migrations/0001_init.sql`;
- local promotion, merge, push, deployment, Phase-6 or app-complete claim.

## Pre-registered proof

- **P0 red:** departure-roll service, scope adapter, worker composition and production
  `reservation.due_out` emission are absent.
- **P1 exact date:** a non-UTC `in_house` stay rolls only when PostgreSQL's
  transaction-stable property-local date equals the latest segment's local upper
  bound; fact and outbox carry that same date.
- **P2 containment:** future, past, foreign, terminal, absent and incoherent latest
  segment truth creates no artifact.
- **P3 atomicity:** parent becomes due-out while the complete exact current segment is
  byte-identical `in_house`; one minimized fact/outbox/idempotency result exists and
  occupancy, folio, finance, condition, task and day truth is unchanged.
- **P4 replay/contention:** rerun and twenty contenders converge to one transition and
  one evidence effect.
- **P5 rollback:** injected evidence/publication failure leaves parent, segment,
  idempotency, fact and outbox unchanged; exact retry succeeds once.
- **P6 authority:** bounded discovery returns only exact due scopes, validates bounds,
  exposes no reservation detail, remains runtime-only and grants no direct table read
  or transition authority.
- **P7 worker:** exact scope/batch bounds, fixed actor, operation binding, per-scope
  failure containment, opt-in wiring, sanitized logs, abort and one-cycle behavior are
  executable.
- **P8 journey:** a real in-house stay becomes visible through unchanged Today due-out,
  reservation detail and checkout readiness; no checkout command is invoked.
- **P9 standing:** focused and adjacent regressions plus typecheck, boundaries,
  licence, audit, JavaScript, exact migration/schema, full suite and fresh referee are
  green.

## Definition of done

- [x] Order232 is recorded built-unreviewed at exact base `ab49e31`.
- [ ] Intentional red precedes implementation.
- [ ] Date admission is transaction-stable, PostgreSQL-owned and property-local.
- [ ] Only parent `in_house -> due_out` changes; latest segment remains byte-identical.
- [ ] Exactly one existing `reservation.due_out` evidence chain commits.
- [ ] Checkout, occupancy, finance and product UI behavior remain unchanged.
- [ ] Standing gates are green and the result is recorded built-unreviewed.

