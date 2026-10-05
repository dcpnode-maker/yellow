# Q265 — Order472 isolated native database proof

Status: source and conditional execution admitted by primary owner, 13 September 2026.

## Reason and exact target

New current-actor/property authorization and immutable confirmation require actual
PostgreSQL proof, not mocked SQL. The current app and retained research databases
must not be used as disposable fixtures. Historical migrations1/12/15 and bootstrap
tools can alter cluster-wide roles or require the running app to disconnect.

Use only preserved PostgreSQL16.15 at 127.0.0.1:55503 and exactly one NEW synthetic
target: `yellow_order472_compset_20260913`. The preferred source is the existing
idle pristine `yellow_order434_production`, historically77 migrations/127 public
tables/zero tenants. That historical identity must be proved again immediately
before creation; it is not assumed. Owner must be yellow_deploy. No other source,
fallback target, current app data, PriceLabs data or global bootstrap is authorized.

## Preflight and conditional execution

Root may use the existing protected native database authority without printing or
persisting its secrets. All database URLs are child-environment only. Require exact
loopback host, port, user and database, no URL query/fragment/options; verify native
binary identities, PostgreSQL version, actual cluster identity, target absence,
template owner, zero template sessions/tenants and exact1–77 migration checksums.
Capture bounded before/after fingerprints of cluster-global role attributes and
membership without exposing password values. Check disk reserve. Do not disconnect
any process or pause the app to make preflight pass.

Only after those checks pass: create the exact absent target using that template,
owned by yellow_deploy. Run the canonical migration runner on this target, applying
only the separately inspected suffix78–92, never1–77 again. The admitted suffix
must not alter global roles/memberships; the new92 capability is read/lock only.
Seed only purpose-built synthetic tenant/actor/property/permission/evidence rows
in the target. Do not execute the application's hotel seed or provisioning tools.

The helper validates exact dedicated Order472 opt-in URLs and fails before SQL
against any other database. Tests may simulate revoked grants and late fact/outbox
failure only within this target. Capture actual concurrency, replay, tenant/property
isolation, rollback and privilege results. Preserve failed proof evidence; do not
silently continue after migration/fixture failure or treat skips as acceptance.
No automatic DROP, TRUNCATE, teardown, WITH FORCE or broad fixture cleanup. Retain
this one bounded synthetic target for reruns with unique per-run synthetic UUIDs.

## Source and verification ownership

`/root/q258_source_adapter` owns new
`scripts/native/prepare-market-compset-proof.ts` and
`tests/helpers/market-compset-fixture.ts`. Astra owns production domain/migration;
Terra owns HTTP. Root additionally owns new
`tests/native-market-compset-proof.test.ts` for independently executed pure
environment/target-boundary rejection tests, with no database calls. Root
independently inspects the helper and personally executes
the final production proof. No app/server deployment, listener change, permission
assignment to real users, paid service, migration of the live app, Git publication
or phase closure is authorized by this test tranche.

## Execution result — D1489

Root independently inspected and executed the exact Review then Prepare, followed
by actual domain/HTTP proof11pass0fail78 and the combined113pass0fail838 suite.
The retained target is frontier92,19,438,615 bytes,44 synthetic tenants after two
runs. Before/after cluster role/outside-target catalogue fingerprints matched.
The first read-only /32 address-rendering mismatch stopped before creation and
was repaired without weakening the exact address check. Actual schema snapshot
matches the normalized native pg_dump output. See Review472 for commands, hashes,
all findings and limitations. No live application, business data, role assignment,
Docker/WSL or Git publication was changed. The app remains41415/frontier91.
