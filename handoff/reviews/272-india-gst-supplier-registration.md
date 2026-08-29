# Order 272 — Independent Tier-3 review

**Verdict:** APPROVE  
**Reviewer:** fresh non-implementing OpenAI Codex Tier-3 reviewer  
**Reviewed commit:** `4c1703a825407549362d72c8b6b0bea1a7d5f58f`  
**Reviewed base:** `3c9fb7c`  
**Reviewed range:** `3c9fb7c..4c1703a` (two commits: Order admission and build)  
**Date:** 2026-08-29

## Independence and inspection

I implemented none of Order272. I read `PROJECT.md`, ran `./state.sh`, and read
Order272, D-709/D-710, the Phase-7 build/roadmap material, roster/workflow and the
mandatory Yellow compliance, PostgreSQL and entity-pattern instructions. I inspected
the complete frozen range and every changed product/schema/test path. The shared
checkout and retained local services were not used for execution or database access.

Migration0047 has exact SHA-256
`7e5b8a912230ebbd7cf033b4883a7138ba5ae2d9fcb007dda42b5345d1c95bf0`.
It adds one tenant-leading table and lookup, a composite tenant/property foreign key,
an extension identity foreign key, `UNIQUE NULLS NOT DISTINCT` over the complete
frozen mapping, transaction-context RLS, and only app-role SELECT. PUBLIC,
`yellow_runtime`, and app-role mutation authority are absent.

The resolver composes approved positive-tax eligibility, admits only exact `IN` and
`INR`, joins an exact tenant-owned `org_node.kind='property'`, and binds extension id,
nullable owner, key, numeric version and content hash without current-config,
effective-date, display-name, party or guest fallback. The public result is supplier
evidence only: no eligibility object is exposed. Every returned nested record is
frozen; replay is byte-identical and the evidence SHA-256 includes the tenant while
the public result does not expose it.

The database and runtime share the same active GST state/UT allowlist. Canonical
GSTIN shape, state prefix and checksum, pincode, bounded trimmed/NFC text and hostile
control rejection all fail closed. The focused effect oracle hashes registration-row
bytes and counts tax attribution snapshots/hold/reservation/journal lineage,
semantic-route configuration, tax details, journals, postings, documents, outbox,
fiscal submissions and idempotency before and after happy, replay and failure paths;
all remain unchanged.

## Personally executed proof

All database proof ran only against standalone PostgreSQL 16.15 container
`yellow-o272-r3-pg-4c1703a-a9f61b`, dedicated volume
`yellow-o272-r3-pgdata-4c1703a-a9f61b`, and Docker-assigned loopback port `52522`.
The image was `postgres:16.15-alpine`, with `pg_stat_statements` preloaded. Separate
canonical `yellow_dev`, focused/referee `yellow_test`, and migration-runner temporary
databases were used.

Commands and results:

- `bun test tests/india-gst-supplier-registration.intentional-red.test.ts
  tests/india-gst-supplier-registration.integration.test.ts` with required isolated
  deploy/runtime URLs: **16 passed, 0 failed, 124 assertions**. The live focused
  Order272 file contributed its exact **11 tests**.
- `YELLOW_REQUIRE_DATABASE_ACCEPTANCE=1 bun test
  tests/database-acceptance.integration.test.ts`: **12 passed, 0 failed, 30
  assertions**, including PostgreSQL 16.15, migration checksum, exact table shape,
  constraints, owner, RLS, ACL and canonical seed.
- `YELLOW_REQUIRE_RUNTIME_DML=1 bun test
  tests/runtime-dml-authority.integration.test.ts`: **5 passed, 0 failed, 106
  assertions**.
- `YELLOW_REQUIRE_MIGRATION_DB=1 bun test tests/migrate.integration.test.ts` against
  the isolated unprotected `postgres` administration database: **39 passed, 0
  failed, 183 assertions**, exit 0. The staged historical-lineage case applied
  correction, repair and India registration exactly once.
- A second production runner invocation against migrated `yellow_dev` reported
  `applied=0 status=no-op transaction_pids=none`.
- A live `pg_dump --schema-only --no-owner --no-comments`, with only PostgreSQL's
  matched random restrict wrappers removed, matched `tests/schema/expected.sql`
  byte-for-byte (normalized SHA-256
  `a304cf9a0c7e0faedcce3606cff7f87a0fd4404a57f5638c03a05b2ac4012787`).
  Direct catalog truth was **47 migrations / 99 public tables / 89 policies**.
- A reviewer-written SQL challenge generated checksum-valid GSTINs for inactive
  state codes `25` (`25AAPFU0939F1ZZ`) and `28` (`28AAPFU0939F1ZT`). Both inserts
  raised the expected check violation inside isolated subtransactions and the final
  row count was `invalid-code-writes=0`.
- A separate inline Bun harness forced a checksum-valid code-25 row through a mocked
  registration read, bypassing the database check solely to exercise the runtime
  validator. It returned the exact conflict `GST state code is invalid`; no supplier
  result was returned.
- I dropped and recreated only the disposable `yellow_test`, freshly applied all 47
  migrations, loaded `tests/seed_fixture.sql`, and ran
  `python tests/run_invariants.py yellow_test`: **11 passed, 0 failed of 11**. The
  referee reported **89 tenant tables / 89 RLS tables / 89 policies**.
- `bun run typecheck`, import boundaries (**98 TypeScript files**), license policy
  (**23 packages**), `bun audit` (**no vulnerabilities**) and
  `git diff --check 3c9fb7c..4c1703a` all passed.

## Harness notes and cleanup

The first migration invocation completed and cleaned its temporary databases, but
its command session yielded before the final summary was recoverable. I reran the
same required suite with a captured session and retained the exact green 39/0/183
result above. An initial schema command supplied unsupported `pg_dump -X`; it failed
before the schema comparison or custom SQL challenge, and the corrected command
passed. These were reviewer-harness issues, not product findings.

The exact disposable container and volume were removed and their absence verified.
The detached review worktree was also removed. No stable container, port, database
or volume was queried or mutated. Apart from this review record, no repository file
was changed. No blocking finding remains. Approval is limited to Order272 at exact
commit `4c1703a`; it grants no place-of-supply or GST decomposition, posting,
correction, fiscal document/IRP, local promotion, merge, deployment, Phase-7-complete
or application-complete authority.
