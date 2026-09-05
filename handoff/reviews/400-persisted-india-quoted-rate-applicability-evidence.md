# Order 400 — fresh independent Tier-3 review

**Verdict:** CHANGES-REQUIRED-D1176
**Candidate:** `417c84d`
**Implementation base:** `918a6c5`
**Reviewer:** `/root/order400_fresh_tier3_review`, fresh non-implementing Tier 3

Approval is withheld because the exact committed candidate is not green. The
regenerated schema snapshot contains 119 public tables after migration 0069, but two
permanent catalogue assertions still require the pre-Order400 count of 116:

- `tests/setup-current-catalogue-oracle.test.ts:18` expects
  `publicBaseTables: 116`; reviewer execution receives 119 and the focused aggregate
  ends **17 pass, 6 skip, 1 fail** with 951 assertions.
- `tests/migrate.integration.test.ts:519` expects `[{ count: 116 }]` in the exact
  app-role-internalization preservation case; reviewer execution receives 119.

These assertions must be repaired narrowly to the current 119-table frontier, then a
different fresh Tier-3 reviewer must restart the complete Order400 proof. No product,
migration, schema or authority relaxation is required by this finding.

## Reviewer-personal execution

I read `PROJECT.md`, ran `state.sh`, read the Phase 7 plan, Order400, D1173-D1174,
the architecture/constitution, roster/workflow, and the complete Yellow PostgreSQL
and compliance skills before inspecting the exact 21-file candidate delta.

On a disposable PostgreSQL **16.15** Alpine container with
`pg_stat_statements` preloaded, randomly generated isolated deployment/runtime/
registrar credentials and a tmpfs data directory, I personally obtained:

- fresh migrations 1-69 and exact catalogue **69/119/109/109/18/2**;
- Order341/400 focused and live runtime proof **18 pass, 0 fail, 965 assertions**,
  including owner-mediated capability shape, forced RLS, app-role SELECT-only ACL,
  one atomic record, write-free service replay and transaction rollback;
- canonical-seed database acceptance **23 pass, 0 fail, 65 assertions**;
- normalized PostgreSQL schema byte-for-byte equal to
  `tests/schema/expected.sql`;
- app-role/runtime containment **8 pass, 0 fail, 9 expected skips, 49 assertions**;
- a separately migrated and fixture-loaded referee database
  **11 passed, 0 failed of 11**.

The migration regression progressed through multiple fresh-database cases before the
second stale-116 assertion failed. Per coordination direction, I stopped the remaining
expensive proof after reproducing the mandatory permanent-gate failures; therefore
hostile/race/bound executions not already reached are not claimed and must be restarted
by the different fresh rereviewer after repair.

The exact disposable container `yellow-order400-review-pg` was removed after the
run. The sole stable loopback app and its Order311 PostgreSQL/provider/Valkey
containers remained healthy and untouched. I did not read or modify `.yellow`, and
made no product, source, test, migration, schema, database, local-app, deploy, merge,
push or credential change.
