# ORDER 012 — fresh-database CI, RLS proof, and schema drift

**Phase:** 0 · **Branch:** `phase-0/database-ci-schema-drift`
**Written by:** OpenAI Codex, acting as temporary architect by founder authorization
**Date:** 2026-08-15 · **Tier:** 3

## Goal

Make CI prove the production migration/seed path, the canonical invariant battery,
and deterministic schema drift against the same pinned PostgreSQL build.

## Why now

Orders 010–011 provide production-shaped database entry points. Phase 0 is not done
until a fresh runner executes them automatically and proves tenant isolation through
tables and views without creating a second domain oracle.

Start from the reviewed Order 011 head.

## Scope — files Codex may create or change

- `.github/workflows/ci.yml`
- `docker-compose.yml`
- `scripts/schema-drift.ts`
- `tests/schema-drift.test.ts`
- `tests/schema/expected.sql`
- `tests/database-acceptance.integration.test.ts`
- `tests/run_invariants.py`
- `requirements-ci.txt`
- `package.json`
- `docs/DEPENDENCIES.md`

No migration or fixture file is in Scope.

## Contracts to honour

- `PROJECT.md` — tenancy/view invariant and canonical referee
- `DECISIONS.log` — D-59, D-69, and D-75
- `handoff/questions/007-ARCHITECT-RESPONSE.md` — Decision D position
- `handoff/questions/008-ARCHITECT-RESPONSE.md` — Gate 4 adjudication
- Orders 010 and 011 public CLI/test contracts

## Pin the database environment

Change the Compose PostgreSQL image to exactly:

```text
postgres:16.15-alpine@sha256:ab5c955e9e57ae9879d4411ab49a912be9d162455676f7bf56e951b11ac73785
```

Retain the existing `shared_preload_libraries=pg_stat_statements`, tracking, logging,
healthcheck, credentials, and data volume unless this order explicitly says otherwise.
CI must start only this Compose service initially (`docker compose up -d postgres`),
not duplicate it as a GitHub service container.

## Declare the existing Python referee dependency

Create `requirements-ci.txt` for CPython 3.12/Linux x86_64 containing only
`psycopg2-binary==2.9.12`, installed with `pip --require-hashes`. Pin the selected
wheel to SHA-256:

```text
9fe06d93e72f1c048e731a2e3e7854a5bfaa58fc736068df90b352cefe66f03f
```

Document in `docs/DEPENDENCIES.md` that this LGPL package is a CI-only dependency of
the already-canonical Python referee, approved by D-75, and is not present in the
application image/runtime. Do not add any other Python dependency.

## Preserve one RLS oracle and strengthen it in place

`tests/run_invariants.py` is architect-only; this order authorizes only these changes:

### TC-13.1

Keep the existing behavioral predicate (`tenant A sees 16 spaces; tenant B sees 0`).
On an owner connection, also enumerate every public **base table** containing a
`tenant_id` column and require each to have row security enabled and a policy named
`tenant_isolation`. Include catalog totals in the existing TC-13.1 detail. Do not
hardcode the number of tenant tables.

### TC-13.4

Strengthen the existing `current_rate_price` behavior predicate so tenant A's returned
tenant IDs must all equal `T_A`, tenant B's must all equal `T_B`, and both result sets
must remain nonempty. Counting one distinct tenant is not enough if it is the wrong
tenant. Also enumerate every public view and require its `pg_class.reloptions` to contain
`security_invoker=true`. Require at least one public view so vacuous truth cannot
pass. Include view/catalog totals in the existing detail.

Do not add, remove, or renumber a TC. Final output remains eleven tests. Do not change
RLS policies, roles, grants, tenant context, fixture data, or domain SQL.

## Deployment acceptance test (not a second domain oracle)

`tests/database-acceptance.integration.test.ts` checks deployment plumbing only on an
explicit target URL:

- PostgreSQL reports version 16.15 and `pg_stat_statements` is preloaded/available;
- `schema_migration` contains baseline version 1 with the D-73 filename/hash;
- its owner is the deployment user, RLS is disabled on it, PUBLIC has no privilege,
  and `app_role` has no SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER;
- every public base table and view is owned by the deployment user and none by
  `app_role`;
- every non-extension-owned public function is owned by the deployment user;
- the exact D-74 tenant and property exist and no additional tenant/property does;
- canonical seed values match exactly.

