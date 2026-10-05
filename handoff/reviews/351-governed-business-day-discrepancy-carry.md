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
That violates the exact approved/fresh/different-user authorization contract and
permits consumption before the recorded approver decision exists. The owner-mediated
capability must reject at least `a.decided_at > transaction_timestamp()` and the
boundary must receive a permanent fresh-PostgreSQL hostile test.

### P1 — the required hostile proof matrix is absent

The only focused Order351 test file contains two source-presence/string-inspection
tests. There is no committed fresh-PostgreSQL carry integration suite. D1015 records
only one happy runtime carry/direct-insert denial and explicitly leaves the complete
hostile proof to this review.

The candidate therefore has no permanent executable coverage for the order's
required expiry boundaries, pending/rejected/expired/self/future/unauthorized
decisions, payload and lineage mutations, tenant/property/actor hostility, stale
source/target/day/timezone states, injected rollback boundaries, idempotency
conflicts, same/different-key races, approval/source/target reuse, financial-ledger
isolation, or cross-tenant RLS/direct-DML matrix. Reviewer-created evidence can expose
a defect but cannot substitute for the order's required mutation-sensitive permanent
proof.

## Reviewer-executed reproduction

The reviewer created an isolated detached worktree at exact `d36fa0a`, installed its
locked dependencies, and started a disposable PostgreSQL 16 stack as Compose project
`yellow-order351-review` on PostgreSQL port 55462 and Valkey port 6394. No app service
or port 3000 listener was started. A fresh database applied all 63 migrations.

A temporary uncommitted reproduction harness created only disposable fixture data:
one tenant/property/room, active requester and different authorized approver, exact
open source/current target days, one unresolved discrepancy with one canonical typed
`discrepancy.reported` event, and the exact payload returned by
`prepare_business_day_discrepancy_carry`. It then inserted the otherwise valid
approval with:

```sql
status = 'approved',
created_at = transaction_timestamp(),
decided_at = transaction_timestamp() + interval '20 minutes'
```

The governed function was invoked through a real `yellow_runtime` connection after
transaction-local tenant context and `SET LOCAL ROLE app_role`:

```text
bun tests/order351-future-decision.repro.ts
exit 0
{"returnedCarry":1,"future_decision":true,"carry_count":1,
 "source_resolution":"carried_forward"}
```

This proves the capability committed the carry while the approval decision remained
future-dated.

Focused/static commands executed before the decisive database finding:

```text
bun install --frozen-lockfile
23 packages installed

bun test tests/business-day-discrepancy-carry.test.ts
2 pass, 0 fail, 10 assertions

bun run typecheck
pass

bun run boundaries
Import boundaries OK: 138 TypeScript files scanned

bun run license-check
Dependency license policy passed for 23 installed packages

bun audit
No vulnerabilities found

git diff --check 728d944^..d36fa0a
pass
```

The requested catalogue, migration, acceptance, runtime-DML, SECURITY-DEFINER,
seed/review-seed, standing, schema and referee gates were not represented as approval
evidence. Per coordinator direction, broad gates stopped after the executable P1.
Their success could not cure an authorization bypass or the absent hostile suite.

## Boundary and required repair

Order351 remains withheld. Repair the PostgreSQL decision-time predicate and add the
complete permanent hostile database matrix specified by the order. A different fresh
non-implementing Tier-3 reviewer must then personally rerun the repaired hostile proof
and all exact `63/116/106/15/2`, migration, authority, schema, standing and referee
gates.

This review grants no discrepancy carry, readiness, seal, reopen, roll, financial
mutation, API/UI, local, deployment, Phase5 or application-completion approval.
