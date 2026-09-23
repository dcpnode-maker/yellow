# Independent Tier-3 review — Order 144 lifecycle parents before occupancy

**Verdict:** APPROVED  
**Reviewer:** independent non-implementing OpenAI Codex Tier-3 reviewer  
**Exact red:** `d8054fb673a6b4d72d5e9a75ee4cfc4fa0e6118c`  
**Exact executable:** `93069db186af231622e0419c82516e59e437d5e4`  
**Evidence head:** `5e83fae3b41fd24e68492aa27b7109e21701e01b`  
**Approved base:** `2faf5e8db8264af59e65effdfcb5603da628a181`

No implementation, sequencing, rollback, occupancy, tenancy, scope, schema, or
proof-strength finding was found. This approval is limited to Order 144; it does not
approve Order 126, migration or validation relaxation, merge, push, deployment, live
status, or Cyber closure.

## Reviewer-executed proof

On fresh `yellow_o144r_red`, exact red P0 failed its static canary and real public
`reinstate` raised SQLSTATE `P0144`; direct readback retained cancelled reservation and
segment parents, zero claims, and zero reinstatement fact/event artifacts. The guard
validated the complete same-tenant reservation/segment/sellable/property/space/period
chain and live parent state, not a status-only substitute.

The executable retains the locked reads, validation, idempotency transaction and
inventory choke point. It moves only the existing tenant/reservation/cancelled CAS
restore before `claimForSegment`, preserves its affected-row check, and completes
reservation state, fact, outbox and idempotency after acquisition. No direct occupancy
DML, compensating mutation, schema/migration, state/event, API, or contract change is
present.

```text
guarded lifecycle                 6/6,  65 assertions
reservation commit                5/5, 106 assertions
reservation HTTP commit           5/5,  61 assertions
holds                             9/9,  32 assertions
availability/inventory            7/7,  20 assertions
Order-129 parents                 7/7,  45 assertions
Order-143 segment changes         7/7, 115 assertions
reviewer-local matrix            19/19 isolated suites
fresh canonical acceptance        6/6,  13 assertions
fixture-seeded referee           11/11
standing                       174 pass / 422 skip / 0 fail / 1,983 assertions
```

The guarded lifecycle proof observed the exact `booked` parent at occupancy insert and
retained competitor rollback, one concurrent winner, replay, positional behavior, and
publication-failure rollback with same-key retry. The matrix used only freshly
migrated `yellow_o144r_m01`–`m19` databases, dropping each after use. Typecheck,
64-file boundaries, 23-package licence policy and audit passed. Protected hashes
matched: baseline `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`,
referee `2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d`, fixture
`bf71d8fc2987126db61ca3105e5d5cb5a4f48b9e2eba09d8b7fc1f3441fd4c62`, expected schema
`a5ffe526138e0c87365f58bbf1f0a08f51f531418aefe6ebe414ffda7e51d59a`.

Base-to-executable changes are exactly the two admitted implementation paths; the
remaining four paths are governance. `git diff --check` and Base → admission → red →
executable → evidence ancestry passed. All `yellow_o144r_*` databases and detached red
worktree were removed; shared PostgreSQL and Valkey remain running.
