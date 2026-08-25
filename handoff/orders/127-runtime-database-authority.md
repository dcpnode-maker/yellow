# Order 127 — Separate runtime database authority from deployment authority

**Status:** CORRECTION READY — D-392, corrected by D-393 through D-399 and D-401–D-402;
Questions 150–155 resolved before corrected executable implementation
**Phase:** 5 · Cyber remediation
**Branch:** `phase-5/runtime-database-authority-final`
**Base:** `8daf34e1f1328e866b0b52ff750631e7d651d0b7` — exact independently
approved Order-126 metadata head; corrected executable
`16b48bdfb559dcc9ce0a417a427f3cc5b5d6b1fb`
**Risk tier:** 3 — runtime credentials, PostgreSQL roles/ownership, RLS,
SECURITY DEFINER capability and forward migration
**Finding:** sealed Cyber scan `e2a116cd-6e6d-4c8d-a741-9fa5c9f33fbb`,
`database.runtime-bootstrap-superuser`, occurrence
`occ_235bd4dcea3d48cd3f611759`
**Owner:** Codex implementation; independent non-implementing Tier-3 review required

## Admission and exact lineage

D-359 independently approves Order 123, D-361 independently approves Order 124 and
D-391 independently approves Order 126. All three exact order/review artifacts and
their approved product are present in this Base. Order 126 owns final migration 0014,
whose raw SHA-256 is exactly:

```text
706806ad3c041d506df1e90f75b19ed219baa3fedb8968471828657ab6c7493a  migrations/0014_bind_occupancy_caller_tenant.sql
```

Repository and migration-manifest searches find no `0015_` file or version-15 entry.
This order uniquely reserves `0015_runtime_database_authority.sql`. If another 0015
appears before implementation, stop and re-admit.

D-377 excluded the obsolete Order-127 draft from the approved integration, and D-379
removed its old finance-migration renumbering obligation. Draft finance Orders 109–115
are not present on this approved line and this order does not recreate, import, edit or
renumber them. The read-only stale planning branch at `9eaba153...` remains preserved
at `C:\Users\astha\AppData\Local\Temp\yellow-order127`; its order and colliding open
Question 147 are evidence only and have no authority here. Current Question 147 already
belongs to approved Order 143 and is not overwritten.

No implementation, test, runtime, Docker, credential or database mutation precedes
this committed admission.

## Exact authority ruling

The current local reference stack authenticates the application and database tools
with the same `yellow` PostgreSQL superuser. Entering `app_role` narrows ordinary
application work, but `RESET ROLE` restores that authenticated superuser, which owns
objects, bypasses RLS and can perform DDL. Order 118 intentionally left this finding
open. The final boundary is:

| Identity | Login and use | Exact authority |
| --- | --- | --- |
| `yellow_deploy` | LOGIN; deployment/migration/seed/schema/referee only; never present in app environment | local/reference cluster deployment administrator; may retain SUPERUSER because the credential is external to runtime; owns no final Yellow public object after 0015 |
| `yellow_owner` | NOLOGIN; no password; no runtime/deploy membership edge | owns the public schema, relations, sequences and functions; owns bounded SECURITY DEFINER capabilities; NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOINHERIT |
| `yellow_runtime` | LOGIN; the only app, HTTP, worker, event and discovery connection identity | NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOINHERIT; owns no Yellow object; cannot assume deploy/owner; exact explicit member of `app_role` only |
| `app_role` | NOLOGIN capability entered only after transaction-local tenant context | retains the already approved application grants and function ACLs; no owner/deploy membership and no authentication |

`yellow_deploy` and `yellow_runtime` use distinct generated/injected secrets and
distinct DSNs. The application image/environment receives only
`YELLOW_RUNTIME_DATABASE_URL`; migration, seed, review-seed, schema and referee tools
receive only `YELLOW_DEPLOY_DATABASE_URL`. No password, URL, hash, fallback credential
or generated value is committed or printed. The local setup may persist generated
database secrets only in one ignored, owner-readable local authority file so fresh
invocations reuse rather than silently rotate an existing volume. Production secret
storage and rotation remain external deployment responsibilities.

