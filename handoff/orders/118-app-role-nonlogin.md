# Order 118 — Internalize the tenant policy role

**Phase:** 5 security correction  
**Branch:** `phase-5/app-role-nonlogin`  
**Base:** exact built Order 117 SHA `6fa77448fe65ea775ceb280410b85a96d63c3933`  
**Risk tier:** 3 — PostgreSQL login, role-membership and tenant/RLS boundary  
**Owner:** Codex implementation; independent non-implementing reviewer required  
**Cyber finding:** `database.caller-controlled-rls-tenant` / `occ_48ef46aabb565be569c6e79d`  
**Status:** APPROVED at exact executable `b6a1319f571ea0cb079f75cedf06edf35548a1d2`; not integrated, pushed or live

## Outcome

`app_role` becomes an internal `NOLOGIN` policy/capability role that has no password,
no connection allowance, no explicit memberships and no direct sessions. A tenant or
integration principal must never authenticate as it or assume it. Yellow's trusted
application transaction continues to derive tenant authority from verified identity,
set transaction-local `app.tenant_id`, and only then assume `app_role`.

This order discharges only the sealed finding's demonstrated direct-database entry
condition. It does not claim that a mutable custom GUC is cryptographically immutable
against arbitrary SQL already executing inside the trusted application transaction.
No reviewed HTTP raw-SQL path exists today. Any future direct-database tenant product,
SQL execution surface, shared runtime redesign or BI role requires a separately ordered
tenant-binding model and new hostile proof.

## Confirmed attack path and current-line status

The sealed Cyber scan `e2a116cd-6e6d-4c8d-a741-9fa5c9f33fbb` rates this finding high.
Immutable migration 0001 creates `app_role LOGIN`, grants it the global `tenant`
catalog plus broad tenant-table access, and makes every tenant RLS policy compare
against caller-settable `app.tenant_id`. A principal able to authenticate as, or
explicitly assume, `app_role` can therefore:

1. select a victim tenant UUID from `public.tenant`;
2. set transaction-local `app.tenant_id` to that UUID;
3. read or perform otherwise-granted DML against the victim's RLS-protected rows.

The committed setup supplies neither an `app_role` password nor an ordinary HTTP
arbitrary-SQL route, so this is a constrained database-bound path, not an unauthenticated
HTTP escape. Migrations 0002–0011 and Order 117 do not change `rolcanlogin`, clear a
credential that an operator may have provisioned, or forbid role membership. Order 019
proves correct verified-identity HTTP context but does not contain a direct database
principal. Order 108 explicitly leaves this sibling finding open.

## Natural-Solution Test

Yellow does not support customers, staff, integrations or BI tools connecting as the
generic application policy role. Under that product boundary, the smallest natural
fix is one forward migration that removes its authentication and assumption surfaces
without replacing the constitutional transaction-local tenant context or duplicating
73+ RLS policies. A per-tenant database-role catalogue, protected setter, second tenant
store, proxy, new service, dependency or paid control is not justified by the currently
reachable path.

The role must be hardened explicitly rather than only changing `LOGIN` to `NOLOGIN`:
a latent password must be cleared, connection limit must be zero, dangerous attributes
must be denied, memberships must be absent, and an upgrade must fail rather than leave
an already-connected direct role alive. PostgreSQL roles are cluster-global, so the
red/green and upgrade proofs require an exclusive disposable PostgreSQL cluster, not
merely another database in a shared cluster.

No founder policy answer is required for the security behavior because the constitution
already forbids experience adapters and external users from receiving database
capabilities. If direct customer/database access is intended after all, implementation
must stop and record that new product intent before weakening this order.

## Migration-number collision — resolved explicitly

Founder-approved Phase-5 decision D-344 reserves
`migrations/0012_app_role_nonlogin.sql` for this release-blocking Cyber correction.
The still-unimplemented finance orders were mechanically shifted to migrations
0013–0018 with their table counts unchanged. No applied migration moved, and no two
orders own version 0012. This order may now use only that exact filename.

## Scope

The following is the exhaustive implementation scope now that Order 117 is independently
approved on this lineage and the migration reservation is explicit:

