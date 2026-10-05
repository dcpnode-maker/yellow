# Order 538 — Yellow reservation cancel and reinstate

## Objective

Let an authorized colleague cancel or reinstate an eligible reservation entirely
inside the Yellow reservation record, using the existing governed lifecycle APIs,
visible confirmation and idempotent retry semantics.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/styles.css`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-reservation-lifecycle-actions.test.ts`
- focused verification, independent state-transition review and public browser proof
- `handoff/reviews/538-yellow-reservation-cancel-reinstate.md`

## Required behaviour

1. Show lifecycle controls only for server-reported eligible reservation states:
   cancel for `reserved` or `due_in`; reinstate for `cancelled` or `no_show`.
2. Cancellation requires a non-blank bounded reason and an unchecked-by-default
   visible confirmation naming the reservation and consequence.
3. Reinstatement requires a separate unchecked-by-default visible confirmation
   and explains that PostgreSQL rechecks the original occupancy.
4. Use only the existing property-scoped cancel and reinstate endpoints with the
   current Bearer session and a stable idempotency key for retries of the same
   unchanged command.
5. Disable navigation/form mutation while a command is in flight, show success or
   actionable server failure, then refresh the canonical reservation and board.
6. Never infer success locally; render the refreshed server status, cancellation
   number/reason and recorded history.
7. Work at 375px with the fixed mobile navigation and Yellow launcher without
   hiding action controls or creating horizontal document overflow.

## Exclusions

- No new lifecycle endpoint, no-show mutation, cancellation-policy override,
  approval creation, database/schema/migration, occupancy or financial change.
- No claim that this completes edit, no-show, room move or the whole PMS.

## Risk and review

Cancel/reinstate are occupancy-affecting reservation state transitions. A
non-implementing agent must inspect the final bytes and personally execute a
bounded cancel/reinstate/replay proof on a dedicated fictional future reservation
before public deployment, per PROJECT.md. The reviewer must preserve the original
reservation evidence and prove no duplicate transition or occupancy claim.

## Verification

- Intentional-red then green focused source contract.
- Strict frontend/root TypeScript, relevant frontend tests and production build.
- Independent reviewer uses canonical APIs on a dedicated future fictional
  reservation: cancel + identical replay; reinstate + identical replay; exact
  reservation/segment/occupancy/fact/outbox/idempotency evidence.
- Root performs a non-mutating 375px visible-flow proof before public promotion.
