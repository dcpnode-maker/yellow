# Order 268 — Restore exact retained sole-local containers

**Status:** READY-D696
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

- [ ] Exact retained containers are healthy with unchanged identity and topology.
- [ ] Database, application, authenticated status and sole-port truth are exact.
- [ ] Independent non-operating Tier-3 review records approval or findings.
