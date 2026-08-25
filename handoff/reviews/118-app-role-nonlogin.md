# Independent review — Order 118 internal app-role boundary

**Verdict:** APPROVED
**Risk tier:** 3
**Reviewer:** independent non-implementing OpenAI Codex security reviewer
**Implementation reviewed:** `b6a1319f571ea0cb079f75cedf06edf35548a1d2`
**Builder metadata parent:** `dddf0242b3932d1bc7dc57aeb37429f86223e8cb`
**Required red parent:** `393d19e93d85d555718245ad796e72e60790a08c`
**Order:** `handoff/orders/118-app-role-nonlogin.md`

This approval is exact-SHA and exclusively discharges
`database.caller-controlled-rls-tenant` (`occ_48ef46aabb565be569c6e79d`) under
Yellow's supported architecture in which no customer, staff, integration or BI client
receives a direct database principal. It approves neither a branch name nor a later
commit, integration, deployment, public exposure or another Cyber finding.

## Findings

No Order-118 implementation, security or scope finding.

`git diff --check` reports trailing spaces only in the separately scoped Order-122 and
Question-141 Markdown metadata incorporated before the reviewed built-status snapshot.
Those lines change no production, migration, database or authentication behavior and are
not an Order-118 approval blocker. They are disclosed here rather than silently described
as a clean whole-range whitespace check.

## Static security inspection

The reviewer read `migrations/0012_app_role_nonlogin.sql` directly and recomputed its
SHA-256 as
`6f377ca182bcbd8ece5c6a0688597b4a4e0fc5129345a80f6f9d31076fb0ed25`.
The migration:

- resolves the exact required `app_role` before mutation and fails with SQLSTATE `55000`
  if it is absent;
- queries `pg_catalog.pg_auth_members` in both directions (`roleid` and `member`) and
  fails before alteration if any explicit membership exists;
- queries cluster-wide `pg_catalog.pg_stat_activity` for a directly authenticated
  `app_role` session and requires the operator to drain it; it contains no termination;
- applies exact `NOLOGIN`, `PASSWORD NULL`, `CONNECTION LIMIT 0`, `NOSUPERUSER`,
  `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, `NOREPLICATION` and `NOBYPASSRLS` attributes;
- validates the complete postcondition from `pg_catalog.pg_authid` inside the same
  migration transaction.

All preconditions precede the `ALTER ROLE`. The unchanged migration runner executes the
file and its `schema_migration` ledger insertion in one transaction, so a failed
precondition leaves neither partial attributes nor version 12. No table, policy,
function, ACL or existing runtime grant is changed.

`src/kernel/db.ts` is byte-identical across the reviewed parent/product range. Its
unchanged trusted path begins a transaction on one reserved connection, sets
`app.tenant_id` with transaction-local `true`, executes `SET LOCAL ROLE app_role`, and
commits or rolls back before release. The role and tenant context therefore unwind with
the transaction rather than relying on session state.

## Reviewer-executed evidence

All PostgreSQL execution used exact PostgreSQL `16.15` and unique disposable projects.
The live `yellow` application/database/Valkey project and the builder branch were not
changed.

### P0 — exact-parent hostile red

In a detached worktree at exact parent
`393d19e93d85d555718245ad796e72e60790a08c`, the reviewer started an exclusive fresh
cluster, applied migrations 0001–0011, and ran the committed hostile proof. PostgreSQL
accepted a randomly generated proof-only password for `app_role`; a distinct TCP session
authenticated, enumerated the victim tenant, changed transaction-local tenant context,
and returned `Order 118 victim sentinel` from the victim Party row.

Result: `0 pass, 1 fail`; the received evidence was
`authenticated: true` with the victim sentinel instead of the hardened expected false/empty
result. No proof password or connection URL was printed. The entire parent project and
volume were then destroyed.

### P1–P4 — exact executable green

The review worktree was detached at exact executable
`b6a1319f571ea0cb079f75cedf06edf35548a1d2`. A second exclusive fresh cluster applied all
twelve migrations, and the reviewer ran:

```text
bun test tests/app-role-nonlogin.integration.test.ts
```

Result: `5 pass, 0 fail, 25 assertions`.

- P1 returned the exact nine role attributes, no incoming/outgoing membership, no direct
  session, exact version-12 filename/checksum, 85 public tables, and RLS/policies `75/75`.
- P2 proved that installing a password cannot override `NOLOGIN`/connection-limit zero;
  an unrelated ordinary login cannot `SET ROLE app_role` or enumerate tenants.
- P3 used the unmodified `Database.withTenantTransaction` for tenant A and B. Each saw
  only its sentinel, with `current_user = app_role` and the exact transaction-local tenant.
  On separate max-one pools, both success and injected failure reused the same backend PID
  and observed role plus tenant context reset.
- P4 independently exercised membership into `app_role`, membership inherited by
  `app_role`, and an already-authenticated direct session. Each failed with `55000`, no
  migration ledger row and no partial role-attribute change. Removing the exact
  precondition allowed one clean retry; the following run was an exact no-op. The
  deliberately installed active-session proof password remained intact across the failed
  transaction and was cleared before successful retry, which is the correct atomicity
  result.

### Migration, deployment and cumulative proofs

The full migration suite was run natively on WSL to avoid the disclosed Windows symlink
restriction:

```text
bun test tests/migrate.integration.test.ts
```

Result: `16 pass, 0 fail, 90 assertions`, including exact migration 0012 application,
atomic-failure cases, checksum/ledger behavior, connection affinity and stable no-op.

After exact migration and canonical seed, database acceptance returned
`5 pass, 0 fail, 12 assertions`: PostgreSQL 16.15, exact 12-row ledger, deploy ownership,
internal-role contract and canonical tenant/property all matched.

The reviewer then ran the cumulative runner from suite one on native WSL against the
exclusive review cluster. Result: `16/16 suites passed with isolated databases`. The
inherited Order-069 P8 performance proof passed in `14.895s`, under its 15-second ceiling;
the financial-postings, SECURITY DEFINER and Order-118 suites all passed. The runner plus
Order-117 regression unit proof separately returned `16 pass, 0 fail, 202 assertions` and
confirmed sixteen unique mappings.

### Pristine referee and repository gates

A third disposable Compose project and new volume ran `setup.ps1 -DbOnly`. It applied
twelve migrations to both databases, retained 85 public tables and RLS `75/75`, then
returned the canonical `11 passed, 0 failed of 11` referee. Exact schema drift check
matched `tests/schema/expected.sql`.

Standing and static gates on the exact executable returned:

- `bun test`: `163 pass, 402 skip, 0 fail, 1,923 assertions`;
- TypeScript: clean;
- import boundaries: `64 TypeScript files scanned`;
- frozen lockfile install: success;
- licence policy: `23 installed package(s)`;
- dependency audit: `No vulnerabilities found`.

Protected SHA-256 values exactly match `handoff/GATE-3-MANIFEST.md`:

- `migrations/0001_init.sql` —
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`
- `tests/run_invariants.py` —
  `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`

