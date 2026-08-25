# Order 156 — Bound extension-type registration capability

**Status:** READY — authorized implementation
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
- `docs/SECURITY.md` and `docs/CONTRACTS.md`;
- this order, D-420, additive `handoff/LEDGER.md`, and one independent review.

No other source, migration, test, schema, script, documentation or governance path is
in scope. If another path is required, stop and write a new question.

## Required implementation

1. Add `public.register_extension_type(uuid,text,jsonb) RETURNS boolean`, owned by
   unreachable NOLOGIN `yellow_owner`, `SECURITY DEFINER`, with exact safe search path
   `pg_catalog, public, pg_temp` and fully qualified objects.
2. Admit only the real `yellow_runtime` to transaction-local `app_role` path with an
   exact non-null tenant argument matching `app.tenant_id`. Reject missing, malformed,
   foreign or session-scoped authority before mutation.
3. Accept only the existing bounded stable lowercase type and valid non-null JSON
   schema inputs. Preserve exact insert=true, already-identical=false and divergent
   schema rejection semantics under concurrency. Return no catalogue or schema data.
4. Grant execute only to `app_role`; revoke it from PUBLIC and direct
   `yellow_runtime`. Revoke the remaining direct `extension_type(type,json_schema)`
   insert privilege after the caller is migrated.
5. Keep the authenticated platform-scope check, tenant-bound audit fact, compatibility
   validation, transaction atomicity and existing HTTP/service response behavior exact.

## Pre-registered proof

### P0 — exact-Base exploit

On an exact Base database, enter the real `yellow_runtime` to transaction-local
`app_role` path and directly insert a platform-global extension type without the HTTP
platform-scope check or required audit fact. Prove the row appears and roll back the
transaction.

### P1 — authority and containment

On the candidate, the same direct insert returns exact SQLSTATE `42501` with zero row.
Prove exact function owner, signature, search path and ACLs; wrong/missing tenant and
role rejection; direct runtime/PUBLIC denial; pg_temp shadow resistance; no arbitrary
relation/type selector; and rollback containment.

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
- Generic SQL/relation selectors, raw table grants, broader function execution, new
  role/credential/table/policy/route/dependency, or owner membership.
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
