# ORDER 011 — deterministic app-role bootstrap seed

**Phase:** 0 · **Branch:** `phase-0/bootstrap-seed`
**Written by:** OpenAI Codex, acting as temporary architect by founder authorization
**Date:** 2026-08-15 · **Tier:** 3

## Goal

Create one deterministic demo tenant/property through the application role with
transaction-local tenant context and exact-match idempotency.

## Why now

The production-shaped migration path exists after Order 010; Phase 0 next needs a
repeatable seed that proves application-role writes and tenant context without
confusing demo bootstrap data with the two-tenant invariant fixture.

Start from the reviewed Order 010 head.

## Scope — files Codex may create or change

- `scripts/seed.ts`
- `scripts/lib/uuid-v5.ts`
- `tests/uuid-v5.test.ts`
- `tests/seed.integration.test.ts`
- `package.json`
- `docker-compose.yml`

The Order 010 `database-tools` Docker target already copies `scripts/`; do not modify
the Dockerfile unless a concrete blocker is raised in `handoff/questions/011.md`.

## Contracts to honour

- `PROJECT.md` — tenancy invariant 5 and money representation
- `DECISIONS.log` — D-10 and D-74
- `handoff/questions/007-ARCHITECT-RESPONSE.md` — Decision C position
- `handoff/questions/008-ARCHITECT-RESPONSE.md` — Gate 3 adjudication
- `migrations/0001_init.sql` — `tenant` and `org_node` columns/checks (read only)

## Exact seed data

This is local/CI demo data, not production tenant onboarding:

| Entity | Canonical values |
|---|---|
| Tenant | id `6d9b7ce2-2d14-5576-b8c3-80f06501a603`; slug `yellow-demo`; name `Yellow Demo`; tier `shared`; residency `me-central`; status `active` |
| Property | id `4518a22f-b455-54c6-a50a-4584383749b9`; tenant id above; path `yellow_demo.property`; kind `property`; name `Yellow Demo Property`; timezone `UTC`; currency `USD`; config `{}` |

Do not seed users, roles, rooms, rates, accounts, or any other domain row.

## UUIDv5 contract

Implement UUIDv5 in `scripts/lib/uuid-v5.ts` with Web Crypto only:

- standard URL namespace UUID: `6ba7b811-9dad-11d1-80b4-00c04fd430c8`;
- tenant name: `https://yellow.local/seed/tenant/yellow-demo`;
- property namespace: the derived tenant UUID;
- property name: `org-node/yellow_demo.property`;
- set RFC version and variant bits exactly;
- accept and return canonical lowercase hyphenated UUID strings;
- reject malformed namespace UUIDs.

The unit test must include the standard DNS namespace
`6ba7b810-9dad-11d1-80b4-00c04fd430c8` + `www.example.com` vector and require
`2ed6657d-e927-568b-95e1-2665a8aea6a2`, plus both Yellow IDs above.

Do not use `uuid-ossp`, `gen_random_uuid()`, a UUID dependency, or hand-return the
expected literals without deriving them.

## Seed transaction and identity contract

`scripts/seed.ts` must export a testable function and provide a direct CLI that
requires `DATABASE_URL`. It must:

1. Reserve one Bun SQL connection and begin one transaction on it.
2. Execute `SET LOCAL ROLE app_role` before any seed write.
3. Assert `current_user = 'app_role'` inside the transaction.
4. Insert or inspect the global `tenant` row.
5. Execute `SELECT set_config('app.tenant_id', <tenant-id>, true)` and assert the
   transaction sees that exact value.
6. Insert or inspect the tenant-scoped property row.
7. Validate exact canonical values for both rows before commit.
8. Commit both or roll back both.
9. After commit, on the same reserved connection but outside that transaction, prove
   both `current_user` and `app.tenant_id` returned to their pre-transaction state.
10. Release/close in `finally` and redact credentials from errors.

The deployment connection must be able to `SET ROLE app_role`; local Compose's
`yellow` superuser satisfies this. Production provisioning is external and out of
scope. The script itself must not create roles or credentials.

## Exact-match idempotency

- An empty target inserts exactly the two rows.
- An identical rerun commits as a no-op and does not change `created_at`.
- Conflict by deterministic ID, tenant slug, or `(tenant_id, path)` must query the
  existing row and compare every canonical field.
- Any mismatch must hard-fail and roll back. Do not update, merge, overwrite, or hide
  the conflict with blind `ON CONFLICT DO NOTHING`.
- Report `inserted` versus `already exact` deterministically; do not log secrets.

Add package script `db:seed` and a dedicated `test:db:seed` integration script. The
default `bun test` may skip the real-DB file only when its explicit admin-test URL is
absent; the dedicated script must never skip.

## Compose tooling

Add a profile-`tools` `seed` service using the existing `database-tools` target,
depending on healthy Postgres and successful migration service completion where
Compose supports it. Its command runs `scripts/seed.ts` and its service-network URL
targets `yellow_dev`. Running
`docker compose --profile tools run --rm seed` twice must succeed, with the second run
reported as an exact no-op.

## Required real-PostgreSQL integration proofs

On uniquely named temporary databases created through the explicit admin-test URL:

1. Runner → seed produces exactly one tenant and one property with the exact values.
2. SQL-observed `current_user` during writes is `app_role`.
3. Identical second run changes no row and preserves timestamps.
4. Mutating each canonical collision class causes a hard failure and no partial write.
5. A forced failure after tenant handling but before property completion rolls back
   both new rows.
6. Tenant context and local role disappear after commit.
7. Tenant context and local role disappear after rollback.
8. Reusing the same pooled/reserved backend does not expose the prior tenant context.
9. The two-tenant `tests/seed_fixture.sql` remains unchanged and separate.

Tests must clean databases and OS temporary files in `finally`.

## Definition of done

- [ ] UUIDv5 vector and exact Yellow IDs pass.
- [ ] All nine seed integration proofs pass on PostgreSQL 16.
- [ ] `bun run db:seed` is exact-no-op idempotent.
- [ ] Compose seed service works twice after migrate.
- [ ] `bun run typecheck` and default `bun test` pass.
- [ ] The full Python referee remains `11 passed, 0 failed of 11`.
- [ ] No file outside Scope changes and `git diff --check` is clean.

## Forbidden in this order

- Editing `migrations/`, `tests/run_invariants.py`, or `tests/seed_fixture.sql`.
- Running seed writes as owner, bypassing RLS, or using session-level tenant context.
- Adding extensions, roles, credentials, tables, policies, states, or events.
- Seeding a second tenant or any domain data beyond the two exact rows.
- Random UUIDs, hardcoded-return UUID helpers, silent updates, or force flags.
- Adding a dependency or implementing Orders 012–013.

## Review requirement

Tier 3 tenancy change. Claude must independently review the SQL identity/context path,
collision tests, and pool-leak proofs before cumulative integration. The builder must
not approve or merge it.
