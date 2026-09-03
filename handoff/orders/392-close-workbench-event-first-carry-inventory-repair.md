# Order 392 — Close-workbench event-first carry inventory repair

**Status:** ACTIVE-D1128
**Phase:** 5 — Financials operator delivery repair
**Branch:** `phase-5/operator-business-day-close-workbench`
**Base:** exact withheld Order391 review tip `b9c73bc`
**Risk tier:** 3 — audited discrepancy carry lineage

Repair only D1127's independently reproduced missing-aggregate fail open. Inventory
selected-day and relevant current-target `discrepancy.carried` events independently
of the discrepancy table, then require each event to bind one existing tenant/property
discrepancy aggregate and exactly one fully coherent safe target carry link.

## Exact scope

- `src/contexts/financials/business-day-close-readiness.ts`, only workbench carried
  event inventory and unsafe classification;
- `tests/business-day-close-workbench.integration.test.ts` and focused workbench unit
  only for mutation-sensitive event-first evidence;
- this order, its independent review, `DECISIONS.log`, `handoff/LEDGER.md`.

No migration/schema/permission/seed, readiness policy, bound, response, API/UI/docs,
server, dependency, local runtime, `.yellow`, carry mutation, deploy, merge or push.

## Executable proof

1. Preserve D1127's missing aggregate+link event as a permanent green regression.
2. Prove missing aggregate, wrong/foreign aggregate, and duplicate selected/current
   carried events make the entire read unavailable with zero writes.
3. Preserve D1124/D1121, all prior mutations, coherent exclusions, ordinary candidate,
   one-statement/snapshot, 366/367 and 500/501 proofs.
4. Run official PostgreSQL16.15 focused and static gates.
5. A different fresh non-implementing Tier3 reviewer approves before a separate full
   Order384 restart; prior partial greens are not reused.

## Definition of done

- [ ] Carried-event inventory does not depend on an existing discrepancy join.
- [ ] Every relevant event has exactly one aggregate and one coherent safe target link.
- [ ] Fresh Tier3 approval is recorded from reviewer-executed PostgreSQL proof.
