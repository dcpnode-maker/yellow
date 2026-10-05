# Order 255 — Promote Orders251–254 to the sole local app

**Status:** APPROVED-LOCALLY-D663
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/promote-orders251-254-local`
**Base:** `4d92b51` (approved Order254 descendant of built Order253)
**Risk tier:** 3 — reversible local migration and app promotion
**Owner:** Codex operations; independent non-operating verification required

## Outcome

Update the sole loopback-local stack from migration41/status248/249 to exact committed
migration42/status252/253. Preserve both hotel properties, protected one-click login,
all product data, current PostgreSQL/Valkey identities and volume, and port3000 topology.

## Exact scope

- sole Compose project `yellow-order175-folio-responsive-containment`;
- new owner-restricted verified pre-change backup and count digest on
  `D:\Yellow\backups`;
- retained rollback image of current app image `9d6bb66c…`;
- committed production runner applying only migration0042 after exact migration0041
  checksum verification;
- app-only image rebuild/replacement from clean committed `4d92b51`;
- unchanged protected runtime/login authority files, PostgreSQL container
  `b0a92182a16a`, Valkey `ae62afc8df69` and volume
  `yellow-order175-folio-responsive-containment_yellow-pgdata`;
- this order, `DECISIONS.log`, `handoff/LEDGER.md` and operational review evidence.

## Required proof

1. Pre-change sole healthy loopback3000, closed3002/3188, migration41 exact historical
   checksum, 96 tables, 86 policies, two properties and exact current row digest.
2. Nonempty custom-format backup with restricted ACL, SHA-256 and successful
   `pg_restore --list`; retain exact rollback app image.
3. Production runner validates rows1–41 and applies only migration0042 checksum
   `dd2622f…c098`; migration rerun is a no-op.
4. Post-change migration42/96/86, final function exact, all prior table counts and both
   properties unchanged; only ledger row42 is added.
5. Recreate only app; prove health/root200, protected populated masked no-store login,
   operator login200, exactly two properties and both statuses exact
   date2026-08-29/latest252/current253/review91/active7.
6. Served Order251/252/status source is exact to clean committed HEAD; port3000 remains
   sole app listener and3002/3188 remain closed.
7. Independent non-operating reviewer verifies the final state and records findings.

## Forbidden

No provision, seed, credential/role/password change, data cleanup, second lasting
local, PostgreSQL/Valkey recreation, volume change, ledger rewrite, public bind,
merge, production deployment, deferred product-review claim, Phase or
application-complete claim.

## Rollback

Build failure leaves the app untouched. Migration failure stops before app replacement
and uses the verified backup only if exact additive rollback is required. App failure
after migration first restores the retained rollback image; database restore is
reserved for exact pre-order lineage restoration.

## Definition of done

- [x] Backup, rollback image and pre-change digest are verified.
- [x] Only migration0042 and the app container change.
- [x] Login, both properties, exact status and one-local topology are green.
- [x] Independent non-operating verification records approval or findings.

## Promotion evidence

The owner/SYSTEM-only 692,682-byte backup has SHA-256 `8f875088…874f`, a
readable 1,269-entry restore catalogue and an exact 95-table pre-change count digest.
The rollback image retains the prior app image `9d6bb66c…`.

The production runner validated historical row41, applied only migration0042 and
then reported no-op. PostgreSQL remains container `b0a92182a16a`, Valkey remains
`ae62afc8df69`, the exact retained volume and all 95 non-ledger counts are unchanged,
and the final database is migration42/96 tables/86 policies/two properties.

One healthy replacement app `c003bc076893` serves only loopback3000 with protected
populated masked one-click sign-in and exact status252/253/review91/active7 for both
properties. Ports3002/3188 remain closed. The promotion-critical Order251 posting,
Order252 reservation-lineage and Order253 status source hashes are exact to clean
served HEAD. Independent non-operating verification is recorded in
`handoff/reviews/255-promote-orders251-254-local.md`.
