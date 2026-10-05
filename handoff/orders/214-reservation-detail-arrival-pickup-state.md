# Order 214 — Reservation-detail arrival pickup state

**Status:** BUILT-UNREVIEWED-D572 — implementation and builder gates complete
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/reservation-detail-arrival-pickup-state`
**Base:** `5b03b9a` (built-unreviewed Order213)
**Risk tier:** 1 — read-only presentation of existing authoritative detail truth
**Owner:** Codex implementation; independent product review remains deferred by founder build-first direction

## Outcome

The canonical reservation drawer tells an operator whether arrival pickup is not
requested, needs a schedule, is awaiting the durable worker, or already has its
canonical task linked. The slice is read-only and never invents task lifecycle truth.

## Fixed contract

- Presentation derives only from the existing authoritative arrival travel row:
  `pickupRequested`, `scheduledAt` and coherent `pickupTaskId`. It adds no endpoint,
  query, cache, polling, refresh loop or background mutation.
- The exact honest mapping is:
  - no arrival row or pickup is false: no automation claim; an arrival row may show
    `Pickup not requested`;
  - pickup true with no schedule: `Pickup requested · schedule required`;
  - pickup true with a schedule and no linked task: `Pickup requested · task pending`;
  - pickup true with a coherent task link: `Pickup task linked`.
- Departure travel never receives a pickup state. Task identity, status, assignee,
  queue, dispatch, completion, driver, vehicle, contact and outcome are never shown or
  inferred. No task link, button, route or task workspace is invented.
- The state sits inside the existing Travel section and preserves its mode, carrier,
  service and schedule truth. Text carries the meaning; colour and effects are only
  supporting cues.
- Existing Apple iOS, Android, Windows 95/98, glassmorphism, neomorphism and ERP
  appearances receive dedicated native-feeling status treatment without changing
  semantic order. Forced colours remains legible; reduced motion adds no animation;
  375px and 200% zoom wrap without horizontal overflow.
- The existing reservation route, Back/Escape/focus behavior, request-generation and
  stale property/reservation guards remain unchanged. Ordinary authoritative detail
  refresh reveals worker linkage; this order makes no immediacy claim.

## Exact scope

- this order and one committed intentional-red test
- focused reservation-detail presentation in `src/http/operator/operator.js`
- focused theme/accessibility/containment styles in `src/http/operator/operator.css`
- one Order214 section in `docs/UI-SPEC.md`
- focused Order214 rendering, theme and route-regression tests
- `DECISIONS.log`, `handoff/LEDGER.md`, `BUILD-PLAN.md` and
  `handoff/PHASE-6-PLAN.md`

No API, context, server, HTML, permission, migration, schema, seed, task read model,
task route/action, navigation grammar, dependency, animation framework, local
promotion, merge, push or deployment is admitted.

## Required work

1. Commit intentional red before implementation.
2. Add one pure arrival pickup-state presenter and exact truthful labels.
3. Render it only in canonical arrival travel detail without exposing task identity or
   inventing an action.
4. Give every existing appearance a dedicated accessible status treatment with small
   viewport, 200%-zoom, forced-colour and reduced-motion containment.
5. Preserve route/history/focus/stale guards and run focused plus complete standing gates.

## Pre-registered proof

- **P0 red:** pickup-state helper, semantic hook and all four exact labels are absent.
- **P1 truth:** false, unscheduled, scheduled-unlinked and linked arrival truth maps
  exactly; departure emits no pickup state.
- **P2 minimization:** no task id/status/assignment/queue/dispatch/completion/driver,
  vehicle/contact, link, button or request is emitted.
- **P3 UX:** all six appearances style the semantic hook; meaning is text-backed and
  375px/200%/forced-colour/reduced-motion contracts remain explicit.
- **P4 containment:** canonical route, query grammar, Back/Escape/focus and stale guards
  remain unchanged; the slice is render-only.
- **P5 standing:** focused, type, boundary, licence, audit, JavaScript, diff and full
  suite remain green. No database or referee rerun is required because product truth,
  API, permissions and schema are unchanged.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] All exact states are truthful and no task lifecycle or action is inferred.
- [x] Six appearance treatments and accessibility/containment proofs are green.
- [x] Focused and standing gates are green.
- [x] Result is recorded built-unreviewed; independent product review remains deferred.
