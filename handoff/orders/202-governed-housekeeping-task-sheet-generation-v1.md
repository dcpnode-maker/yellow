# Order 202 — Governed housekeeping task-sheet generation v1

**Status:** BUILT-UNREVIEWED-D547 — implementation and executable gates green; independent proof deferred
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/governed-housekeeping-task-sheet-generation-v1`
**Base:** `4ca545e` (built-unreviewed Order201)
**Risk tier:** 3 — occupancy-derived operational task creation
**Owner:** Codex implementation; independent high-risk proof deferred under founder build-first direction

## Outcome

An authorized housekeeping operator can select one active property staff Party and one
property-local sheet date, preview the authoritative cadence-eligible physical rooms,
then generate one deterministic task sheet with one assigned housekeeping task per
eligible distinct room. The server owns tenant, property, actor, occupancy, cadence,
room identity, state, task identity and evidence.

## Fixed v1 policy

- Resolve current active/effective `vertical_profile` configuration using exact
  tenant-over-global precedence and each active room's `profile_key`.
- Implement only recorded, unambiguous cadence semantics: `daily` includes an
  authoritative in-house segment occupying the local date; `on_departure` additionally
  requires that segment's exclusive upper instant to fall on that property-local date.
- `weekly`, `custom`, missing, mixed or ambiguous profile truth fails the whole command
  atomically with an actionable unsupported-cadence result. No weekday, anchor or DSL is invented.
- One exact active same-tenant staff Party is selected as attendant. The generated sheet
  and tasks are deterministic for tenant/property/date/attendant and converge under retry
  and concurrency; another attendant cannot silently reassign an existing sheet.
- Tasks are `kind='housekeeping'`, `subject_type='space'`, `status='assigned'`,
  `department='Housekeeping'`, carry sheet/date/cadence provenance, and have no credits.
- Generation never changes `unit_condition`, reservation/segment/occupancy, folio,
  financial, business-day, statutory or key truth. Order201 exclusively owns later task
  and room-condition transitions.
- Exact property scopes are `housekeeping.sheets:read` and `housekeeping.sheets:generate`.
  Direct runtime `task_sheet`/`task` DML remains denied.

## Exact scope

- `handoff/orders/202-governed-housekeeping-task-sheet-generation-v1.md`
- `migrations/0027_governed_housekeeping_task_sheet_generation.sql`
- `src/contexts/housekeeping/sheets.ts`, `src/contexts/housekeeping/index.ts`
- minimal composition in `src/app.ts`, `src/server.ts`, `src/http/operator.ts`
- `src/http/operator/index.html`, `src/http/operator/operator.js`,
  `src/http/operator/operator.css`
- `scripts/seed-review.ts`
- `tests/housekeeping-task-sheet-generation.intentional-red.test.ts`,
  `tests/housekeeping-task-sheet-generation.integration.test.ts`,
  `tests/operator-housekeeping-sheet-workbench.integration.test.ts`, focused additions to
  `tests/operator-today-command-centre.integration.test.ts`,
  `tests/review-seed.integration.test.ts`, `tests/migrate.integration.test.ts`,
  `tests/database-acceptance.integration.test.ts`,
  `tests/runtime-dml-authority.integration.test.ts`,
  `tests/security-definer-containment.integration.test.ts`, and `tests/schema/expected.sql`
- housekeeping-only sections in `docs/CONTRACTS.md`, `docs/EVENTS.md`,
  `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`, `docs/UI-SPEC.md`
- Phase-6 only in `BUILD-PLAN.md` and `handoff/PHASE-6-PLAN.md`
- this order, a question only if executable proof requires scope correction,
  `DECISIONS.log`, and `handoff/LEDGER.md`

`migrations/0001_init.sql` remains byte-identical. No new table, state, event,
dependency, extension type, weekly rule or custom cadence language is admitted.

## Required work

1. Commit P0 intentional red before implementation.
2. Add migration0027 with one fixed-search-path yellow-owner exact-tenant capability
   that validates runtime/app-role context, active actor/property/staff attendant,
   effective profile cadence and property-local occupancy, then creates only the exact
   deterministic sheet/tasks. PUBLIC/direct login/raw app-role DML remain denied.
3. Add an actor-bound idempotent domain service for bounded preview, current sheet list
   and atomic generation with same-transaction `task.created` facts/outbox events.
4. Add no-store property-granted preview/list/generate routes. Browser input is only
   sheet date, selected staff Party id and idempotency key; no cadence, target rooms,
   occupancy, state, credits, actor, tenant or property authority is accepted.
5. Extend the Housekeeping workspace with attendant/date selection, preview evidence,
   one deliberate generation action, actionable unsupported cadence, authoritative
   refresh, retained-key retry, stale property/view/request guards, deep link, focus,
   keyboard, reduced motion and all existing appearances.
6. Seed one deterministic fixed-date eligible in-house hotel room and expose Avery
   Housekeeping as the selectable active staff Party without creating a sheet/task or
   mutating Order200/201 examples.

## Forbidden

- weekly cadence anchor/weekday, custom cadence DSL, automatic scheduling or timers
- multi-attendant splitting, credits/target credits, balancing, reassignment or cancellation
- task lifecycle mutation, condition mutation, discrepancies, queue, messages or checkout
- booking/segment/occupancy/folio/financial/day/tax/fiscal/statutory/key mutation
- local promotion, second local, merge, push or public/production deployment

## Pre-registered proof

- **P0 red:** migration, service, routes/workbench and exact markers are absent first.
- **P1 authority:** fresh migrations1–27 expose only the governed capability;
  PUBLIC/direct login/raw runtime task/sheet DML remain denied.
- **P2 selection:** daily distinct physical in-house rooms are included once despite
  duplicate positional occupancy; future booked/nonoccupied/foreign rooms are excluded.
  On-departure includes only exact local-date departures across timezone/DST boundaries.
- **P3 fail closed:** missing/ambiguous/weekly/custom profile, inactive/nonstaff attendant
  and malformed inputs create zero sheet/task/fact/outbox/idempotency artifacts.
- **P4 exact output:** assigned tasks have exact sheet/date/cadence/department/attendant
  provenance and do not mutate occupancy, reservation, segment or room condition.
- **P5 atomicity/concurrency:** replay is stable, changed reuse conflicts, twenty
  distinct contenders converge to one sheet/task per room and one fact/event per task;
  injected publication failure rolls everything back.
- **P6 hostile boundaries:** tenant/property/actor/attendant hostility conceals and writes nothing.
- **P7 operator/seed:** no-store scopes, preview/generate/list, stale guards, retained
  retry, keyboard/focus/deep-link, appearances and deterministic fixture rerun pass.
- **P8 standing:** migration/schema/acceptance/runtime authority, type/boundary/licence/
  audit/full suite and fresh referee11/11 remain green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Daily and on-departure generation is authoritative, deterministic and atomic.
- [x] Unsupported cadence and hostile boundaries fail without artifacts.
- [x] Human sheet-generation workbench and deterministic eligible fixture are usable.
- [x] Result is recorded built-unreviewed without claiming weekly/custom/discrepancy/checkout/Phase6/app completion.
