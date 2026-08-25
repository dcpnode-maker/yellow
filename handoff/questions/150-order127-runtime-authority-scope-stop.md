# Question 150 — Order-127 extension visibility and pooled settlement stop

**Status:** RESOLVED BY D-394 — CORRECTION READY
**Order:** 127 · runtime database authority
**Branch:** `phase-5/runtime-database-authority-final`
**Approved Base:** `8daf34e1f1328e866b0b52ff750631e7d651d0b7`
**Admission:** `4c4922a66e43a87b8d80a65049e78a3e501d73fa`
**Admission correction:** `5919b6a20f46449d20843245d8535c3b4b3b7b24`
**P0 red:** `723edcb54762a0aa8153169d0b67e043da878c6d`
**Related decisions:** D-392, D-393, D-394

## Independent partial-audit stop

Implementation stopped before a product commit. The dirty bounded migration/tooling
draft is preserved as uncommitted evidence and is not reviewable. Docker remains off.
The audit found one contradiction in the admitted extension contract and one separate
containment defect inside an already admitted source path.

## 1. Strict extension RLS hides required platform-global evidence

Order 127 requires every existing RLS policy expression and flag to remain byte-exact
and says extension work enters `app_role`, with no global extension authority. Those
requirements cannot together preserve the approved extension behavior.

`public.extension` has the unchanged strict policy:

```sql
tenant_id = current_setting('app.tenant_id', true)::uuid
```

Yet `src/kernel/extension.ts` has two deliberate read surfaces that exceed that row:

1. `listVisible(tenantId)` selects `tenant_id IS NULL OR tenant_id = tenantId`, because
   a hotel sees exact platform-global instances plus its own and never another hotel's;
2. `checkCompatibility(tenantId, type, schema)` must check every stored instance of
   the platform type, including global and other-tenant instances, before accepting a
   platform schema change.

The permanent focused proof makes this exact. `tests/extension.integration.test.ts`
P3 inserts one `tenant_id IS NULL` platform instance and requires both tenants to see
it without seeing each other. P5 requires three incompatibility results: tenant A,
tenant B and platform-global. Under `SET LOCAL ROLE app_role`, strict RLS reduces those
results to tenant A only. An application WHERE disjunction cannot restore rows removed
by RLS. Weakening the proof would conceal a product regression; changing the policy or
granting raw table SELECT would violate D-392.

## D-394 minimal capability ruling

Keep the RLS policy and flags byte-exact. Add only two named, read-only,
owner-mediated functions to Order 127's existing migration/source/proof paths:

1. `runtime_visible_extensions(uuid)` returns exactly
   `(id uuid, tenant_id uuid, type text, key text, version integer, content jsonb,
   status text)` for `tenant_id IS NULL` or the exact non-null tenant argument, ordered
   by type/key/version;
2. `runtime_extension_compatibility_inputs(text)` returns exactly
   `(id uuid, content jsonb)` for one non-empty, at-most-64-character stable lowercase
   extension type, ordered by id, across the platform catalogue.

Both are `SECURITY DEFINER`, owned by unreachable NOLOGIN `yellow_owner`, set exact
`pg_catalog, public, pg_temp` search paths, qualify every object, reject malformed or
null arguments before access, and are executable only by `yellow_runtime`; PUBLIC and
`app_role` have none. They expose no mutation, tenant setter, arbitrary relation/type
selector, SQL wrapper, owner membership or direct table grant. `listVisible` and
`checkCompatibility` call only the corresponding function. Registration/version
writes continue to establish the request tenant and enter `app_role`, preserving facts,
validation and rollback.

The compatibility capability is intentionally platform-wide because the pre-existing
platform schema check is invalid if it ignores stored content that the proposed schema
would break. Its output is the existing minimal id/content input, not tenant identity,
actor, fact, credential or unrelated extension type. This is a bounded named exception,
not discharge of the sibling direct-DML finding.

## 2. Settlement assertion could return a contaminated backend

`src/kernel/db.ts` now checks exact role and null tenant context after COMMIT or
ROLLBACK, but `finally` unconditionally calls `connection.release()`. If a hostile
callback uses `RESET ROLE` and a session-scoped `set_config(..., false)`, outer COMMIT
can succeed, the post-settlement assertion can correctly fail, and the catch path has
`began = false`; the contaminated reserved backend is then returned to the pool. The
rollback path likewise catches and suppresses a failed settlement check before the
same unconditional release.

This does not require scope expansion: `src/kernel/db.ts`,
`tests/tenant-context.integration.test.ts`, and
`tests/runtime-database-authority.integration.test.ts` are already admitted. D-394
requires a backend to be released only after exact settlement. On assertion failure,
the adapter must run PostgreSQL `DISCARD ALL` outside a transaction and re-verify
`current_user = session_user = yellow_runtime` plus null tenant context before release;
if rollback, discard or re-verification fails, it must not return that backend to the
pool. A permanent max-one hostile callback/reuse canary must prove the next request
cannot inherit a session tenant or elevated role. Normal commit, thrown handler and
nested failure behavior remains unchanged.

## Exact correction sequence

1. Commit this Question, D-394, the Order-127 amendment and one additive ledger row as
   governance only; leave every dirty implementation path unstaged.
2. Extend migration 0015 only with the two exact extension read functions and exact
   owners/search paths/ACLs; do not alter an existing policy, grant or table.
3. Route only the two extension read methods through those capabilities; keep writes
   tenant/app-role local.
4. Correct settlement containment and add the hostile reuse proof in already admitted
   paths.
5. Restart static and P1–P5 proof on one immutable executable. Builder output remains
   non-review evidence; a non-implementing Tier-3 reviewer must reproduce P0 and P1–P5.

No migration number, DSN role, domain state, table, event, policy, write authority,
scope path, assertion strength, merge, push, deployment, live mutation or Cyber closure
is otherwise authorized.
