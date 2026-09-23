# Order 247 — Promote Orders 244–246 to the sole local app

**Status:** APPROVED-LOCALLY-D644
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/promote-orders244-246-local`
**Base:** `088465d` (built Order246 descendant of built Orders244/245)
**Risk tier:** 3 — reversible local schema and app promotion
**Owner:** Codex operations; independent product review remains deferred

## Outcome

Update the sole loopback-local stack from migration37/recorded status240/242 to exact
committed migrations39 and recorded status245/246. Preserve both hotel properties,
all prior product data, protected one-click login, PostgreSQL/Valkey volumes and sole
port3000 topology. Add only the empty canonical tax-attribution table/policy and the
two forward SECURITY DEFINER configuration repairs admitted by Orders244/245.

## Exact scope

- sole Compose project `yellow-order175-folio-responsive-containment`;
- owner-only pre-change backup on `D:\Yellow\backups` with restore catalogue proof;
- committed migration runner applying only migrations0038/0039;
- app-only image rebuild/replacement from clean committed `088465d` descendant;
- unchanged protected runtime-authority/login files and existing PostgreSQL/Valkey
  containers/volume;
- this order, `DECISIONS.log`, `handoff/LEDGER.md` and operational evidence.

No provision, seed, credential/role/password change, data cleanup, second local,
PostgreSQL/Valkey recreation, public bind, merge or production deployment is admitted.

## Required proof

1. Pre-change: one healthy app on loopback3000, no3002/no3188, exact container/image/
   volume ids, two properties, migration37, 93 public tables/83 policies and all table
   counts captured without secret disclosure.
2. Backup is custom-format, create-capable, owner/SYSTEM-only, nonempty, hashed and
   accepted by `pg_restore --list` before database mutation.
3. Migration runner applies exactly migration0038 hash
   `dea9cfaf573d56ce2c0f5ee7987bf7009d12d0517f72dcd8a3b316232937f982`
   and migration0039 hash
   `365ffb951f4ea5f4febac97ed7a4d86d5c342891d0d5464e8a36a73653c1b841`.
4. Post-change: 94 tables/84 policies/migration39, zero attribution rows, two
   properties, all 92 prior non-ledger table counts unchanged, ledger increases only
   by two, and PostgreSQL/Valkey container/volume ids remain exact.
5. Recreate only the app with preserved in-memory environment; prove exactly one app,
   health/root HTTP200, no-store populated masked one-click sign-in, protected operator
   login HTTP200, two properties, both authenticated status reads exact
   latest245/current246/review91/active7 with unfinished Phases5–7 active.
6. Served project-status source is byte-exact to clean committed HEAD; port3000 is the
   only app listener and ports3002/3188 stay closed. Retain a rollback app image.

## Rollback

Build failure leaves the current app untouched. Migration failure keeps the app
stopped and uses the verified backup if exact pre-order database restoration is
required. App failure after successful additive migrations first restores the prior
app image; database restore is used only when exact migration37 state is required.

## Forbidden claims

No independent product approval, review coverage above91, Phase5/6/7 completion,
application completion, merge, public or production deployment.

## Promotion evidence

Order247 built the exact committed app/database-tools images before the maintenance
window, retained rollback image `yellow-order247-rollback:pre-orders244-246`, stopped
only the app, verified the protected backup and applied exactly migrations0038/0039.
The database reached migration39/94 tables/84 policies with zero prior-count drift,
two properties and zero attribution rows; PostgreSQL, Valkey and the volume remained
unchanged. One healthy replacement app now serves loopback3000 with the protected
prefilled masked sign-in and exact status245/246/review91 for both properties.

Independent read-only operational verification is recorded in
`handoff/reviews/247-promote-orders244-246-local.md`. This is local-only approval and
does not constitute the deferred product review.