`Database.withTenantTransaction` sets verified `app.tenant_id` transaction-locally
before `SET LOCAL ROLE app_role`. Normal commit, rollback, thrown handler, nested
failure and backend reuse must restore `current_user = session_user = yellow_runtime`
and clear tenant context. A hostile `RESET ROLE` may restore only `yellow_runtime`,
which has no owner, deploy, DDL or direct tenant-table authority.

The approved RLS policies and enablement remain byte-exact. This order does not add a
blanket `FORCE ROW LEVEL SECURITY`: the stale proposal would break the approved global
outbox and hold coordinators while adding no runtime protection once owner is NOLOGIN
and unreachable from runtime. Cross-tenant runtime coordination is exposed only by
the following owner-mediated, safe-search-path, argument-bounded functions, with
PUBLIC and `app_role` denied and only `yellow_runtime` granted EXECUTE:

1. `runtime_resolve_active_tenant(text)` returns at most the exact UUID for one valid
   active slug so local login can establish tenant context before entering `app_role`;
2. `runtime_due_hold_scopes(integer)` returns only bounded due tenant/property pairs;
3. `runtime_consumer_begin(text)`, `runtime_consumer_read(text,bigint,integer,boolean)`,
   `runtime_consumer_mark(text,uuid)` and `runtime_consumer_advance(text,bigint)` retain
   existing cursor locking, dedupe, ordering and handler-transaction semantics;
   `runtime_consumer_read` column 4 is exact `property_node uuid`, matching
   `public.outbox.property_node`, never `ltree`. Its unpublished branch is an explicit
   static `published_at IS NULL` query so PostgreSQL can use the existing partial
   unpublished index; the cursor branch remains a separate static `seq > p_after`
   query. Both retain identical validation, cursor lock, order, limit and result shape;
4. `runtime_mark_outbox_published(uuid[])` and `runtime_prune_outbox(integer)` retain
   only the approved relay publish/prune behavior;
5. `runtime_visible_extensions(uuid)` returns only platform-global plus exact-tenant
   extension instances, while `runtime_extension_compatibility_inputs(text)` returns
   only id/content for one bounded exact type across the platform catalogue so the
   existing platform schema-compatibility check cannot ignore another tenant or a
   global instance.

The runtime gets no generic owner function, arbitrary SQL wrapper, tenant setter,
raw cross-tenant table grant or maintenance role. Extension registry writes establish
their request tenant and enter existing `app_role`; only the two D-394 read functions
may cross strict extension RLS, and only for the exact visible/compatibility surfaces
above. All new functions are owned by `yellow_owner`, use qualified catalog/public
names and exact `pg_catalog, public, pg_temp` search paths, validate bounded inputs
before access, preserve transactions and expose no secret.

After COMMIT or ROLLBACK, a reserved backend may return to the pool only after exact
runtime-role/null-tenant settlement. Database-owned runtime pools use Bun
`prepare: false`, so the client has no prepared-name cache for `DISCARD ALL` to
invalidate. If settlement fails, the adapter must issue `DISCARD ALL` outside a
transaction, re-verify exact runtime/null-tenant settlement with an unprepared query,
then release only that clean backend. If rollback, discard or re-verification fails,
the owning pool fails/closes and the backend is never returned. Ordinary clean paths
remain unchanged. Database shutdown is bounded and idempotent. Questions 150–151
record why unconditional release and `ReservedSQL.close()` are each insufficient.

Migration 0015 verifies/provisions only the password-free role/catalogue contract,
transfers current public object ownership to `yellow_owner`, grants the one exact
runtime→app-role membership, revokes public-schema creation and installs the named
capabilities. Login passwords are supplied by the local provisioning boundary or
external deployment, never SQL migration text. The migration and runner must fail
atomically on unexpected role attributes, membership, active runtime session, owner,
object, ACL, RLS/policy or migration-ledger state.

PostgreSQL role membership is cluster-global while migration ledgers are per database.
When a later database is still pending unchanged migration 0012 after another database
has installed 0015, the runner may transaction-locally suspend only the sole exact
`yellow_runtime`→`app_role` edge. It accepts `app_role` only as either the final
hardened tuple or 0012's exact known parent tuple: LOGIN, connection limit `-1`, null
password, INHERIT, and otherwise NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/
NOBYPASSRLS. `yellow_runtime` must already be exact and no runtime session or malformed
membership may exist. The unchanged 0012 body hardens the role; the same transaction
re-grants the one edge and verifies the final tuple before its ledger commit. Question
152 records the affected Order-118 preservation proof.

