# Question 164 — Order 150 inherited proof-fixture contraction

**Status:** OPEN — founder decision required
**Order:** 150
**Raised:** 2026-08-25
**Trigger:** continued P2/P4 discovery after Q162/Q163

## RESOLVED — D-419

The founder authorized the recommended separate proof-maintenance order on
2026-08-25. Order 152 owns exactly the eight Q163/Q164 test files and must preserve
the substantive tenant, rollback, ordering, crash and index-existence proofs without
restoring any contracted runtime privilege.

## Exact evidence

Fresh isolated databases prove the retained production paths for reservation commit,
reservation guests, pricing, rate supersession, extension, approval, inventory,
inventory policy, holds, operational blocks and availability projection. Several
older proofs instead depend on the blanket mutation authority that migration 0016
is intentionally removing:

- `tests/fact-log.integration.test.ts` inserts `app_user` through runtime;
- `tests/outbox.integration.test.ts` and `tests/relay.integration.test.ts` insert
  `task` as arbitrary effect/aggregate fixtures;
- `tests/idempotency.integration.test.ts` requires table-level INSERT/UPDATE even
  though v16 grants the exact caller columns;
- `tests/reservation-lifecycle.integration.test.ts` and
  `tests/reservation-segment-changes.integration.test.ts` create deploy-owned
  observation tables that a `yellow_owner` trigger then cannot mutate;
- `tests/party-profiles.integration.test.ts` proves both required indexes exist but
  requires PostgreSQL to choose one exact valid plan; PostgreSQL 16.15 chooses the
  tenant/id unique index for the tenant/status count on the fresh proof database.

These are proof-harness or oracle assumptions, not evidence that production needs
runtime mutation on `app_user`, `task`, or an arbitrary table-level grant. Regranting
those privileges would contradict Order 150 and its Base exploit evidence.

## Decision needed

Authorize one bounded proof-maintenance order (recommended), independent of the
Q162 production lock capability, to admit only the seven test files above. It must:

1. seed deploy/tool fixtures with deploy authority;
2. make observation-table ownership/grants explicit for the existing owner-trigger
   proof without altering the production trigger;
3. assert exact column privileges rather than obsolete table-level booleans;
4. preserve outbox/relay crash, ordering, isolation and tamper assertions using a
   deploy-created or currently authorized aggregate/effect fixture;
5. keep both Party index-existence checks and require an index-backed tenant plan
   without prescribing one cost-equivalent index name;
6. change no production caller, migration, role, state, event or domain assertion.

Alternative: authorize those exact proof-file edits directly inside Order 150 by
expanding its Scope. A separate order gives the clearer audit trail and avoids
mixing privilege contraction with inherited test maintenance.

Rejected: restore runtime `app_user`/`task` mutation, table-level idempotency DML,
or weaken the substantive crash/tenant/rollback/event proofs.

All discovery databases and the second Compose proof project were removed. No
production or proof file was changed after these failures.
