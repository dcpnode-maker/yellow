# Order 200 — Governed arrival readiness and check-in workbench

**Status:** READY-D541 — intentional red and implementation required
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/governed-checkin-readiness`
**Base:** `f138f996a74d` (built-unreviewed Order199)
**Risk tier:** 3 — reservation/segment state transition, identity readiness and occupied-room control
**Owner:** Codex implementation; independent high-risk proof deferred under founder build-first direction

## Outcome

An authorized front-desk operator can open a due-in reservation, receive one
server-owned readiness result, and commit exact `due_in -> in_house` only when its
active booked segment is assigned, its primary folio is open, the assigned room is
clean/inspected, and any active property statutory adapter has the required recorded
identity evidence. A dirty-room exception requires distinct server-derived authority
and a mandatory reason; the browser cannot assert readiness or override authority.

## Fixed policy

- Consume the canonical reservation state machine unchanged: only `due_in` may check
  in; reservation and exact active segment become `in_house` together.
- Room readiness is authoritative `unit_condition` truth for the assigned physical
  space. Clean/inspected pass; dirty/pickup block unless exact dirty-room authority
  and reason are present.
- An open primary folio is a prerequisite; check-in creates no folio or money.
- Identity readiness is configuration-driven. This slice does not hardcode national
  legal fields: only an active property-scoped statutory adapter declaring check-in
  identity evidence activates the generic recorded-document gate. Submission and
  country-specific validation remain Phase 8.
- Check-in does not issue keys, post money, close accounts or alter occupancy claims.

## Exact scope

- `handoff/orders/200-governed-arrival-readiness-checkin.md`
- `src/contexts/stay-operations/checkin.ts`, `src/contexts/stay-operations/index.ts`
- minimal export/composition in `src/app.ts`, `src/server.ts`, `src/http/operator.ts`
- `src/http/operator/index.html`, `src/http/operator/operator.js`,
  `src/http/operator/operator.css`
- `scripts/seed-review.ts`
- `tests/stay-checkin.intentional-red.test.ts`, `tests/stay-checkin.integration.test.ts`,
  `tests/operator-checkin-workbench.integration.test.ts`, focused additions to
  `tests/operator-reservation-read-surface.integration.test.ts`,
  `tests/review-seed.integration.test.ts`, and `tests/runtime-dml-authority.integration.test.ts`
- check-in-only sections in `docs/CONTRACTS.md`, `docs/EVENTS.md`,
  `docs/STATE-MACHINES.md`, `docs/DOMAIN-MODEL-V1.md`
- Phase-6 only in `BUILD-PLAN.md` and new `handoff/PHASE-6-PLAN.md`
- this order, a question only if executable preflight requires scope correction,
  `DECISIONS.log`, and `handoff/LEDGER.md`

No migration or schema-snapshot change is admitted initially: current app-role status
authority is reused. If executable preflight proves that unsafe, stop and record an
exact scope-correction question before any migration. `migrations/0001_init.sql`
remains byte-identical.

## Required work

1. Commit P0 intentional red before implementation.
2. Add a read-only readiness service returning named server-owned blockers and no PII.
3. Add actor-bound idempotent atomic check-in with exact tenant/property/audit input,
   state re-read, reservation+segment transition, fact and outbox in one transaction.
4. Add `stay.checkin:read`, `stay.checkin:commit`, and
   `stay.checkin:dirty-room-override` behind exact property grants; only the handler
   derives override authority.
5. Add no-store readiness/commit routes and a Today/reservation-detail check-in
   workbench with one clear action, blocker summary, confirmation, retained retry key,
   authoritative refetch, stale/property guards, keyboard/focus access and existing
   appearance-specific behavior.
6. Seed deterministic due-in clean, dirty and identity-gated examples without
   check-in effects or financial mutation.

## Forbidden

- due-in auto-roll, no-show, checkout, due-out or checked-out transitions
- account/folio/journal/posting/payment/receivable/cashier/deposit mutation
- occupancy release/rewrite, keys, travel/vehicle, task sheets or discrepancies
- hardcoded national statutory rules, statutory submission/adapters or external calls
- tax/fiscal/documents, day roll/seal, dependency, public/production deployment
- local promotion, second local, merge or push

## Pre-registered proof

- **P0 red:** service/routes/workbench and markers are absent before implementation.
- **P1 success:** exact due-in + assigned clean room + open primary folio atomically
  becomes reservation/segment in-house with one fact/outbox and exact replay.
- **P2 blockers:** wrong state, no assignment, missing/open-folio failure, dirty/pickup
  and active-adapter identity failure write nothing and return named blockers.
- **P3 override:** dirty exception succeeds only with server-derived exact permission
  plus nonblank reason; browser authority/ready booleans are rejected.
- **P4 authority:** foreign tenant/property/actor, missing grants, raw DML and forged
  capability paths fail closed without revealing PII.
- **P5 concurrency:** same key replays and twenty distinct check-in contenders converge
  to exactly one transition/evidence effect.
- **P6 operator:** no-store scopes/grants/concealment, stale guards, error retention,
  keyboard/focus and visible action pass across existing appearances.
- **P7 standing:** financial/reservation/occupancy/identity, schema/authority, type/
  boundary/licence/audit/full and referee11/11 remain green.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Server-owned readiness and atomic check-in are executable.
- [ ] Dirty override, identity gate, hostile authority and convergence are proved.
- [ ] Operator workbench is usable without client-derived lifecycle authority.
- [ ] Result is recorded built-unreviewed without claiming checkout, Phase6 or app completion.
