# Independent review — Order 112 operator idempotency actor binding

**Result:** APPROVED

**Reviewed tip:** `1ee0928b721c138a3e8269b6caf97e7669330396`

**Implementation base:** `a587a23`

**Rebased implementation commit:** `b2c8465`

**Reviewer:** independent non-implementing Codex reviewer

**Date:** 2026-08-24

The reviewer did not implement Order 112, edit the repository, push, or merge. The
exact diff contains 18 in-scope files and no migration, kernel, RLS, occupancy,
journal, payment, fiscal, reservation-domain, Party-domain or protected-referee
change. It has one raw `PostgresIdempotency.execute` delegation and exactly sixteen
operator helper calls with the sixteen pre-existing operation arguments. The helper
requires a UUID actor and adds it only to canonical request identity before delegating
to the unchanged kernel.

On reviewer-only Compose project `yellow-o103-review`, PostgreSQL port 55113 and
Valkey port 56113, the reviewer personally executed:

- `bun test tests/operator-idempotency-actor-binding.test.ts` — 1 passed, 0 failed,
  6 assertions;
- a newly created and migrated `yellow_o103_operator_review` database followed by
  `YELLOW_REQUIRE_OPERATOR_INVENTORY=1 bun test tests/operator-inventory.integration.test.ts`
  — 7 passed, 0 failed, 57 assertions;
- `YELLOW_REQUIRE_DATABASE_ACCEPTANCE=1 bun test tests/database-acceptance.integration.test.ts`
  against the fresh reviewer deployment — 4 passed, 0 failed, 10 assertions;
- `.\setup.ps1 -DbOnly` with app port 30103 unused — **11 passed, 0 failed of 11**;
  Compose contained only PostgreSQL and Valkey, so the application was never started.

The live two-actor case proves Actor B's reuse of Actor A's tenant, operation, key and
body returns generic `409 request/idempotency_conflict`, has no replay header or cached
success fields, writes no Actor-B fact/domain artifact, while Actor A's exact retry
remains a byte-equivalent 201 replay. Changed-request conflict and publisher rollback
before same-key retry also remain exact. A missing-actor HTTP canary returned 403 and
kept idempotency/domain counts unchanged; the helper guard independently rejects a
missing or malformed actor before delegation.

Questions 137 and 138 change only seven historical exact-role labels/literals from
the old 17-scope set to the already approved canonical 25-scope set. Exact sorted
equality remains; production seed, permission, token, route and fixture behavior are
unchanged.

Protected SHA-256 values remain exact:

- `migrations/0001_init.sql` —
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`;
- `tests/run_invariants.py` —
  `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`.

The reviewer removed its two containers, network and volume. The repository was clean
before and after review. That first execution remains pre-rebase evidence only.

Exact-tip approval is completed by two independent executions at `1ee0928`:

- reviewer-triggered GitHub database job `97330755653` checked out the exact SHA and
  passed the real two-actor operator proof at 7/7 with 57 assertions, all isolated
  Phase-3 suites, migration/seed/deployment/schema/referee gates and cleanup; its
  required quality job also passed;
- a second non-implementing reviewer ran canonical `.\setup.ps1 -DbOnly` from a clean
  exact-tip checkout through a Windows-to-WSL Docker bridge on unique project
  `yellow-order112-token-review`. Fresh migrations 0001–0009 produced exactly 84 public
  tables and the referee reported **11 passed, 0 failed of 11**. Compose contained only
  PostgreSQL and Valkey, so the app was never created or started. Protected hashes and
  HEAD remained exact, and the reviewer removed only that disposable project.

Approval is exclusive to Order 112's direct operator actor-bound idempotency repair and
the seven stale exact-role proof literals named by Questions 137–138. It does not
approve any later security finding, deployment change, authorization expansion or
merge.

## Exclusive Order 112 discharge

- 112