It must not reimplement occupancy, journal, fiscal, document-numbering, or RLS
behavior. Those remain exclusively in the Python referee.

## Deterministic schema drift

`scripts/schema-drift.ts` must export a pure normalizer and a CLI:

- invoke the pinned Compose Postgres container's `pg_dump`, never a host/floating
  client;
- accept a validated database name through an explicit environment variable;
- use `--schema-only --no-owner --no-comments`; do not supply `--restrict-key`—let
  `pg_dump` generate its unpredictable safety key, then normalize only its wrapper
  lines; retain ACLs, security labels, and table access methods as drift signal;
- normalize CRLF to LF;
- remove only exact anchored `\restrict <alphanumeric-token>` and
  `\unrestrict <same-token>` wrapper lines, require both tokens to match, and ensure
  exactly one final LF;
- retain generated headers/footers, session `SET`/`set_config` preamble, ACLs, object
  order, and SQL bodies; do not sort or otherwise rewrite them;
- `--print` writes normalized output to stdout;
- `--check` compares byte-for-byte with `tests/schema/expected.sql`, prints a useful
  diff summary, and exits nonzero on mismatch;
- never overwrite the snapshot automatically.

`tests/schema-drift.test.ts` proves normalization is deterministic/idempotent, retains
headers, session settings, ACLs, object order and bodies, rejects mismatched/malformed
restrict wrappers, removes only the two valid random-key lines, and reports a
controlled mismatch.

Generate `tests/schema/expected.sql` through the Order 010 runner on an empty database
before seed. It must include `schema_migration`, all baseline objects, functions,
triggers, views, policies, indexes, and ACLs. Ownership is environment-specific and
therefore asserted through deployment acceptance; comments are non-executable and
deliberately excluded. Capture two fresh dumps and require byte identity before
committing the snapshot.

Add package scripts `schema:print`, `schema:check`, and `test:database` as needed.

## Required CI database job

Add a blocking job after `quality` with fully commit-pinned actions. It must:

1. Checkout and set up the same pinned Bun version as `quality`.
2. Set up pinned CPython 3.12 and install `requirements-ci.txt --require-hashes`.
3. Run frozen Bun install.
4. Start only Compose Postgres and wait for health.
5. Run the dedicated migration integration suite.
6. Run the dedicated seed integration suite.
7. Create a clean deployment database; run the production migration CLI and seed CLI.
8. Run deployment acceptance and schema drift on it.
9. Start the app service and require exact `/health` HTTP 200 body.
10. Create a separate invariant database; run the production migration CLI.
11. Load only `tests/seed_fixture.sql` with `psql` (direct schema loading is forbidden).
12. Run `tests/run_invariants.py` against that database and require 11/11.
13. Always print relevant Compose logs on failure and `docker compose down -v` in
    cleanup.

Database names must be CI-local constants, never interpolated from untrusted input.
Credentials remain local CI values. No external account or service is used.

## Definition of done

- [ ] `quality`, `container-smoke`, and the new database job pass.
- [ ] Fresh deployment DB proves runner → seed → exact rows → health.
- [ ] Separate invariant DB proves runner → fixture →
      `11 passed, 0 failed of 11`.
- [ ] TC-13.1 covers behavior plus every tenant base table's RLS/policy.
- [ ] TC-13.4 proves each view result carries the expected tenant identity plus every
      public view's security-invoker option.
- [ ] Two independently captured normalized dumps are identical.
- [ ] `schema:check` is empty against the committed snapshot.
- [ ] A controlled schema change makes `schema:check` fail.
- [ ] No CI step loads schema with `psql -f migrations/...`.
- [ ] Python dependency is pinned, hashed, documented, and absent from runtime image.
- [ ] `git diff --check` is clean and only Scope files changed.

## Forbidden in this order

- Editing `migrations/0001_init.sql`, any new migration, or `tests/seed_fixture.sql`.
- Changing RLS policy behavior, grants, tenant context, roles, occupancy, journal,
  fiscal logic, states, or events.
- A Bun/domain duplicate of any Python invariant test.
- Updating the snapshot to hide an unexplained diff.
- Floating Postgres/Python dependencies or unpinned GitHub Actions.
- Running the database job against a shared/non-CI database.
- Implementing Order 013.

## Review requirement

Tier 3. Claude must independently inspect the battery diff, privilege assertions,
snapshot contents/normalizer, and a full clean GitHub Actions run before cumulative
integration. The builder may not approve or merge.