## Exact implementation scope

Implementation may change only these product/database paths:

- `migrations/0015_runtime_database_authority.sql`;
- `src/server.ts`;
- `src/kernel/db.ts`;
- `src/kernel/outbox.ts`;
- `src/kernel/extension.ts`;
- `src/contexts/identity/local-login.ts`; and
- `src/workers/postgres-due-hold-scopes.ts`.

Local/deployment tooling may change only:

- `.env.example`;
- `.gitignore`;
- `docker-compose.yml`;
- `setup.sh`;
- `setup.ps1`;
- new `scripts/provision-local-database-authority.ts`;
- `scripts/migrate.ts`;
- `scripts/seed.ts`;
- `scripts/seed-review.ts`;
- `scripts/schema-drift.ts`;
- `scripts/run-phase-3-gate.ts`; and
- `.github/workflows/ci.yml`.

Executable proof may change only:

- new `tests/runtime-database-authority.integration.test.ts`;
- `tests/app-role-nonlogin.integration.test.ts`;
- `tests/auth.integration.test.ts`;
- `tests/business-day-seal-authority.integration.test.ts`;
- `tests/tenant-context.integration.test.ts`;
- `tests/outbox.integration.test.ts`;
- `tests/relay.integration.test.ts`;
- `tests/hold-expiry-worker.integration.test.ts`;
- `tests/extension.integration.test.ts`;
- `tests/migrate.integration.test.ts`;
- `tests/seed.integration.test.ts`;
- `tests/review-seed.integration.test.ts`;
- `tests/database-acceptance.integration.test.ts`;
- `tests/security-definer-containment.integration.test.ts`;
- `tests/phase-3-gate-runner.test.ts`;
- `tests/schema-drift.test.ts`;
- `tests/jwt-runtime-secret-security.test.ts`; and
- mechanically regenerated `tests/schema/expected.sql`.

`tests/business-day-seal-authority.integration.test.ts` may change only its ownership
oracle from the current/deployment owner to exact `yellow_owner`. It must preserve
deployment execution, app/PUBLIC denial, the exact function ACL and the existing
tenant/day-seal latch behavior without assertion weakening.

Documentation may change only:

- `docs/SECURITY.md`;
- `docs/LOCAL-REVIEW.md`; and
- `docs/TOOLING.md`.

Governance may change only:

- this order;
- `handoff/reviews/127-runtime-database-authority.md` when written by the independent
  reviewer;
- `handoff/questions/150-order127-runtime-authority-scope-stop.md` only if an exact
  unadmitted dependency is found;
- `handoff/questions/151-order127-bun-pool-containment.md` for the exact resolved Bun
  reserved-connection contract;
- `handoff/questions/152-order127-repeat-v12-role-transition.md` for the exact resolved
  cluster-global repeat-database role transition;
- `handoff/questions/153-order127-outbox-capability-contract.md` for the exact resolved
  outbox result, owner-oracle and authoritative task-parent fixture contract;
- `handoff/questions/154-order127-relay-backlog-throughput.md` for the exact resolved
  relay backlog hot-path contract;
- `handoff/questions/155-order127-relay-handler-context.md` for the exact resolved
  sequential handler-context transition contract; and
- additive Order-127 entries in `DECISIONS.log` and `handoff/LEDGER.md`.

Every other path is forbidden. In particular: never edit migrations 0001–0014,
`tests/run_invariants.py`, `tests/seed_fixture.sql`, finance Orders 109–115, project
status/dashboard, any domain state/event/table, existing RLS policy text, existing
security-definer body/ACL except the named runtime calls, broad `app_role` DML grants,
occupancy/day-seal behavior, Dockerfile/image pins, API/UI, rate/reservation/financial
logic or a live/shared database. If proof requires another path, stop implementation
and write an exact question rather than widening.

## Required implementation

