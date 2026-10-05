# Order 359 — Order351 decision-time and hostile-proof repair

**Status:** INDEPENDENTLY-APPROVED-D1043 — exact candidate `5b9b9dd`
**Phase:** 5 — Financials
**Branch:** `phase-5/order351-decision-time-proof-repair`
**Base:** exact withheld implementation `728d944` / governance `d36fa0a`
**Risk tier:** 3 — four-eyes authorization and irreversible discrepancy transition
**Owner:** Codex repair implementation; different fresh non-implementing Tier-3 reviewer

## Outcome

Close the two exact Order351 P1 findings without changing its product policy. The
owner-mediated carry capability must reject an approval whose recorded decision is
later than PostgreSQL transaction time. Permanent fresh-PostgreSQL proof must cover
the complete hostile matrix already required by Order351.

## Exact scope

- `migrations/0063_governed_business_day_discrepancy_carry.sql`, only the missing
  decision-time predicate and no schema/catalogue change;
- one committed Order351 fresh-PostgreSQL integration suite plus only directly
  affected exact test wiring/oracles;
- Order351/359 governance and independent review evidence.

## Required executable proof

1. Reproduce the parent future-decision bypass before repair; after repair prove
   past/now accepted and future/exact-30-minute/later decisions rejected as contracted.
2. Prove pending/rejected/expired/self/unauthorized/inactive decisions, payload/hash/
   lineage/tenant/property/actor/source/target/day/timezone staleness fail with zero
   artifacts.
3. Prove injected rollback after every transition boundary permits one clean retry;
   exact replay is stable, changed content conflicts, and 20 same/different-key or
   two-approval contenders converge to one carry/target/fact/event.
4. Prove approval/source/target/request reuse denial, cross-tenant zero reads, raw
   write denial, both days unchanged, and journal/posting/folio/payment/document/tax/
   balance state byte-identical.
5. Fresh exact `63/116/106/15/2`, migration, acceptance, runtime-DML,
   SECURITY-DEFINER, seed/review-seed, standing/static/schema and referee `11/11` pass.

## Forbidden

No new migration/table/event/permission/route/UI; no policy-window change; no seal,
readiness, reopen, roll, ordinary resolution, monetary mutation, local promotion,
deployment, merge, `.yellow` or port3000 change. Do not weaken a gate or treat reviewer
temporary proof as permanent proof.

## Definition of done

- [ ] Parent bypass is reproduced and killed by PostgreSQL transaction time.
- [ ] Complete permanent hostile matrix is committed and green on fresh PostgreSQL.
- [ ] Exact catalogue and all repository/referee gates are green.
- [ ] A different fresh non-implementing Tier-3 reviewer personally approves.
