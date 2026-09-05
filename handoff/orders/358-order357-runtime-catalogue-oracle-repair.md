# Order 358 — Order357 runtime catalogue oracle repair

**Status:** APPROVED-D1012
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/order357-runtime-catalogue-oracle-repair`
**Base:** exact withheld governance `4888831` / implementation `9070222`
**Risk tier:** 3 — permanent runtime authority oracle protecting tenant/RLS posture
**Owner:** Codex test-only repair; different fresh non-implementing Tier-3 reviewer

## Outcome

Repair only the exact stale PostgreSQL catalogue equality exposed by D1011. In
`tests/runtime-database-authority.integration.test.ts`, retain the current catalogue
query and strict deep equality and change expected public table/RLS totals from
`111/101/10/101` to migration0062's contracted and independently observed
`115/105/14/105`.

## Scope

- `tests/runtime-database-authority.integration.test.ts`
- this order plus review/decision/ledger evidence

No other test or file is admitted. Do not alter the query, equality, production,
migration, schema snapshot, permissions, roles, seeds, runtime, local or `.yellow`.

## Proof

D1011 is the intentional red: exact candidate runtime-database authority `9/1(88)`
with only this equality mismatch. After the one-line repair, personally run the full
runtime-database-authority suite on fresh PostgreSQL and then rerun every Order357
gate: parent expiry/mutant, focused proof, exact catalogue, migrate, acceptance,
runtime-DML, SECURITY-DEFINER, seed/review-seed, standing/static/schema and fresh
referee 11/11. A different fresh non-implementing Tier-3 reviewer—not the Order357
reviewer or any Order350/354/357 implementer—must execute and record the complete
proof before Orders350/354/357 can be approved.
