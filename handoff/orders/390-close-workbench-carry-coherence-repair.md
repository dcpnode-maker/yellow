# Order 390 — Close-workbench carry-coherence repair

**Status:** REVIEW-WITHHELD-D1124
**Phase:** 5 — Financials operator delivery repair
**Branch:** `phase-5/operator-business-day-close-workbench`
**Base:** exact withheld Order384 review tip `86e5032`
**Risk tier:** 3 — audited discrepancy carry lineage

Repair only D1121's independently reproduced fail-open carry-link validation. Replace
the workbench's reduced shape/count predicate with the complete already-approved
canonical carried-discrepancy coherence predicate used by close readiness and the
audited seal. Any existing source or target link must either be fully coherent and
therefore safely excluded, or make the complete workbench unavailable.

## Exact scope

- `src/contexts/financials/business-day-close-readiness.ts`, only workbench carry-link
  evidence/predicate composition;
- `tests/business-day-close-workbench.integration.test.ts` and the focused unit test
  only for mutation-sensitive carry coherence;
- this order, its independent review, `DECISIONS.log`, `handoff/LEDGER.md`.

No migration/schema/permission/seed, readiness policy, bound, response, API/UI/docs,
server, dependency, local runtime, `.yellow`, carry mutation, deploy, merge or push.

## Load-bearing coherence

For every existing link, prove exact tenant/property, source/target discrepancy and
space pairing, source and target business dates, current target day/open instant,
ordinary source report and canonical carried target event, source resolution state and
`resolved_at=carried_at`, unresolved target state/reporter/time/system value, approval
kind/subject/requester/decision/expiry, different-user approved chronology, exact
discrepancy-state hash and request hash, and all immutable link/request bindings. Never
accept a regex-shaped hash as canonical truth. Duplicate, mixed, missing, foreign or
mismatched evidence fails the entire read closed.

## Executable proof

1. Preserve D1121's fresh PG16.15 hostile red.
2. Independently mutate/remove each load-bearing field, hash, lifecycle, approval and
   carried-event binding; every case must become unavailable with zero writes.
3. One fully coherent source link and one fully coherent target link are excluded;
   ordinary uncarried selected-day lineage remains a candidate.
4. Re-run exact one-statement/snapshot, 366/367, 500/501, readiness and all Order384
   focused/standing/database/static/referee gates.
5. A fresh non-implementing Tier-3 reviewer restarts complete Order384 review after
   approving this repair; no earlier partial green verdict is reused.

## Definition of done

- [ ] D1121 red is converted to a permanent passing regression.
- [ ] Full mutation-sensitive predicate proof is green on PostgreSQL16.15.
- [ ] Fresh Tier-3 repair approval and complete Order384 rereview are recorded.
