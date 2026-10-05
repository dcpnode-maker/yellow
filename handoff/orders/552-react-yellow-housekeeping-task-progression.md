# Order 552 — React and Yellow housekeeping task progression

## Objective

Expose the already-governed Order201 housekeeping task lifecycle in the current
React/mobile PMS and in the retained named check-in conversation so staff can start
work, declare a room clean and separately verify it inspected without leaving Yellow.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/voice.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/styles.css`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-housekeeping-task-progression.test.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-voice-routing.test.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-reservation-lifecycle-actions.test.ts` (adjacent shared-lock oracle only)
- `handoff/reviews/552-react-yellow-housekeeping-task-progression.md`
- `handoff/LEDGER.md`
- `handoff/FOUNDER-JOURNEY-CAPABILITY-LEDGER.md`

## Required behaviour

1. Read current task truth and `allowedActions` only from the existing property-scoped
   task board/detail endpoints. Submit only the existing transition endpoint with
   exact expected task status, room condition and room-updated timestamp plus a stable
   per-proposal idempotency key.
2. The React Housekeeping workspace renders room/task truth and one eligible action.
   Every action first shows the complete exact proposal and requires a separate visible
   confirmation. Refresh task, condition, Housekeeping and check-in authorities before
   reporting success.
3. In one retained named check-in journey, exact natural commands for start cleaning,
   mark physically clean and supervisor inspection prepare the same proposal. Bare yes
   can execute only the latest visible proposal; no/another command invalidates it.
4. Staff language must remain truthful: start means work began; complete is a human
   declaration that physical cleaning finished and yields server-owned `clean`; verify
   is a distinct supervisor declaration and yields `inspected`. Yellow never infers or
   fabricates physical completion from time, task creation or voice silence.
5. Before a transition, refetch exact task detail and require unchanged task ID,
   status, room condition, room timestamp and allowed action. Validate the complete
   response receipt before displaying a successful result. Conflict, denial, network
   ambiguity and incoherent evidence fail closed and trigger authoritative refresh.
6. The shared parent/child command generation from Order550 supersedes delayed
   housekeeping and guest proposals in both directions. A yes can never confirm a
   proposal from an older question.
7. Desktop and 375px controls remain contained and keyboard/touch operable. The
   procedural neon layer remains image-free.

## Exclusions

- No new API/domain/schema/migration/status/scope/event, direct task/condition DML,
  automatic physical-clean/inspection claim, timer inference, staff reassignment,
  task cancellation/reopen, discrepancy, occupancy, financial, checkout or provider
  change.
- No public data mutation or deployment before independent high-risk review.

## Verification

- Intentional red before implementation.
- Focused parser/source tests, adjacent Order550/guest/check-in tests, strict frontend
  and root TypeScript, production build and 375px containment.
- Independent non-implementing review personally exercises actual-effects for
  assigned/dirty start, in-progress dirty/pickup complete, done/clean verify, stale
  state, denial, replay, response hostility and cross-flow supersession. Existing
  Order201 transition/database proof must be rerun in an isolated PostgreSQL fixture
  or equivalently strong current canonical environment before acceptance.