- exactly `migrations/0012_app_role_nonlogin.sql` and no other migration;
- `tests/app-role-nonlogin.integration.test.ts`;
- `tests/migrate.integration.test.ts` and
  `tests/database-acceptance.integration.test.ts` only for the exact new migration
  ledger/checksum and role-boundary assertions;
- `scripts/run-phase-3-gate.ts` and `tests/phase-3-gate-runner.test.ts` only to add this
  isolated proof once to the cumulative reviewer-triggerable matrix;
- `docs/SECURITY.md` and `docs/CONTRACTS.md` only for the exact internal-role/direct-DB
  boundary and residual risks;
- `src/project-status.ts` and `tests/founder-status.integration.test.ts` only after all
  focused and standing proofs are green, and without claiming independent review;
- this order, `handoff/PHASE-5-PLAN.md`, `handoff/LEDGER.md`, `DECISIONS.log`, an
  independent review record, and `handoff/questions/` if a hard floor fires.

No public table is added, removed or changed. The PostgreSQL schema dump is not expected
to serialize cluster role attributes; `tests/schema/expected.sql`, table-count files and
setup count text are therefore outside Scope unless an executable clean dump proves the
assumption wrong and a question explicitly authorizes the accounting change.

## Required work

1. Preserve `migrations/0001_init.sql` byte-for-byte. The single forward migration must
   require the exact existing `app_role` and change no table, policy, function, grant or
   domain state.
2. Fail closed when either side of `pg_auth_members` contains `app_role`: no principal
   may be an explicit member of the policy role, and the policy role may inherit no
   other role. Superuser deployment authority may still `SET LOCAL ROLE app_role`
   without a membership grant.
3. Fail closed when `pg_stat_activity` contains any direct session whose authenticated
   session user is `app_role`. Do not terminate it from the migration. The operator must
   identify and drain the unsupported client, then retry the atomic migration.