1. Commit a test-first exact-parent red before product edits. Preserve Base and all
   approved Orders 108, 118, 123, 124 and 126 byte-exact outside this scope.
2. Introduce the four-role catalogue and v15 ownership/capability boundary atomically.
   Preserve every existing RLS policy expression, approved function signature/body/
   ACL and application grant not explicitly named above.
3. Make every server-created pool authenticate as exact `yellow_runtime`. Tenant work
   sets context then local role; local login resolves only one active slug before
   context; event/hold global work uses only the named owner-mediated functions;
   extension work uses the verified tenant/app role.
4. Make migrate/seed/review/schema/referee and CI accept only the deploy DSN. Migration
   runner ownership checks must recognize final `yellow_owner` while executing forward
   changes through deploy authority without leaking that URL to app/worker processes.
5. Make local Compose/setup deterministic, localhost-only and zero-cost. Generate or
   reuse ignored database secrets without logging; fail closed on incompatible
   existing roles/volume rather than silently changing identity or credentials.
6. Preserve error redaction, outbox atomicity/dedupe/order, hold-expiry limits,
   extension facts and exact global/tenant visibility/compatibility, seed idempotency,
   migration checksum/lock/retry behavior, app-role
   NOLOGIN, occupancy authority and all protected proof files.

## Pre-registered proof

### P0 — exact-parent runtime-superuser red

From exact Base in an exclusive disposable cluster, start the actual app boundary with
its parent DSN. Inside a valid tenant-local transaction prove `session_user` is the
deployment/bootstrap superuser; `RESET ROLE` restores that identity; it can read a
second-tenant sentinel and has harmless database/schema CREATE authority unavailable
to `app_role`. Roll back sentinel/probe effects, redact connection material and remove
the cluster. Commit this red before implementation.

### P1 — role, ownership, membership, ACL and migration catalogue

On fresh v15, assert exact role tuples, distinct OIDs, the sole runtime→app-role edge,
zero runtime-owned objects, final owner for every public relation/sequence/function,
no public-schema creation, exact capability function owners/search paths/ACLs and zero
other runtime direct table/function authority. Preserve app-role NOLOGIN, approved
0012–0014 bodies/ACLs and every RLS flag/policy expression byte-equivalent to Base.
Exercise missing/wrong/preprivileged roles, membership, owners, sessions and object
catalogues: each fails with no v15 ledger row or partial mutation, then retries once.

### P2 — tenant transaction and pooled RESET ROLE containment

Using the real runtime DSN and a max-one pool, prove tenant A/B isolation, exact
`session_user=yellow_runtime` and in-callback `current_user=app_role`. After success,
throw, nested failure, event handler, local login and worker error, reuse the same
backend and prove current/session user runtime, null tenant setting, an empty
`pg_prepared_statements` catalogue and no deploy/owner reachability. A hostile
session-scoped tenant write must be discarded and reverified before backend reuse, or
the owning pool must fail closed. A hostile callback `RESET ROLE`
may return only to runtime and still
cannot read the other sentinel, bypass RLS, create/alter/drop objects/roles or assume
owner/deploy. The same max-one Database remains reusable after successful containment,
and repeated `Database.close()` calls settle within the bounded shutdown budget.

### P3 — bounded pre-tenant and global capabilities

Prove unknown/inactive/malformed slugs reveal no tenant row and valid local login keeps
generic failure/timing controls. Prove bounded due-hold discovery followed by exact
tenant-local expiration. Prove outbox cursor lock, ordering, dedupe, handler rollback,
relay marking and prune counts remain atomic under concurrency while runtime cannot
query their backing tables directly. Prove extension register/list/compatibility and
fact behavior remain tenant-correct without a global raw-table grant. Test every named
function for PUBLIC/app-role denial, injection inputs, oversized arrays/limits and safe
temporary-schema resolution. Extension proofs retain exact tenant-own,
platform-global and platform-wide same-type compatibility results through only the two
D-394 reads.

The inherited outbox proof must assert exact `yellow_owner` ownership for
`consumer_cursor` and `consumer_processed` after v15. Its unchanged P1 task/event
atomicity assertion receives only the exact authoritative `org_node` row required by
the task's `property_node` foreign key, loaded before the task mutation in the same
fresh proof database (or equivalently via the canonical governed seed fixture). No
foreign-key bypass, nullable parent, expected-error change or assertion weakening is
permitted.

