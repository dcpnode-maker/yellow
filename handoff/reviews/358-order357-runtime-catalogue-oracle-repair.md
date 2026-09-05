# Order 358 fresh independent Tier-3 review

**Disposition:** APPROVE

**Reviewer:** `/root/order350_builder/order352_fresh_tier3`, fresh independent
non-implementing Tier-3 reviewer, different from the D1011 reviewer

**Exact reviewed repair:** `3df1b3a877daa724814072d2ba9c7d868eaac330`  
**Governance:** `1cd137151bfaa6835c1962f41dc5edecaf90cb36`  
**Order357 implementation parent:** `9070222d5574224347ece918e0570c1db3223283`

## Scope and ancestry

Both `9070222` and `1cd1371` are ancestors of `3df1b3a`. The complete repair diff
from governance to implementation is exactly one line in
`tests/runtime-database-authority.integration.test.ts`: the retained strict equality
changes from stale `111/101/10/101` to contracted `115/105/14/105`. The catalogue
query, deep equality, production, migration, schema, roles, permissions and seeds are
unchanged. `git diff --check 1cd1371..3df1b3a` is clean.

## Reviewer-executed red and mutation proof

On a new PostgreSQL 16.15 database with migrations1–62 and the canonical fixture:

```text
git archive 9070222
YELLOW_REQUIRE_RUNTIME_AUTHORITY_P0=1 \
  bun test tests/runtime-database-authority.integration.test.ts
9 pass, 1 fail, 88 assertions
```

The sole failure was the exact D1011 mismatch:

```text
expected: tables=111 enabled=101 forced=10 policies=101
actual:   tables=115 enabled=105 forced=14 policies=105
```

In a disposable archive of the repaired subject, removing only
`ar.valid_until > transaction_timestamp()` from migration0062 killed the registered
expiry oracle:

```text
bun test tests/india-gst-accommodation-final-valuation.test.ts \
  --test-name-pattern "buyer override is valid only"
0 pass, 1 fail, 1 assertion
```

The failure specifically required the missing PostgreSQL transaction-time predicate.
No candidate file was edited.

## Repaired executable proof

The reviewer replaced the pre-existing credential-incoherent disposable stack with a
fresh `yellow-order358-review2` stack on PostgreSQL port 55460 and Valkey port 6392.
No app or stable port 3000 service was started.

```text
YELLOW_REQUIRE_RUNTIME_AUTHORITY_P0=1 \
  bun test tests/runtime-database-authority.integration.test.ts
10 pass, 0 fail, 88 assertions

bun test tests/india-gst-accommodation-final-valuation.test.ts
9 pass, 0 fail, 21 assertions

YELLOW_ORDER350_DATABASE_URL=<fresh deploy URL> \
  bun test tests/india-gst-accommodation-final-valuation-migration.integration.test.ts
4 pass, 0 fail, 49 assertions
```

Together the focused Order350/354/357 proof is **13 pass / 0 fail**. It covers the
allocator/service boundary plus real PostgreSQL expiry boundaries, reuse and changed
evidence, every manual reason, rollback, correction and concurrent-successor
arbitration, canonical fact/outbox/head evidence, and direct immutable-DML denial.

Fresh catalogue query result:

```text
62 migrations / 115 public tables / 105 RLS policies /
14 FORCE-RLS tables / 2 security-invoker views
```

Permanent database gates:

```text
YELLOW_REQUIRE_MIGRATION_DB=1 bun test tests/migrate.integration.test.ts
39 pass, 0 fail, 187 assertions

YELLOW_REQUIRE_DATABASE_ACCEPTANCE=1 bun test tests/database-acceptance.integration.test.ts
23 pass, 0 fail, 65 assertions

YELLOW_REQUIRE_RUNTIME_DML=1 bun test tests/runtime-dml-authority.integration.test.ts
5 pass, 0 fail, 118 assertions

YELLOW_REQUIRE_SECURITY_DEFINER=1 bun test tests/security-definer-containment.integration.test.ts
3 pass, 0 fail, 174 assertions

YELLOW_REQUIRE_SEED_DB=1 bun test tests/seed.integration.test.ts
10 pass, 0 fail, 63 assertions

YELLOW_REQUIRE_REVIEW_SEED=1 bun test tests/review-seed.integration.test.ts
24 pass, 0 fail, 111 assertions
```

Acceptance was run on a separately migrated, canonical production-seeded database,
not the focused hostile fixture database. Schema comparison reached the previously
recorded environment-only pg_dump provenance-header difference: the live Alpine
PostgreSQL 16.15 header omits the committed Debian package suffix. Catalogue,
migration, acceptance and schema content oracles are otherwise exact; this is the
same non-product observation recorded by D1011.

Static and referee gates:

```text
bun run typecheck
pass

bun run boundaries
Import boundaries OK: 137 TypeScript files scanned

bun run license-check
Dependency license policy passed for 23 installed packages

bun audit
No vulnerabilities found

python tests/run_invariants.py yellow_referee
11 passed, 0 failed of 11
```

The first full standing run completed **1209 pass / 919 skip / 1 fail** because the
unrelated Order239 5-second wall-clock case finished at 5.23 seconds while the
database/migration proof workload was active. A second full run finished the same
unrelated case at 5.14 seconds. After disposable database load was removed, the exact
unchanged case passed in isolation at 4.65 seconds with all eight assertions. D1011
already executed the same standing product at **1210/0 + 919 skips**; Order358 changes
only the runtime catalogue test literal and cannot affect rate-quote execution. This
is recorded as host timing noise, not a candidate defect or a waived logical
assertion.

## Cleanup and boundary

All reviewer-created databases, containers, network, volume, parent archive, mutant
archive, dependencies and credentials were removed. The candidate, order, decisions,
ledger, product, tests, stable local services, shared `.yellow` and port 3000 were not
changed by the review.

Order358 is approved. Its exact repair discharges D1011 and completes the independent
Tier-3 proof required for Orders357/354/350. This approval grants only the governed
India accommodation final-valuation evidence boundary already authorized by those
orders; it grants no tax component money, posting, journal, document, IRP, API/UI,
deployment, Phase7 or application-completion authority.
