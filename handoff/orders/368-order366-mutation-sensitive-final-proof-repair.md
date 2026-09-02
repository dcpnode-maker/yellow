# Order 368 — Order366 mutation-sensitive final carry-proof repair

**Status:** ACTIVE-D1035
**Phase:** 5 — Financials
**Branch:** `phase-5/order366-mutation-sensitive-final-proof-repair`
**Base:** exact withheld candidate `2f631a5` / governance `e4c6e35`
**Risk tier:** 3 — irreversible carry authorization and atomic evidence proof
**Owner:** Codex proof implementation; different fresh non-implementing Tier-3 reviewer

## Outcome and exact scope

Modify only `tests/business-day-discrepancy-carry.integration.test.ts` and bounded
test-local helpers to kill the four exact surviving Order366 review mutants:

1. isolate approval reuse with a pre-existing row whose request, source and target do
   not collide with the candidate, so removing only approval uniqueness fails;
2. isolate request reuse with a different approval, source and target, so removing
   only request uniqueness fails;
3. observe the canonical typed outbox row inside the supplied transaction after its
   insertion and before the injected throw, while retaining post-rollback zero state
   and clean retry, so removing the publish call fails; and
4. replace duplicate self-declared snapshot arrays with an independent catalogue-
   derived zero-write observation of every tenant-bearing public relation except the
   exact carry mutation/evidence surfaces. Removing any required financial/cashier/
   trust/tax/fiscal relation from observation must fail without editing a second list.

Personally run each exact mutant, fresh focused PostgreSQL, exact catalogue and the
complete Order366/363/359/351 gate matrix. A different fresh non-implementing Tier-3
reviewer must execute the same decisive proof before approval.

## Forbidden

No production, migration, schema, catalogue, policy, role, event vocabulary,
permission, financial behavior, UI, local, Docker-stable, `.yellow`, port3000,
merge, deploy or downstream change. No second guard may mask the named constraint,
and no expected observation surface may be generated from the same mutable list as
the snapshot it checks.