For each bounded ordered/unpublished consumer batch, the admitted outbox adapter may
mark the current rows' IDs with one bounded set-wise statement that invokes the
existing scalar `runtime_consumer_mark(text,uuid)` in input ordinality and returns each
inserted flag in original row order. Handlers remain sequential and tenant-scoped in
the same transaction; cursor advance, publication, rollback, crash recovery and
dedupe semantics remain unchanged. Batch size remains at most 1000. No new capability,
grant, table, interface or assertion budget is admitted.

Already-marked handlers remain sequential in original event order. The adapter may
reuse exact `app_role` plus transaction-local tenant context only across consecutive
events for the same tenant. On a tenant change it must `RESET ROLE`, set the new exact
tenant, then `SET LOCAL ROLE app_role`; after every handler it verifies exact
`current_user = 'app_role'` and exact transaction-local tenant UUID before continuing.
Handler error, context tamper, verification failure or transition failure rolls the
entire marks/effects/cursor transaction back, and final `RESET ROLE` is mandatory.
Mixed A/B/A and hostile context-tamper proofs are required. No handler batching,
reordering, cross-tenant reuse or proof-budget change is admitted.

The inherited Order-118 proof retains its parent-to-hardened 0012 transition and,
after v15, requires exactly one incoming `app_role` membership from `yellow_runtime`,
zero outgoing membership and no other relevant edge.

### P4 — distinct DSNs and process/environment boundary

On a pristine isolated Compose project/volume, inspect variable names only: app has
runtime URL and lacks deploy URL; tool profiles have deploy URL and lack runtime URL.
Migrate, canonical seed, review seed, schema and referee run through deploy; app health,
login, tenant HTTP, events and workers run through runtime. Re-run setup without secret
rotation, reject incompatible pre-existing roles atomically, and prove logs/errors/
process output contain no URL or password. No shared/live stack or external secret
service is touched.

### P5 — cumulative and independent review

Run exact v15 acceptance/checksum, unchanged migration suite, current isolated phase
matrix with this proof mapped once, affected auth/tenant/outbox/relay/hold/extension/
seed suites, Orders 108/118/124/126 focused proofs, financial posting/day-seal,
normalized schema, standing, typecheck, 64-file boundaries, frozen licences/audit,
image pins and protected hashes. Run fresh `setup.sh --db-only` and standalone
app-never-started referee with exactly `11 passed, 0 failed of 11`.

A non-implementing Tier-3 reviewer must personally reproduce P0 and P1–P5 on exclusive
disposable clusters, inspect actual app/tool environments without revealing values,
and execute the relevant cumulative gates on one immutable SHA. Builder output is not
review evidence.

## Exclusive discharge and residual risks

Approval may discharge only `occ_235bd4dcea3d48cd3f611759`: ordinary runtime can no
longer reset to or authenticate as the deployment superuser/owner. It does not close
`database-grants.runtime-role-direct-dml`, arbitrary SQL after the trusted application
has established tenant/app role, runtime credential compromise, the bounded global
event payload surface, future deploy/owner credential misuse, any external database
principal, or any sibling Cyber/finance/product finding. `yellow_deploy` remains a
high-value external administrator and must never enter the runtime environment.

No approval, merge, push, deployment, live mutation or Cyber closure is claimed by
admission or builder proof.

## Definition of done

- [x] Exact independently approved Order-126 metadata head is the Base.
- [x] Orders 123, 124 and 126 approval artifacts are present; 0014 checksum is exact.
- [x] Migration 0015 is unused and uniquely reserved; obsolete finance renumbering and
      stale Order-127/Q147 artifacts remain excluded.
- [x] D-392 records the exact role/capability/DSN ruling and closed path list before
      code.
- [ ] P0 red precedes implementation.
- [ ] P1–P5 pass on one immutable executable.
- [ ] Independent non-implementing Tier-3 review approves that exact executable.
- [ ] Only the stated occurrence is then eligible for discharge; all residuals remain
      open.
