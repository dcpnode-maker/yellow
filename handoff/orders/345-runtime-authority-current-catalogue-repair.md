# Order 345 — Runtime-authority current catalogue repair

**Status:** READY-D973
**Phase:** 6 — Stay operations and housekeeping
**Branch:** `phase-6/runtime-authority-current-catalogue-repair`
**Base:** `9da1f00` (Order343 independent WITHHOLD)
**Risk tier:** 3 — permanent runtime database-authority proof
**Owner:** Codex implementation; another different fresh non-implementing Tier-3 reviewer

## Outcome

Repair the single masked exact-catalogue assertion exposed by Order343's fresh review.
Change no behavior: the runtime-database-authority gate must expect the exact current
fresh public catalogue of 110 base tables, 100 RLS-enabled tables, 10 FORCE-RLS tables
and 100 policies.

## Natural-solution boundary

Order343 correctly updated the migration and runtime capability oracles. Only after
those assertions passed did the same P1 test reach its historical Phase-5 catalogue
totals at line397. The database-acceptance gate, normalized schema and fresh catalog
independently agree on `110/100/10/100`. The natural repair changes those four exact
integers only. It does not remove the query, weaken equality, import an at-least
comparison, or modify production truth.

## Exact scope

- `tests/runtime-database-authority.integration.test.ts`;
- this order;
- `handoff/reviews/345-runtime-authority-current-catalogue-repair.md`;
- approval/status-only entries in `handoff/orders/343-migration-0059-permanent-gate-repair.md`,
  `BUILD-PLAN.md`, `handoff/PHASE-6-PLAN.md`, `handoff/ROADMAP.md`,
  `DECISIONS.log` and `handoff/LEDGER.md`.

## Required proof

1. Preserve fresh Order343 red `9/1(85)` with exact actual
   `{tables:110,enabled:100,forced:10,policies:100}`.
2. Change only expected `94/84/0/84` to exact `110/100/10/100`.
3. Run runtime-database-authority `10/0`, migration `39/0`, acceptance `23/0`,
   effective-period `2/0`, standing/static/schema/seed and referee11/11 on fresh
   PostgreSQL.
4. Another different fresh Tier-3 reviewer personally reruns Order345 and the complete
   Order342 exit gate before Phase6 approval.

## Forbidden

- any other test, migration, schema snapshot, production source, permission, seed,
  dependency, runtime, environment, credential, Docker composition or local change;
- deleting the catalogue query/assertion, weakening exact equality, using minimums or
  deriving expected totals from actual results;
- `.yellow`, port3000, stable Order335, merge, push, deployment, self-review or
  Phase/application completion claims.

## Definition of done

- [ ] The diff changes exactly four expected integers in one scoped test file.
- [ ] All required fresh database and preservation gates pass.
- [ ] A different fresh independent Tier-3 reviewer approves and reruns Order342.
