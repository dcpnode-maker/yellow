# Independent review — Order 103 operator idempotency actor binding

**Result:** APPROVED

**Reviewed tip:** `f4bb729`

**Implementation base:** `c32b7d7`

**Reviewer:** independent non-implementing Codex reviewer

**Date:** 2026-08-24

The reviewer did not implement Order 103, edit the repository, push, or merge. The
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
before and after review. Approval is exclusive to Order 103's operator-adapter actor
binding and exact proof maintenance. It does not approve any later security finding,
deployment change, migration, authorization expansion or merge.
