# Order 373 — Carried-source canonical report-event binding

**Status:** ACTIVE-D1056
**Phase:** 5 — Financials
**Branch:** `phase-5/order373-carried-source-report-event-binding`
**Base:** exact withheld Order355 governance frontier `d9db3f55a5da948b040001b016eec609630bdac7`; product candidate `40eed2b7d4a32a114121023688b9561a052b5c8d`
**Risk tier:** 3 — tenant-scoped financial close evidence and immutable discrepancy lineage
**Owner:** Codex implementation; different fresh independent non-implementing Tier-3 reviewer

## Outcome

Repair only D1055's reproducible carried-lineage containment defect. A carried target
is safely attributable only when the immutable carry link's source discrepancy,
property and source business date agree with exactly one canonical typed
`discrepancy.reported` outbox event for that source discrepancy. A self-consistent
link/request hash pointed at a third existing business day must remain unknown and
fail closed.

This order changes no carry transition, schema, event, hash formula, write path,
result shape, reason vocabulary or seal authority.

## Authority and exact scope

D1055 withholds Order355 after a fresh reviewer changed only the immutable link's
`source_business_date` to a third existing same-property day and recomputed the exact
migration0063 request hash. The candidate admitted the target because it checked
source-day existence and internal hash consistency but did not bind those values to
the source discrepancy's canonical typed report event.

Exact product and permanent-proof scope:

- `src/contexts/financials/business-day-close-readiness.ts`;
- `tests/business-day-discrepancy-carry.integration.test.ts`;
- this order, its review, `DECISIONS.log` and `handoff/LEDGER.md`.

Any other product, test, documentation, migration or catalogue file requires a
recorded pre-edit scope amendment. `.yellow`, stable port 3000 and all local data are
protected and out of scope.

## Required behavior

For the carried path, require exactly one same-tenant source
`discrepancy.reported` event with:

- `aggregate_type='discrepancy'` and aggregate id equal to the exact source
  discrepancy id;
- typed `property_node` equal to both the source discrepancy/link property and the
  target property;
- typed `business_date` equal to the immutable link/source discrepancy source date;
- no reliance on payload JSON.

Missing, duplicated, foreign, wrong-aggregate, wrong-property or wrong-date source
report evidence is unknown/fail-closed. Recomputing `request_hash` or
`discrepancy_state_hash` cannot repair mismatched event lineage. Ordinary reported
targets, valid carried targets, source/other-property silence, zero-write behavior and
the existing public result remain unchanged.

## Executable proof

1. **Intentional red:** permanently reproduce D1055 using the real governed carry,
   a third existing same-property day, hostile immutable-link date change and exact
   migration0063 request-hash recomputation. Before production edits the exact case
   must fail alone because unresolved is incorrectly one rather than zero/unknown.
2. **Canonical repair:** the same hostile case becomes unknown while the unmodified
   valid carried target remains exactly one existing unresolved-discrepancy blocker.
3. **Exactly-one hostility:** missing, duplicate, foreign, wrong aggregate/id,
   wrong property and wrong typed source date report events all fail closed; payload
   forgeries stay irrelevant.
4. **Preservation:** rerun the complete Order349/352/355 readiness and Order351 carry
   matrices, mutation-sensitive hash/source-event cases, catalogue-derived zero-write
   proof and unchanged `63/116/106/106/15/2` catalogue.
5. **Permanent gates:** focused suites, standing suite, typecheck, boundaries,
   licences, audit, migration/acceptance/runtime-DML/SECURITY-DEFINER/seeds/schema and
   fresh referee `11/11`.
6. **Independent approval:** a different fresh non-implementing Tier-3 reviewer must
   personally execute the D1055 exploit, exact hostile event matrix, mutation proof
   and all permanent gates on the exact candidate before Order355 or Order373 closes.

## Forbidden

- migration/schema/table/index/constraint/policy/role/permission/capability change;
- discrepancy, carry-link, outbox, fact, approval, business-day, journal or any other
  write behavior;
- accepting event payload JSON, caller hashes, clocks, cache or projection authority;
- seal/reopen/roll/carry mutation/API/UI/local/promotion/deploy/merge/Phase completion;
- weakening Order349/352/351/355 fail-closed, exact-count, tenant or zero-write proof.

## Definition of done

- [ ] D1055 exploit is a permanent isolated intentional red before product edits.
- [ ] Source property/date is exact-bound to exactly one canonical typed source report
      event and every hostile variant fails closed.
- [ ] Valid ordinary and carried behavior plus all permanent gates remain green.
- [ ] Different fresh Tier-3 approval is recorded before Orders355/373 close.

