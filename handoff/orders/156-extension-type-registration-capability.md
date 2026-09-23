# Order 156 — Bound extension-type registration capability

**Status:** READY — Q166 option 1 authorized by D-422
**Phase:** 5 · Cyber remediation
**Branch:** `phase-5/extension-type-registration-capability`
**Base:** `c7e89e9a9c83deaddd06ffe838a23b455e2613c7`
**Risk tier:** 3 — global catalogue mutation and SECURITY DEFINER authority
**Owner:** Codex implementation; independent non-implementing Tier-3 reviewer

## Authority and outcome

D-417 and the founder's 2026-08-25 authorization require the temporary direct
`app_role` insert into `extension_type(type,json_schema)` to move behind a bounded
command capability. Add migration 0018, route the existing registration caller through
that capability, and revoke the residual direct insert without changing API scope,
validation, audit facts, compatibility behavior or response semantics.

## Scope

- `migrations/0018_extension_type_registration_capability.sql`;
- `.env.example`, `docker-compose.yml`, `setup.sh` and `.github/workflows/ci.yml`, only
  for the third registrar credential/DSN and exact service injection boundary;
- `scripts/provision-local-database-authority.ts` and
  `tests/runtime-database-authority.integration.test.ts`;
- `src/server.ts`, only for one dedicated registrar pool;
- `scripts/seed-review.ts` and `tests/review-seed.integration.test.ts`, only to make
  their existing non-registrar registry pool unprepared while proving no registrar
  credential reaches review seed;
- `src/kernel/extension.ts`;
- `tests/extension-type-registration-capability.integration.test.ts`;
- `tests/extension.integration.test.ts`;
- `tests/runtime-dml-authority.integration.test.ts`;
- `tests/security-definer-containment.integration.test.ts`;
- `tests/migrate.integration.test.ts`;
- `tests/database-acceptance.integration.test.ts`;
- `tests/schema/expected.sql`, mechanically regenerated only;
- `scripts/run-phase-3-gate.ts` and `tests/phase-3-gate-runner.test.ts`, only for one
  unique focused-suite mapping;
- `docs/SECURITY.md`, `docs/CONTRACTS.md`, `docs/TOOLING.md` and
  `docs/LOCAL-REVIEW.md`;
- this order, Questions 165-166, D-420-D-422, additive `handoff/LEDGER.md`, and one
  independent review.

No other source, migration, test, schema, script, documentation or governance path is
in scope. If another path is required, stop and write a new question.

## Required implementation

1. Provision exact LOGIN `yellow_extension_registrar` with NOINHERIT, NOSUPERUSER,
   NOCREATEDB, NOCREATEROLE, NOREPLICATION and NOBYPASSRLS; zero membership, ownership,
   table/sequence DML or generic privileges, with connection limit four. Generate one
   independent local-only secret and DSN in the ignored atomic owner-only authority
   file. Never log, commit, pass to migrate/seed/review-seed, or silently rotate it.
2. Add exact `public.register_extension_type(uuid,text,jsonb,uuid,uuid,uuid) RETURNS
   boolean`, ordered tenant/type/schema/actor/property/request, owned by unreachable
   NOLOGIN `yellow_owner`, `SECURITY DEFINER`, exact search path
   `pg_catalog, public, pg_temp`, fully qualified objects, and an exact
   `session_user = 'yellow_extension_registrar'` check.
3. Accept only non-null tenant/actor/property/request UUIDs, stable lowercase type of
   at most 64 characters, and a non-null JSON object bounded by the existing 16 KiB HTTP
   body ceiling. TypeScript retains the existing recursive semantic/keyword validation;
   the registrar credential is its database trust boundary.
4. The function validates the tenant property, internally derives the existing UUIDv5
   subject for `https://yellow.local/extension-type/{type}`, fixes operation to
   `extension_type.registered`, and atomically inserts the catalogue row plus exact
   tenant/actor/request audit fact. It returns true only for insert, false for identical
   replay with no new fact, and preserves divergent-schema rejection under concurrency.
5. Grant registrar only schema USAGE and exact function EXECUTE. Revoke EXECUTE from
   PUBLIC, `app_role` and `yellow_runtime`; revoke direct
   `extension_type(type,json_schema)` insert from app_role. The dedicated Bun pool is
   required, username-checked, backend-verified, max two and `prepare:false`; it is
   never exposed as generic runtime/event/login/worker `Tx`.
6. Keep authenticated platform-scope check, compatibility behavior and exact HTTP
   403/201/200/409/422 responses unchanged. Runtime pool remains the only instance/read
   pool; review-seed receives no registrar credential.

## Pre-registered proof

### P0 — exact-Base exploit

On an exact Base database, enter the real `yellow_runtime` to transaction-local
`app_role` path and directly insert a platform-global extension type without the HTTP
platform-scope check or required audit fact. Prove the row appears and roll back the
transaction.

### P1 — authority and containment

On the candidate, the same direct insert returns exact SQLSTATE `42501` with zero row.
Prove exact function owner, signature, search path and ACLs; wrong/missing effective
tenant and session-principal rejection; direct runtime/app-role/PUBLIC denial;
registrar zero-membership/ownership/table/sequence authority; pg_temp shadow resistance;
no arbitrary selector; rollback containment; exact credential-file upgrade/redaction,
wrong-secret/malformed-role fail-closed behavior, and unprepared dedicated-pool reuse.

### P2 — honest behavior and races

Execute authenticated registration through the existing service/API boundary. Prove
unchanged platform-scope `403`, success behavior, one exact tenant-bound audit fact,
idempotent already-identical behavior, divergent-schema rejection, concurrent identical
registration convergence, compatibility checks and zero cross-tenant or partial
artifacts.

### P3 — catalogue and recurrence

Update the exact runtime-DML catalogue so no direct `extension_type` mutation remains.
Require the catalogue proof to fail if either direct column insert or unintended
function execution is restored.

### P4 — cumulative proof

Run the new focused suite, extension, runtime-DML and SECURITY DEFINER suites; complete
isolated phase matrix; native Linux/WSL migrations; deployment acceptance; exact live
schema; standing tests; typecheck; boundaries; licences; audit; protected hashes; and
a fresh app-never-started `./setup.sh --db-only` referee with exactly 11/11.

The independent reviewer must reproduce P0 on exact Base and personally execute
P1-P4 against one immutable candidate before approval.

## Forbidden

- Editing an existing migration, `migrations/0001_init.sql`, or
  `tests/run_invariants.py`.
- Generic SQL/relation selectors, raw table grants, broader function execution, any
  principal/credential beyond exact `yellow_extension_registrar`, new table/policy/
  route/dependency, or owner membership.
- Changing platform authorization, schemas, facts, events, compatibility rules or API
  behavior to make proof pass.
- Combining approval decisions or extension publication/status transitions into this
  order; those remain separate Tier-3 state-machine orders.
- Merge to main, push, deployment, self-review, self-merge, finding closure or
  Cyber-wide completion claim.

## Definition of done

- [ ] P0 reproduces and rolls back the exact direct-write bypass on Base.
- [ ] P1 proves the bounded capability and complete direct-grant revocation.
- [ ] P2 preserves honest registration, audit, compatibility and race behavior.
- [ ] P3 proves the exact catalogue contraction and recurrence canaries.
- [ ] P4 and fresh referee are green.
- [ ] Independent Tier-3 review approves one immutable executable.
