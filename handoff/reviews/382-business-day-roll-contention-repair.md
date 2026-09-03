# Order 382 — fresh independent Tier-3 review

**Verdict:** WITHHELD — canonical PG16.15 schema snapshot is stale

**Candidate:** `4ce27983bc5abeef64b54ad1f0d77cd7046f1d90`

**Activation:** `a02e954ab2ab9f9cfe107206170ccdb08900fd4f`

**Reviewer:** `/root/order382_fresh_tier3_reviewer`, fresh non-implementing Tier 3

**Date:** 2026-09-03

## Product proof

The candidate's business-day contention repair is green in every reviewer-personal
product proof:

- fresh Windows-native PostgreSQL 17.2 applied migrations 1–65 and returned exact
  catalogue `65/116/106/106/15/2`;
- `0061_runtime_due_business_day_scopes.sql` is byte-identical at SHA-256
  `50cf8593ac385b74fbe61da9d28f0ecf59b78297c7aff46ad073f34409efc34f`;
- migration0065 is exact at SHA-256
  `8e28af137263ff23ecacb1f9e49b4f48b203d5f8c3773d1c2471c5a78cae331a`;
- fresh catalogue exposes exactly `business_day_pkey PRIMARY KEY
  (property_node,business_date)` and
  `business_day_tenant_property_date_uq UNIQUE
  (tenant_id,property_node,business_date)`;
- two complete roll runs pass **12/0 with 68 assertions**, including ten independent
  reset-based twenty-contender cycles (**200 calls**) with no `23505`, exactly one
  `opened=true`, and exactly one day/fact/outbox effect per cycle;
- the same runs pass PostgreSQL-derived Toronto/Kolkata dates, old unsealed backlog,
  existing-day no-op, injected-event rollback and exact retry, inactive/foreign/group/
  invalid-timezone/malformed inputs, app-only execution and direct-DML denial;
- worker wiring plus positive runtime-DML authority pass **10/0 (141 assertions)**;
- the complete SECURITY DEFINER containment proof passes **3/0 (210 assertions)**,
  including hostile app-owned `pg_temp` shadows and exact fixed-path/ACL catalogues;
- setup-current catalogue passes **1/0 (6 assertions)**; typecheck, 140-file import
  boundaries, 23-package licence policy, `bun audit` with zero vulnerabilities and
  `git diff --check` pass;
- full standing passes **1225/0**, with 956 expected database skips and 18,611
  assertions;
- a newly recreated, migrated and fixture-loaded referee database passes **11/11**.

The diff from activation is restricted to migration0065, its exact schema/catalogue
oracles, the strengthened repeated race, bounded setup/carry frontier oracles and
Order382 documentation/governance. It contains no service, worker, server, seed,
dependency, HTTP/UI/status/local or Docker product behavior. Migration0061 is
unchanged.

## Mandatory gate blockers

Order382 explicitly requires migration/schema/acceptance gates to pass and prohibits
a waiver. The assigned reviewer environment is expressly Windows-native PG17/Bun.
Two reproducible platform mismatches therefore prevent approval:

1. `tests/migrate.integration.test.ts` is **38 pass / 1 fail (183 assertions)**.
   The deliberate wrong-password case expects `error.errno === "28P01"`; Bun 1.3.14
   against PostgreSQL 17.2 returns the authentication failure without an `errno`.
   All 38 migration behavior, ledger, checksum, ordering, locking, rollback and
   migration0065 cases pass.
2. After applying the canonical seed, `tests/database-acceptance.integration.test.ts`
   is **22 pass / 1 fail (65 assertions)**. Every candidate-relevant ledger,
   catalogue, owner, RLS, ACL and seed assertion passes. The sole red requires exact
   PostgreSQL `16.15` and `shared_preload_libraries=pg_stat_statements`; the mandated
   disposable host reports PostgreSQL `17.2` and no preload.

The PostgreSQL 17 dump also differs mechanically from the committed PostgreSQL 16.15
schema snapshot in version preamble, `transaction_timeout`, and dump ordering, so it
cannot satisfy the exact schema gate without an unauthorized environment waiver.
No product/test repair was made by this reviewer.

## Teardown

The disposable PostgreSQL server was stopped, port 55482 refused connections, and
the exact `E:\yellow\order382-review-5d6c2a1b` root was removed. The exact
`C:\Users\astha\AppData\Local\Temp\wsl-crashes` path is absent. The stable local,
Docker, `.yellow`, deployment, merge and push surfaces were untouched.

## Fresh exact-version rereview — D1105

**Activation:** `329bc4ba8ead99987b4e2929c396674be1d313d8`

**Unchanged product candidate:** `4ce27983bc5abeef64b54ad1f0d77cd7046f1d90`

**Reviewer:** `/root/order382_pg16_fresh_reviewer`, fresh distinct non-implementing
Tier 3

The reviewer used only official Windows PostgreSQL 16.15 at
`E:\yellow\toolchains\postgresql-16.15\pgsql\bin` and Bun 1.3.14. A fresh cluster
preloaded `pg_stat_statements`, applied migrations 1–65, and proved catalogue
`65/116/106/106/15/2`; exact arbiters
`business_day_pkey(property_node,business_date)` and
`business_day_tenant_property_date_uq(tenant_id,property_node,business_date)`;
migration0061 SHA-256
`50cf8593ac385b74fbe61da9d28f0ecf59b78297c7aff46ad073f34409efc34f`; and
migration0065 SHA-256
`8e28af137263ff23ecacb1f9e49b4f48b203d5f8c3773d1c2471c5a78cae331a`.

Two roll runs pass **12/0 with 68 assertions**, including ten reset-based
twenty-client races (200 calls), one exact effect per cycle, rollback/retry,
backlog, property-local date, hostile authority and direct-DML denial. Worker,
runtime-DML, definer containment and setup-oracle tests pass **14/0 with 357
assertions**. Migration regression passes **39/0 with 187 assertions**, including
wrong-password `28P01`. Canonical seed succeeds and database acceptance passes
**23/0 with 65 assertions**. Standing passes **1225/0**, 956 expected skips and
18,611 assertions; typecheck, 140-file boundaries, 23-package licence policy and
zero-vulnerability audit pass.

The required schema gate is red. A normalized native PG16.15 dump diverges at line
6660: live truth correctly contains migration0064's
`seal_business_day_audited(uuid,uuid,date,uuid)` function and ACL, but the committed
snapshot omits both. Order382 forbids waiver and reviewer repair, so approval is
withheld. The server stopped, port 55483 returned no response, the disposable root
was removed, and the WSL crash path was absent. Reusable PG16.15 infrastructure
remains under `E:\yellow` as required.