4. Set the exact role contract: `NOLOGIN`, `PASSWORD NULL`, `CONNECTION LIMIT 0`,
   `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, `NOREPLICATION`, and
   `NOBYPASSRLS`. The migration and ledger row must roll back together on every failed
   precondition.
5. Preserve `Database.withTenantTransaction`: deployment connection begins one
   transaction, establishes verified transaction-local tenant context with
   `set_config(..., true)`, then executes `SET LOCAL ROLE app_role`. Commit, rollback,
   pooled-role reset and tenant-context reset remain exact.
6. Preserve existing direct table/function authorities in this order. Least-privilege
   DML reduction is a sibling finding, not a reason to risk breaking all existing
   commands inside the role-containment migration.
7. Document that credentials, customer access, staff access, external integrations,
   reporting and BI must never use `app_role`. A future direct database product must use
   a separately reviewed role/tenant binding rather than toggling `LOGIN` or granting
   membership here.
8. Run P0 only on the exact parent in an exclusive disposable cluster. Run P1–P4 on a
   second fresh exclusive cluster or a deterministically reset continuation whose role
   state cannot affect live, developer or other proof databases. Never expose or print
   the proof password or database URL.

## Forbidden

- Product, migration, test, documentation, status, ledger or decision edits while this
  order remains DRAFT/BLOCKED
- Changing the resolved migration version, silently renumbering draft Orders 109–114,
  or modifying any applied migration
- Editing RLS policy expressions, removing transaction-local `set_config(..., true)`,
  adding a session-level tenant setting, trusting tenant from a body/header/path, or
  adding a second tenant authority
- New table, role-to-tenant mapping, SECURITY DEFINER setter, extension, dependency,
  proxy, service, per-tenant database role, direct SQL API or database UI
- Revoking existing app table/function privileges, changing occupancy helpers, changing
  SECURITY DEFINER bodies/owners/ACLs, altering runtime DSNs, adding `FORCE RLS`, or
  changing deploy ownership
- Terminating active database sessions, discovering or logging role password hashes,
  embedding a password, provisioning a customer/BI credential, or weakening failed
  migration assertions
- Editing `tests/run_invariants.py`, hand-editing `tests/schema/expected.sql`, touching
  user-owned `.agents/`, `.codex/hooks.json` or `handoff/chat-archive/`
- Combining the occupancy-caller-tenant, runtime-superuser, direct-DML-grant or another
  Cyber finding; paid/external control; self-review, self-approval, self-merge or push

## Pre-registered proof

### P0 — exact-parent hostile red

On an exclusive disposable PostgreSQL cluster migrated only through the exact parent,
create deterministic two-tenant Party sentinels, assign `app_role` a random proof-only
password without printing it, and authenticate through a distinct TCP session as
`app_role`. Personally prove that it can enumerate the victim tenant UUID, set that UUID
as transaction-local `app.tenant_id`, and read the victim Party sentinel while the
ordinary source-tenant context is different. Roll back data effects and destroy the
cluster. The red commit contains the test/harness only and must precede the migration.

### P1 — exact role catalogue and atomic migration

Fresh migrations through `0012_app_role_nonlogin.sql` produce the exact catalog tuple:
`rolcanlogin=false`, `rolconnlimit=0`, null password, `rolsuper=false`,
`rolcreatedb=false`, `rolcreaterole=false`, `rolinherit=false`,
`rolreplication=false`, and `rolbypassrls=false`. Both directions of explicit role
membership are empty, no direct `app_role` session exists, the exact checksum is in
`schema_migration`, and the public-table count and RLS policy set are unchanged.

### P2 — direct and assumed access denied

After P1, assigning only a proof password must still not permit a new direct
`app_role` connection because `NOLOGIN` and connection limit zero remain authoritative;
the proof clears the password before teardown. A separate ordinary non-superuser LOGIN
role with no membership cannot `SET ROLE app_role`. It therefore cannot enumerate the
global tenant catalog or choose a victim RLS context through that identity. No secret,
password hash or connection URL appears in output.

### P3 — trusted application path and isolation retained

Through the ordinary deployment connection and unmodified
`Database.withTenantTransaction`, tenant A observes only A's sentinel and tenant B only
B's. Inside the callback `current_user` is `app_role`, the transaction-local tenant is
exact, and after success and injected failure the same reserved backend has reset both
role and tenant context. Existing local login and authenticated operator database proofs
continue to pass without granting any role membership.

### P4 — upgrade fails closed and retries cleanly

In the exclusive cluster, independently prove each precondition: an explicit member of
`app_role`, `app_role` inheriting another role, and an already-authenticated direct
`app_role` session each make the migration fail with no version ledger row and no partial
role-attribute change. After the exact membership/session is removed without terminating
it from product migration code, an exact retry applies once; another run is a no-op.
No other role, password, database or tenant data changes.

### P5 — standing and independent Tier-3 execution

Focused P0–P4, migration/deployment acceptance, exact schema check, cumulative gate with
one unique added mapping, standing tests, typecheck, boundaries, licences/audit,
protected hashes and pristine referee `11 passed, 0 failed of 11` pass. A non-implementing
Tier-3 reviewer personally reproduces P0 on the immutable parent and P1–P4 on the exact
implementation SHA using exclusive disposable PostgreSQL clusters, inspects the role
catalog/membership/session queries, and confirms every sibling risk remains open.

## Exclusive discharge and residual risks

Approval may close only `database.caller-controlled-rls-tenant` under Yellow's supported
no-direct-database-principal architecture. It must not be represented as closing:

- `database.occupancy-caller-tenant`: occupancy function tenant arguments and binding
  remain separate;
- `database.runtime-bootstrap-superuser`: the application/deployment DSN, `RESET ROLE`,
  ownership and BYPASSRLS risk remain separate;
- `database-grants.runtime-role-direct-dml`: the broad internal role grants remain;
- SECURITY DEFINER temporary-object containment: already bounded by Order 108 and not
  modified here;
- arbitrary SQL obtained after the trusted application assumes `app_role`, future
  customer/BI database principals, runtime credential compromise, `FORCE RLS`, role
  ownership/deployment proof, or future administrator re-grant of LOGIN/membership.

If an independent reviewer concludes the demonstrated finding requires immutable
session-to-tenant binding even with no direct principal or raw-SQL surface, the result is
PARTIAL and the Cyber finding remains open; this order must not claim closure by wording.

## Builder evidence

- Exact hostile-red commit `393d19e93d85d555718245ad796e72e60790a08c`
  on migrations 0001–0011 authenticated directly as `app_role`, enumerated the victim
  tenant, changed transaction-local context and returned the victim Party sentinel:
  0/1 hardened assertions passed, without printing the proof password or database URL.
- Exact executable `b6a1319f571ea0cb079f75cedf06edf35548a1d2`
  includes migration 0012, focused proof, acceptance/gate/docs, Order 122's separate
  test-fixture correction and the honest built-status snapshot. Focused P0–P4 passes
  5/5 with 25 assertions. Deployment acceptance passes 5/5; the native-WSL migration
  suite passes 16/16 with 90 assertions.
- The fresh WSL cumulative runner passes all 16 isolated suites from suite one. The
  inherited founder-status login-budget conflict first stopped honestly at exact 429,
  was corrected only by separately scoped Order 122, then passed 7/7 with 82 assertions.
  The post-status exact executable reran founder status 7/7 with 82 assertions.
- Standing tests pass 163/0 (402 database-gated skips; 1,923 assertions), typecheck and
  64-file boundaries pass, licences cover 23 packages, audit reports no vulnerabilities,
  normalized schema is exact, and protected baseline/referee hashes remain
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`
  / `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`.
  Pristine setup applies 12 migrations, retains 85 tables and 75/75 RLS, and passes
  `11 passed, 0 failed of 11`.
