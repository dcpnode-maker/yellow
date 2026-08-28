# Order 235 — Governed room discrepancy reporting

**Status:** READY-D618
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/governed-room-discrepancy-reporting`
**Base:** `cccca69` (built-unreviewed Order234)
**Risk tier:** 3 — owner-mediated operational record creation and occupancy-derived truth
**Owner:** Codex implementation; independent high-risk approval remains deferred by founder build-first direction

## Outcome

An authorized housekeeper can deliberately report the observed presence of one exact
active physical room. PostgreSQL compares that observation with the current coherent
stay and exact exclusive occupancy truth and creates only a canonical sleep, skip or
person discrepancy with atomic minimized evidence. Matching truth creates nothing.

## Fixed policy

- The target is one active exact-property physical room. Dorm/bed positions, shared,
  ambiguous, inactive, foreign, non-room and multiply occupied shapes fail closed.
- The command accepts only exact room identity, observed presence `occupied|vacant`
  and, when observed occupied, observed persons `1..99`. Tenant, property, actor,
  system presence, expected persons, kind, clock and evidence are server-owned.
- System presence is `occupied` only when one exact latest current segment belongs to
  an `in_house|due_out` reservation, that segment is `in_house`, and exactly one
  current exclusive occupancy claim binds the same room and segment. Booked/due-in,
  departed, released, stale or incoherent truth is vacant or fails closed as specified
  by the capability; browser state is never authority.
- Canonical classification is: **sleep** = observed occupied/system vacant; **skip** =
  observed vacant/system occupied; **person** = both occupied and observed persons
  differs from current segment `adults + children`. Matching truth is a successful
  no-op. Canonical stored tokens are `occupied|vacant` for sleep/skip and
  `persons:<n>` for person; the API returns a derived exact kind.
- Only one unresolved discrepancy may exist for a room. Exact replay returns it;
  changed evidence conflicts until a later resolution workflow. V1 neither resolves,
  carries, queues nor messages discrepancies.
- Read returns unresolved exact-property room code/floor, kind, reported/system
  tokens, reporter/time and no guest, reservation, segment, occupancy or contact id.
- Exact scopes are `housekeeping.discrepancies:read` and
  `housekeeping.discrepancies:report`. Every command requires an actor-bound
  `Idempotency-Key` and owner-mediated fixed-search-path capability. Raw runtime
  discrepancy DML remains denied.
- A changed report writes the discrepancy, one minimized `discrepancy.reported` fact
  and one outbox event in the same transaction. Publication failure rolls back all.

## Exact scope

- this order and committed intentional-red/focused PostgreSQL, service, HTTP, UI and
  navigation tests;
- `migrations/0036_governed_room_discrepancy_reporting.sql` and mechanically generated
  `tests/schema/expected.sql`;
- one focused `src/contexts/housekeeping/discrepancies.ts` plus export from
  `src/contexts/housekeeping/index.ts`;
- minimal adapter/route/composition changes in `src/http/operator.ts`, `src/app.ts`
  and `src/server.ts`;
- `src/http/operator/operator.js`, `src/http/operator/operator.css`, and
  `src/http/operator/index.html` only if one static semantic hook is required;
- `scripts/seed-review.ts` only for exact scopes and deterministic India/Canada room
  divergence fixtures without pre-created discrepancy effects;
- focused migration/acceptance/runtime-DML/SECURITY-DEFINER/review-seed/schema tests;
- discrepancy-only notes in `docs/CONTRACTS.md`, `docs/EVENTS.md`,
  `docs/STATE-MACHINES.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md` and
  `docs/UI-SPEC.md`;
- Phase-6 entries in `BUILD-PLAN.md`, `handoff/PHASE-6-PLAN.md`, this order,
  `DECISIONS.log` and `handoff/LEDGER.md`.

`migrations/0001_init.sql`, occupancy functions, reservation/segment/condition/task,
financial, business-day and statutory truth remain unchanged.

## Required work

1. Commit intentional red before implementation.
2. Add migration0036 with exact function owner/signature/search path/ACL, canonical
   room/stay/occupancy locks and unresolved-room convergence.
3. Add deeply frozen read and actor-bound idempotent report services. The callback
   performs capability call plus one minimized fact/outbox event atomically.
4. Add strict no-query GET/POST routes with exact scope, UUID/body/header/property,
   no-store, concealment, conflict and correlation handling.
5. Extend the current Housekeeping room-condition board with a stale-safe deliberate
   report form and unresolved discrepancy cards; no optimistic discrepancy state.
6. Preserve all current appearances, 44px controls (Android 48px), 375px/200%
   containment, keyboard/focus, forced colours and reduced motion.

## Forbidden

- discrepancy resolution/update/delete/carry-forward, queue linkage, message, alert,
  generic discrepancy CRUD, batch report or inferred automatic report;
- room condition/task/sheet/reservation/segment/occupancy/folio/financial/day/key/
  statutory mutation or inferred guest identity;
- dorm/position/shared semantics, new table/event/dependency, polling or browser
  storage;
- local promotion, second local, merge, push, deployment, Phase-6 or app-complete claim.

## Pre-registered proof

- **P0 red:** capability/service/routes/scopes and semantic UI are absent first.
- **P1 classification:** fresh PostgreSQL proves sleep, skip, person and matching no-op
  against exact seeded divergence with server-derived truth.
- **P2 containment:** inactive/foreign/non-room/shared/ambiguous/incoherent/positional
  shapes and hostile actor/property/tenant inputs write nothing.
- **P3 atomicity:** one discrepancy plus one fact/outbox commits, while injected
  evidence failure rolls back discrepancy and idempotency before one successful retry.
- **P4 replay/concurrency:** exact replay is stable, changed reuse conflicts, one open
  discrepancy per room holds, and twenty contenders converge to one effect.
- **P5 authority:** PUBLIC/direct-login/raw runtime DML/capability misuse is denied;
  fixed search path, owner and exact grants are executable.
- **P6 HTTP/UI:** strict access/body/header/query/no-store handling, stale identity,
  authoritative refresh, direct-board behavior, history/focus and responsive access
  are executable.
- **P7 standing:** adjacent Housekeeping/stay regressions, full suite, typecheck,
  boundaries, licence, audit, JavaScript, diff, exact schema and fresh referee remain green.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Exact governed sleep/skip/person classification is atomic and executable.
- [ ] Authority, hostile boundaries, rollback, replay and convergence are proved.
- [ ] The human Housekeeping reporting/read journey is accessible and stale-safe.
- [ ] Standing gates are green and the result is recorded built-unreviewed.
