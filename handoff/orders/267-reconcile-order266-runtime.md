# Order 267 — Reconcile Order266 sole-local runtime incident

**Status:** CHANGES-REQUIRED-D695 — retained containers exited before review
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/reconcile-order266-runtime`
**Base:** `c8b4fb9` (paused Order266 implementation checkpoint)
**Risk tier:** 3 — guarded database cleanup and sole-local evidence repair
**Owner:** Codex operations; independent non-operating verification mandatory

## Authority and outcome

D692 proves the retained Yellow product database is byte-exact but records replacement
PostgreSQL/Valkey identities and one seeded Order266 scratch database created by a
worker scope error. Preserve the running app and retained product truth, take a fresh
restricted backup, remove only the exact scratch database, accept the replacement
container identities after complete verification, and restore one independently
approved sole-local baseline before Order266 database proof resumes.

## Exact scope

- create one owner/SYSTEM-only custom-format backup of exact `yellow_dev` under
  `D:\Yellow\backups`, record size/SHA/readable catalogue count without secrets;
- validate `yellow_order266_migration` exists, is not the configured product database,
  has no non-coordinator use, terminate only its sessions, and drop only that database;
- do not remove or alter any other database, role, schema, row, volume, container,
  image, cache key, credential or application file;
- accept current PostgreSQL `f4f02655770a` and Valkey `aa3061bdf231` only after exact
  product, health, sign-in, status, resource and port verification;
- this order, decisions, ledger, BUILD-PLAN and independent review evidence only.

## Required proof

1. Preflight exact app `b084c60b9fe6`/image `83a7bb59bd70`, current healthy
   PostgreSQL/Valkey, retained named volume, sole loopback3000 and closed3002/3188.
2. Read-only `yellow_dev` truth is migration44/98 tables/88 policies/two properties,
   exact all-table `table=count` digest
   `739b6a2d929a2278064e35935351f32fcc9290c16da2db9b5072e9640ed28763`,
   and both project snapshots262/263/review91/active7.
3. Restricted backup is readable by PostgreSQL16 `pg_restore -l`; size, SHA-256 and
   catalogue line count are recorded while ACL contains only owner and SYSTEM.
4. Exact target database name is compared literally against configured product DB
   before any destructive statement. Terminate/drop is one bounded explicit target;
   afterwards `yellow_dev` and every pre-incident database remain and only the exact
   disclosed scratch database is absent.
5. Post-cleanup product catalog, property count and all-table digest remain exact;
   app/root/health/login/assets are HTTP200; root is no-store with populated tenant,
   email and masked password; authenticated discovery returns two properties and both
   exact status snapshots; only3000 is open.
6. No app/PostgreSQL/Valkey/container/volume recreation or restart occurs under this
   order. Independent non-operating reviewer repeats the safely reproducible proof.

## Forbidden

No product migration, seed, schema/role/credential/cache/product-row change; no
scratch-data promotion; no deletion of `yellow_dev`, `postgres`, any pre-existing test
database or volume; no app/container/image rebuild/restart; no second local/public
bind; no Order266 database proof, product-review advance, merge, public deployment,
Phase7 or application-complete claim.

## Rollback

The seeded scratch database is disposable and has no product authority; it is not
restored after exact removal. If backup or any preflight differs, stop without drop.
If post-cleanup product truth differs, stop and preserve the restricted backup and
runtime for independent diagnosis; never overwrite product state.

## Definition of done

- [x] Fresh restricted product backup is readable and recorded.
- [x] Only exact `yellow_order266_migration` is removed.
- [x] Product data, app, sole port and replacement runtime identities are exact.
- [ ] Independent non-operating Tier-3 review records approval or findings.

## Reconciliation evidence — D694

Preflight confirmed unchanged healthy app `b084c60b9fe6` on approved image
`83a7bb59bd70`, healthy PostgreSQL `f4f02655770a` and Valkey `aa3061bdf231`, exact
retained volume and sole loopback3000. `yellow_dev` was read-only exact44/98/88/two
properties and canonical digest739b6a2d…8763.

Fresh custom backup
`D:\Yellow\backups\yellow-order267-reconcile-20260829T022152Z.dump` is630690 bytes,
SHA-256 `b427ea1ae369ddd6c6aa043f154aedcc304671b7886b4213c54d1dd0662c5201`,
has891 readable `pg_restore -l` lines and exact owner/SYSTEM-only FullControl ACL.
The literal target was separately proven present and unequal to configured product DB
`yellow_dev`; only its sessions were terminated and only
`yellow_order266_migration` was dropped. The complete pre-existing database set is
otherwise exact.

Post-cleanup proof is root/health/login/assets200, no-store, three populated fields
with masked password, authenticated two-property discovery, both snapshots
262/263/review91/active7, sole3000/no3002/no3188, catalog44/98/88/two properties,
digest739b6a2d…8763 and scratch count0. No container, image, volume, app, credential,
cache, product database or product row was restarted, replaced or mutated by the
reconciliation beyond the exact disclosed scratch-database removal.

## Independent finding — D695

The independent reviewer approved exact Git scope and independently reproduced the
restricted backup's size, SHA, pg_restore readability and ACL. Before live proof, all
three retained containers exited simultaneously with code255 at
`2026-08-29T02:52:03Z`. Exact app/PostgreSQL/Valkey identities, approved image and
retained volume remain present with restart count0, but port3000 is closed. Live
database, HTTP, login and status assertions are therefore unavailable rather than
disproven. A separate order must start the same retained containers without recreate
or volume mutation and obtain a fresh independent review. Order267 is not approved.