- Corrections are disclosed: the active-session atomic-failure proof must preserve its
  deliberately installed proof password; success/failure reset proofs use separate
  max-one pools after repeated observer checkouts exposed a Bun harness hang; Windows
  symlink creation returned OS EPERM, so the complete migration suite was rerun natively
  under WSL. None changed production behavior or weakened a precondition.
- This builder candidate would exclusively discharge
  `database.caller-controlled-rls-tenant` only after independent approval/integration.
  Thirteen sealed findings remain formally open now; the occupancy caller tenant,
  privileged runtime DSN/RESET ROLE, broad direct DML grants and all other sibling risks
  remain explicitly unresolved. Nothing is merged, pushed or live.

## Independent review evidence

- Independent non-implementing Tier-3 review:
  `handoff/reviews/118-app-role-nonlogin.md`.
- Verdict: APPROVED for exact executable
  `b6a1319f571ea0cb079f75cedf06edf35548a1d2` only.
- Reviewer personally reproduced the exact-parent direct-login victim-tenant read, then
  passed focused P1–P4 at 5/5 with 25 assertions, migration 16/16 with 90 assertions,
  deployment acceptance 5/5, cumulative 16/16, standing 163/0, typecheck/64 boundaries,
  licences/audit, exact schema/protected hashes and pristine referee 11/11.
- Approval remains exclusive to the direct-principal condition and explicitly leaves
  occupancy caller binding, privileged runtime/RESET ROLE, broad direct DML and all other
  sibling risks outside scope. No merge, push or live deployment is implied.

## Definition of done

- [x] Order 117 is independently approved and integrated on this lineage; this order
      records the exact reviewed implementation Base before P0 work.
- [x] Migration-number collision is explicitly resolved and this order names exact
      unused forward migration 0012; finance planning was visibly shifted by D-344.
- [x] Intentional P0 red is committed on the exact parent before migration code.
- [x] P1 proves every exact role attribute, no credential, no membership, no direct
      session, unchanged tables/RLS and exact migration ledger.
- [x] P2 proves direct login and ungranted assumption fail without exposing secrets.
- [x] P3 proves the ordinary verified tenant transaction, role/context reset and A/B
      isolation remain exact.
- [x] P4 proves active-session/membership upgrades fail atomically and exact retry/no-op.
- [x] P5 standing gates and protected hashes pass on the exact implementation SHA.
- [x] Independent non-implementing Tier-3 reviewer personally executes the hostile and
      green proofs and records APPROVE/REJECT for that SHA only.
- [x] Cyber progress reports the exact exclusive discharge and every residual sibling;
      no merge, live, complete-app or complete-Cyber claim is made without integration.
