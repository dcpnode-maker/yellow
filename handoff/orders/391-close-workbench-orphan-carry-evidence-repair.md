# Order 391 — Close-workbench orphan carry-evidence repair

**Status:** REVIEW-WITHHELD-D1127
**Phase:** 5 — Financials operator delivery repair
**Branch:** `phase-5/operator-business-day-close-workbench`
**Base:** exact withheld Order390 review tip `afc7402`
**Risk tier:** 3 — audited discrepancy carry lineage

Repair only D1124's independently reproduced fail-open carried-event classification.
Every selected-day or relevant current-target `discrepancy.carried` event must bind to
exactly one fully coherent carry link. Orphan, duplicate or mixed ordinary/carried
event evidence makes the complete workbench unavailable; it must never become a
silent exclusion.

## Exact scope

- `src/contexts/financials/business-day-close-readiness.ts`, only the workbench
  candidate unsafe classification;
- `tests/business-day-close-workbench.integration.test.ts` and the focused workbench
  unit only for mutation-sensitive orphan/mixed carried evidence;
- this order, its independent review, `DECISIONS.log`, `handoff/LEDGER.md`.

No migration/schema/permission/seed, readiness policy, bound, response, API/UI/docs,
server, dependency, local runtime, `.yellow`, carry mutation, deploy, merge or push.

## Executable proof

1. Preserve D1124's exact orphan-carried-event red as a permanent green regression.
2. Prove source-day orphan, target-day orphan, duplicate carried events, and mixed
   ordinary plus carried evidence all make the whole read unavailable with zero writes.
3. Preserve coherent source/target exclusion, ordinary candidate retention, D1121,
   all 48 Order390 mutations, one-statement/snapshot and 366/367 plus 500/501 bounds.
4. Official PostgreSQL16.15 focused evidence and static gates must pass.
5. A different fresh non-implementing Tier3 reviewer approves this repair before a
   separate fresh complete Order384 restart. No prior partial green verdict is reused.

## Definition of done

- [ ] Every carried event binds to exactly one safe link or the whole read fails closed.
- [ ] D1124 and mixed-event regressions are mutation-sensitive and green.
- [ ] Fresh Tier3 approval is recorded with reviewer-executed PostgreSQL proof.

## Fresh Tier-3 verdict

Withheld at D1127. The candidate rejects carried evidence only after joining from an
existing `discrepancy` row. A selected-day `discrepancy.carried` outbox event whose
aggregate discrepancy is absent is therefore invisible to the candidate evidence
CTEs and the complete workbench returns successfully. This violates the order's
every-carried-event exact-bind requirement. See
`handoff/reviews/391-close-workbench-orphan-carry-evidence-repair.md`.