### Order 122 and metadata identity

The exact Order-122 executable range
`09070d97e1f457a2d3f87a2ab6dc33b558bc3895..8bdd977a7db7449117c4c94ff9d8782223525b50`
has an empty diff across `src`, `migrations`, `scripts`, package/lock, Dockerfile and
Compose. Its only executable change constructs a fresh `LocalLoginService`/app per
independent founder-status database test. Founder status passed `7/7` inside the full
cumulative run and the unchanged Order-117 limiter passed `10/10`; no production security
behavior was altered.

The range from reviewed executable `b6a1319` to builder metadata head `dddf024` changes
only `DECISIONS.log`, `handoff/LEDGER.md` and the Order-118 record. It does not change the
reviewed product identity.

## Disclosed discarded attempts

1. Windows could not execute `state.sh` inside the managed sandbox; the reviewer reran it
   successfully through WSL before review execution.
2. The first Windows migration-suite invocation did not yield a complete captured result
   and was not accepted as evidence. The complete exact-SHA suite was rerun natively under
   WSL, where the repository's disclosed Windows symlink limitation does not apply, and
   passed 16/16.
3. The first pristine setup attempt selected Windows port 65430, which the host refused
   before the complete service set started. That specifically named disposable
   project/volume was removed;
   a new run on port 6543 passed completely.
4. The junction-backed Windows licence scan reported zero installed packages and was not
   accepted. The exact `bun.lock` hash matched the installed root lock; dependencies were
   copied into the native disposable worktree, frozen install succeeded, and the unchanged
   checker reported 23 packages.
5. The first schema invocation supplied `DATABASE_URL`; the tool correctly required
   `YELLOW_SCHEMA_DATABASE`. Only the corrected exact-match run is counted.

## Residual scope

This review closes only the demonstrated direct-principal entry condition. It does not
close or weaken review requirements for:

- `database.occupancy-caller-tenant`;
- `database.runtime-bootstrap-superuser`, deployment ownership, `RESET ROLE`, raw owner
  pools or `BYPASSRLS`;
- `database-grants.runtime-role-direct-dml`;
- arbitrary SQL after the trusted application has assumed `app_role`;
- future customer/BI database access, `FORCE RLS`, credential compromise or future
  administrator re-grant of LOGIN/membership;
- any other Cyber sibling, including destructive maintenance, external rate-intent,
  regular-expression, container, property authorization, duplicate-oracle and privacy
  findings.

Approval of this exact SHA leaves twelve sibling scan findings outside Order 118 on this
lineage. Independently reviewed sibling branches still require their own authorized
integration; this review does not declare them merged or live.

## Conclusion

Order 118 is **APPROVED** at exact executable SHA
`b6a1319f571ea0cb079f75cedf06edf35548a1d2`. No implementation, merge, push, live-stack
or deployment action was taken.
