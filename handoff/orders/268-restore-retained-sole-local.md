# Order 268 — Restore exact retained sole-local containers

**Status:** APPROVED-LOCALLY-D698
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/restore-retained-sole-local`
**Base:** `c6a30f1` (Order267 changes-required review)
**Risk tier:** 3 — exact retained runtime start and live continuity proof
**Owner:** Codex operations; independent non-operating verification mandatory

## Authority and outcome

D695 proves the exact sole-local app, PostgreSQL and Valkey containers exited
simultaneously with code255 while preserving identities, approved image, retained
volume and restart count0. Start only those exact retained containers, in dependency
order, without Compose or recreate. Prove the reconciled database and application are
fully live and obtain fresh independent approval before resuming Order266.

## Exact scope

- start exact PostgreSQL `f4f02655770a` and Valkey `aa3061bdf231`, wait for their
  existing healthchecks, then start exact app `b084c60b9fe6` and wait for health;
- no `docker compose up`, create, recreate, build, pull, replace, remove, restart,
  environment/image/port/volume/configuration change or second container;
- verify exact retained volume, approved image, sole loopback3000 and closed3002/3188;
- logging-safe read-only database, backup, HTTP, login, status and resource proof;
- this order, decisions, ledger, BUILD-PLAN and independent review evidence only.

## Required proof

1. Pre-start all three exact full IDs are exited255/restart0 and exact retained volume,
   image and configured loopback ports remain.
2. `docker start` targets literal full IDs only. PostgreSQL/Valkey become healthy
   before app start; app then becomes healthy with the same IDs and restart0.
3. Restricted Order267 backup remains exact630690 bytes/SHA256b427ea1a…5201/891
   readable lines/owner+SYSTEM ACL.
4. `yellow_dev` is exact migration44/98 tables/88 policies/two properties/all-table
   digest739b6a2d…8763 and `yellow_order266_migration` is absent.
5. Root/health/login/assets are200; root is no-store with three populated defaults and
   masked password; authenticated discovery returns two properties and both project
   snapshots262/263/review91/active7; only3000 is open.
6. Independent non-operating reviewer personally repeats all safe live assertions.

## Forbidden

No database/schema/row/role/credential/cache/product/file mutation; no Compose action,
container/image/volume create/recreate/remove/restart; no migration/seed/Order266 proof;
no second local/public bind; no merge/public deploy/Phase7/app-complete claim.

## Rollback

If any exact identity/volume/image/port differs before start, stop with no action. If a
retained container fails health, leave evidence intact and stop; do not recreate or
replace. Never restore over `yellow_dev` without a separate order.

## Definition of done

- [x] Exact retained containers are healthy with unchanged identity and topology.
- [x] Database, application, authenticated status and sole-port truth are exact.
- [x] Independent non-operating Tier-3 review records approval or findings.

## Restoration evidence — D697

The authorized literal-full-ID start completed in dependency order: retained
PostgreSQL and Valkey reached their existing healthy states before the retained app
was started. Exact app `b084c60b9fe6`, PostgreSQL `f4f02655770a` and Valkey
`aa3061bdf231` are healthy with restart count0. The app remains approved image
`83a7bb59bd70`; the exact named PostgreSQL volume remains mounted at
`/var/lib/postgresql/data`. No Compose, create, recreate, build, pull, replace,
remove, restart or configuration action ran.

Fresh logging-safe read-only proof reproduced backup630690 bytes/SHA256
`b427ea1a…5201`/891 `pg_restore -l` lines/owner+SYSTEM-only ACL; product database
migration44/98 public tables/88 policies/two properties/scratch0; and the exact
all-table digest `739b6a2d…8763`. Root, health, login and all operator assets are
HTTP200; root is no-store with exact populated tenant/email/masked-password defaults.
Protected current login succeeds without exposing its value, discovery returns both
hotels, and each reports exact latest262/current263/review91/active7. Only port3000
is open;3002/3188 are closed. At capture, app/PostgreSQL/Valkey used approximately
87.82/83.18/4.65 MiB RAM and13.61/4.60/0.19% CPU respectively, with no resource risk.
Independent non-operating Tier-3 re-execution remains mandatory before approval.

## Independent approval — D698

The independent non-operating Tier-3 reviewer inspected exact commit `713a6a7` and
personally reproduced every safely repeatable Git, backup, ACL, container identity,
image, volume, health, restart, topology, resource, read-only database, catalog,
all-table digest, scratch-absence, HTTP, asset, no-store populated masked sign-in,
authenticated two-property status and sole-port assertion. The reviewer emitted no
protected value and performed no container, database, cache, credential or runtime
mutation. The historical start commands were correctly bounded as non-repeatable
without violating this order. Verdict: APPROVED. Order266 may resume only under its
own isolated proof authority.
