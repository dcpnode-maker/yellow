# Order 348 — Business-day roll abort and posting-oracle repair

**Status:** APPROVED-D989
**Phase:** 5 — Financials
**Branch:** `phase-5/business-day-roll-abort-oracle-repair`
**Base:** `50cd867` (D986 independent Order347 WITHHOLD)
**Risk tier:** 3 — financial-date worker shutdown and permanent posting proof
**Owner:** Codex implementation; different fresh non-implementing Tier-3 reviewer

## Outcome

Close only the two executable D986 findings. Cancellation while one business-day
scope executes must prevent every later scope from being invoked. The existing
strict financial-postings catalogue oracle must require the approved exact 111 public
base tables instead of stale 87. Change no business-day, posting, authority,
scheduler or schema behavior.

## Natural solution

Thread the existing optional `AbortSignal` from `BusinessDayRollWorker.run()` into
`drainOnce(signal?)`. Check it before discovery and immediately before every scope;
after an in-flight scope returns, the next loop check stops further work. Do not
cancel or roll back a command already executing, classify cancellation as a scope
failure, throw, poll again, or add another timer/worker state. Direct test calls may
omit the signal and preserve current behavior.

The schema oracle repair is exactly one integer: 87 to 111 at the strict P1 assertion
in `tests/financial-postings.integration.test.ts`. Retain exact equality and every
query/functional assertion. The approved migration61 catalogue and D986 fresh proof
establish 111; do not use a range, lower bound, generated expectation or migration
rollback.

## Exact scope

- `src/contexts/financials/business-day-roll.ts`;
- `tests/business-day-roll-worker-wiring.integration.test.ts`;
- `tests/financial-postings.integration.test.ts`;
- this order and `handoff/reviews/348-business-day-roll-abort-and-posting-oracle-repair.md`;
- status/approval-only updates to Order347, `BUILD-PLAN.md`,
  `handoff/PHASE-5-PLAN.md`, `handoff/ROADMAP.md`, `DECISIONS.log` and
  `handoff/LEDGER.md`.

Anything outside this list requires a separately recorded scope decision.

## Required proof

1. Preserve D986 reviewer red: pause FIRST, abort, release FIRST; exact parent invokes
   both FIRST and SECOND.
2. Permanent regression requires calls `[FIRST]`, prompt completion, no second
   write/failure or later cycle. Cover abort before discovery and between scopes;
   preserve ordinary drain, per-scope failure isolation, polling and callbacks.
3. Fresh PostgreSQL61 executes financial-postings 10/0 with strict 111 equality and
   unchanged 500-posting/tenant/seal/replay/rollback assertions.
4. Re-run Order347 focused roll/worker, migration/schema/acceptance/runtime/DML/
   SECURITY-DEFINER/seal gates, standing/static and fresh referee11/11.
5. A different fresh Tier-3 reviewer reproduces both parent reds and approves Orders
   348 and 347 only if every corrected gate passes.

## Forbidden

- changing migration0061, schema snapshots, capabilities, roles/grants, business-day
  service/date/event/fact/outbox logic, worker intervals/batches/errors or server wiring;
- interrupting an already-running scope, treating abort as failure, restarting work,
  changing posting behavior/query, weakening equality or editing other oracles;
- `.yellow`, credentials, Docker/stable-local mutation, port3000, local promotion,
  merge, push, deployment, seal/readiness/carry, Phase5 or application completion.
