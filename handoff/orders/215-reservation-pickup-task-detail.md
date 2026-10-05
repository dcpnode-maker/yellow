# Order 215 — Reservation-scoped pickup-task detail

**Status:** BUILT-UNREVIEWED-D574 — implementation and executable build gates green; independent Tier-3 execution deferred
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/reservation-pickup-task-detail`
**Base:** `633f8da` (built-unreviewed Order214)
**Risk tier:** 3 — tenant/property-sensitive task read and hostile-association containment
**Owner:** Codex implementation; independent executable review remains deferred by founder build-first direction

## Outcome

From a linked arrival pickup state, an operator can open one canonical read-only pickup
task detail and return to the same reservation. The surface shows current minimized
task truth without creating a generic task authority or lifecycle command.

## Fixed contract

- Exact endpoint: `GET
  /api/v1/properties/:property/reservations/:reservation/arrival-pickup-task/:task`.
  It accepts no query and requires the existing `reservations.lifecycle:read` scope
  plus exact server-derived property grant.
- One tenant transaction proves the exact property/reservation, the current arrival
  `travel_detail.pickup_task_id=:task`, and a same-tenant/exact-property task with
  `kind='guest_request'`, `subject_type='reservation'`, exact reservation subject,
  `department='transport'`, `due_at=arrival.scheduled_at`, priority 3 and payload
  exactly `{"requestType":"arrival_pickup"}`. Runtime tenant GUC is explicit.
- Malformed/query/scope/grant failures use existing 400/403/404 conventions. Foreign,
  unlinked or wrong task identity is concealed as 404. A currently linked task whose
  stored canonical shape is hostile fails the complete read as 409 with no partial
  disclosure.
- Exact minimized output is only `taskId`, `reservationId`, `confirmationNo`, canonical
  task `status`, `dueAt`, `priority`, `createdAt` and nullable `completedAt`. Payload,
  assignee/Party/contact, notes, driver, vehicle, dispatch, queue, sheet, credits,
  property/tenant ids and transport outcome are omitted. The result is deeply frozen,
  no-store and mutation-free.
- Canonical human route is
  `/p/{property}/res/{reservation}/pickup-task/{task}`. Only an authoritative linked
  arrival state exposes **Open pickup task**. It loads the dedicated endpoint and
  renders one read-only panel; no edit, assignment, dispatch, completion, cancel,
  polling or inferred action is added.
- Back and Escape restore the exact reservation and trigger focus. Direct link,
  refresh and Forward work. Property/reservation/task/request-generation guards make
  stale paint inert. The existing reservation and workbench query grammar remains
  unchanged.
- Apple iOS, Android, Windows 95/98, glassmorphism, neomorphism and ERP receive
  dedicated accessible presentation. Status meaning is text-backed; 375px/200% zoom,
  forced colours and reduced motion remain contained.

## Exact scope

- this order and committed intentional-red tests
- focused read service in `src/contexts/reservations/detail.ts` and export only if needed
- focused adapter/route wiring in `src/http/operator.ts` and `src/app.ts`
- nested route/panel in `src/http/operator/operator.js` and focused styles in
  `src/http/operator/operator.css`; `index.html` only if executable preflight proves a
  static shell is required
- focused service, HTTP, route/history/focus, theme/accessibility and existing-detail
  regression tests
- Order215 sections in `docs/CONTRACTS.md`, `docs/SECURITY.md`, `docs/UI-SPEC.md`,
  `BUILD-PLAN.md`, `handoff/PHASE-6-PLAN.md`
- `DECISIONS.log`, `handoff/LEDGER.md`, and a question only for a real scope correction

No migration/schema/seed, new scope/event/table/status/dependency, generic task API,
housekeeping API reuse, task mutation, polling, Party/contact/vehicle/parking/
occupancy/financial/statutory effect, second local, promotion, merge, push or
deployment is admitted.

## Required work

1. Commit intentional red before implementation.
2. Add exact tenant/property/reservation/link/task-shape read containment and minimized
   frozen result.
3. Add exact HTTP authority, validation, concealment, no-store and error mapping.
4. Add nested direct-link/history/focus/stale-safe human task detail with no action.
5. Add dedicated six-appearance, small-viewport, zoom, forced-colour and reduced-motion
   presentation.
6. Run focused real-database, HTTP/UI, standing and fresh referee proof.

## Pre-registered proof

- **P0 red:** service, endpoint, nested route and panel are absent.
- **P1 read truth:** exact linked canonical task returns every allowed status/current
  timestamp and only the minimized keys; repeat reads are byte-equivalent/no-write.
- **P2 containment:** malformed/query/scope/grant, foreign/unlinked/wrong identity and
  hostile current linked shape fail 400/403/404/409 exactly without disclosure.
- **P3 transport:** adapter is no-store, query-empty, property-bound and maps only
  declared validation/not-found/conflict outcomes.
- **P4 human route:** linked arrival alone exposes the action; direct link, refresh,
  Back/Escape/Forward/focus and every stale identity boundary are exact; no lifecycle
  command or polling exists.
- **P5 UX:** six appearances, text-backed status, 375px/200% zoom, forced colours and
  reduced motion are explicit.
- **P6 standing:** focused, type, boundary, licence, audit, JavaScript, diff, schema,
  full suite and fresh referee remain green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Service and endpoint return only exact canonical linked pickup-task truth.
- [x] Human nested route is stale-safe, accessible and read-only across six appearances.
- [x] Focused, standing and referee gates are green.
- [x] Result is recorded built-unreviewed; independent Tier-3 execution remains pending.
