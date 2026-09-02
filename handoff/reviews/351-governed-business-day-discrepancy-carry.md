# Order 351 fresh independent Tier-3 review

**Disposition:** WITHHOLD

**Reviewer:** `/root/order350_builder/order352_fresh_tier3`, fresh independent
non-implementing Tier-3 reviewer

**Exact implementation:** `728d9447f29a1dabe13259014fde2b6b02740a8c`  
**Exact governance:** `d36fa0a6bbe68942f645d9ffaf149cb7e1ff0823`

## Findings

### P1 — a future-dated approval decision is immediately consumable

`carry_business_day_discrepancy` requires `a.decided_at IS NOT NULL`, a different
approver, and both decision and consumption before `a.created_at + interval '30
minutes'`. It never requires the recorded decision instant to be at or before
PostgreSQL `transaction_timestamp()`.

Consequently a persisted approval with `decided_at` twenty minutes in the future is
treated as already decided and can authorize the irreversible carry transition now.
That violates the exact approved/fresh/different-user authorization contract. The
capability must reject `a.decided_at > transaction_timestamp()` and permanently prove
the boundary on fresh PostgreSQL.

### P1 — the required hostile proof matrix is absent

The focused Order351 file contains only two source-presence tests. There is no
committed fresh-PostgreSQL carry integration suite for expiry decisions, payload and
lineage mutation, tenancy, stale day state, rollback, idempotency, races, reuse,
financial isolation, RLS or direct-DML hostility. Reviewer evidence exposes the
defect but cannot substitute for permanent mutation-sensitive proof.

## Reviewer-executed reproduction

The reviewer used an isolated detached worktree at exact `d36fa0a` and disposable
PostgreSQL 16 project `yellow-order351-review`. All 63 migrations applied. A temporary
fixture created one tenant/property/room, active requester and different authorized
approver, exact open source/current target days, one unresolved discrepancy and one
canonical `discrepancy.reported` event. The approval was otherwise valid but had:

```sql
status = 'approved',
created_at = transaction_timestamp(),
decided_at = transaction_timestamp() + interval '20 minutes'
```

The real `yellow_runtime` connection with transaction-local tenant context and
`SET LOCAL ROLE app_role` returned:

```text
bun tests/order351-future-decision.repro.ts
exit 0
{"returnedCarry":1,"future_decision":true,"carry_count":1,
 "source_resolution":"carried_forward"}
```

Additional reviewer proof: focused `2/0` (10 assertions), typecheck, 138 import
boundaries, 23-package licence policy, audit zero vulnerabilities and diff hygiene
passed. Broad gates stopped after the decisive executable P1 because they cannot cure
the bypass or absent proof matrix.

All disposable containers, network, volume, database, credentials, reproduction
harness, dependencies and worktree were removed. Stable port3000, `.yellow` and
Order353 were untouched.

## Boundary and required repair

Order351 remains withheld. Repair the PostgreSQL decision-time predicate and add the
complete permanent hostile database matrix specified by the order. A different fresh
non-implementing Tier-3 reviewer must rerun repaired proof and every exact
`63/116/106/15/2`, migration, authority, schema, standing and referee gate.

This review grants no carry, readiness, seal, reopen, roll, financial mutation,
API/UI, local, deployment, Phase5 or application-completion approval.
