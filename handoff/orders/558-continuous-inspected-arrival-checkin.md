# Order 558 — continuous inspected-arrival check-in

## Objective

Close the next bounded PMS01 gap: one retained Yellow arrival conversation must guide
staff from the current authoritative blocker to the next safe action, while standard
check-in requires the room to have reached the separately recorded supervisor
inspection state.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/src/contexts/stay-operations/checkin.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/migrations/0096_governed_checkin_room_condition_lock.sql`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/src/App.tsx`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/stay-checkin.integration.test.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/order558-inspected-checkin-continuity.test.ts`
- `handoff/reviews/558-continuous-inspected-arrival-checkin.md`
- `handoff/LEDGER.md`
- `handoff/FOUNDER-JOURNEY-CAPABILITY-LEDGER.md`

## Required behaviour

1. Standard check-in treats `inspected` as ready. A merely `clean` room remains
   blocked for a separate supervisor declaration. Existing explicitly authorized
   dirty/pickup override semantics remain unchanged.
2. The readiness API exposes one exact non-sensitive blocker for the clean but
   uninspected state; commit rechecks and locks the same room-condition truth
   transactionally through a narrow owner-mediated capability. Runtime table DML
   remains revoked.
3. The retained Yellow arrival journey shows `clean` as awaiting inspection and
   never labels it ready.
4. After each confirmed room, housekeeping, folio or check-in action, Yellow reads
   fresh canonical reservation/readiness/task truth and states or proposes the next
   deterministic step without making the operator repeat “prepare check-in”.
5. Every write remains a separately visible, exact proposal followed by explicit
   confirmation. Yellow never infers physical cleaning or inspection.
6. Stale evidence, uncertainty and retry retain the current fail-closed and
   idempotency rules.

## Verification

- Intentional red before implementation.
- Actual PostgreSQL proof for inspected success, clean refusal, dirty override,
  identity, replay, concurrency and tenant/property concealment.
- Focused Yellow conversation tests, strict TypeScript and production build.
- Independent non-implementing reviewer personally executes the high-risk proof
  before any public promotion.

## Out of scope

Identity-document capture, generic task reassignment, payment, posting, automatic
selection among several rooms or attendants, public database mutation, and a claim
that the whole PMS is complete.
