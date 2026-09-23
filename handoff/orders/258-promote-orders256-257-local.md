# Order 258 — Promote Orders256–257 to the sole local app

**Status:** APPROVED-LOCALLY-D670
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/promote-orders256-257-local`
**Base:** `f6089d4` (approved Order256 plus built status Order257)
**Risk tier:** 2 — reversible app-only local promotion
**Owner:** Codex operations; independent non-operating verification required

## Outcome

Replace only the existing sole loopback application with a clean image from committed
`f6089d4`, so `http://127.0.0.1:3000` serves approved Order256 and exact Order257
recorded status. Preserve both hotel properties, protected populated one-click login,
all data, the exact PostgreSQL/Valkey containers and volume, and one-local topology.

## Exact scope

- sole Compose project `yellow-order175-folio-responsive-containment`;
- new owner-restricted verified pre-change backup on `D:\Yellow\backups`;
- retained rollback tag for current app image `f15586b3…`;
- app-only image rebuild/replacement from clean committed `f6089d4`;
- unchanged protected environment values, PostgreSQL `b0a92182a16a`, Valkey
  `ae62afc8df69`, database migration42/96 tables/86 policies and retained volume;
- this order, `DECISIONS.log`, `handoff/LEDGER.md` and operational review evidence.

## Required proof

1. Pre-change exact healthy container identities, sole loopback3000, closed3002/3188,
   migration42/96/86, two properties and current app image/status252/253.
2. Nonempty restricted custom-format backup with SHA-256 and readable restore list;
   retain the exact rollback app image.
3. Build from clean committed `f6089d4`; replace only app while preserving exact
   protected environment values and database/cache identities.
4. Prove health/root200, no-store protected populated masked sign-in, successful
   operator login, exactly two properties and exact status
   date2026-08-29/latest256/current257/review91/active7 for both.
5. Prove served Order256 eligibility and Order257 status source exact to clean HEAD;
   port3000 remains sole app listener and3002/3188 remain closed.
6. Independent non-operating reviewer verifies and records final state.

## Forbidden

No migration/seed/provision/database/credential/role/password/data/cache/volume
mutation; no second lasting local, PostgreSQL/Valkey recreation, public bind, merge,
production deploy, independent product-review or Phase/application-complete claim.

## Rollback

Build failure leaves the current app untouched. Replacement failure restores the
retained prior image with the exact preserved environment. The backup is precautionary
only because this order has no database mutation authority.

## Definition of done

- [x] Backup and rollback image are verified.
- [x] Only the app container changes.
- [x] Login, two properties, exact status and one-local topology are green.
- [x] Independent non-operating verification records approval or findings.

## Promotion evidence

The owner/SYSTEM-only 692,752-byte backup at
`D:\Yellow\backups\yellow-pre-order258-20260828T220705Z.dump` has SHA-256
`3941439a…a146` and 1,269 readable restore entries. The rollback tag retains prior
image `f15586b3…`.

Only app container `f76185512569` changed. PostgreSQL `b0a92182a16a`, Valkey
`ae62afc8df69`, the retained volume and database truth migration42/96 tables/86
policies/two properties are exact. The sole healthy loopback3000 app has protected
populated masked sign-in, login200 and both exact status snapshots
date2026-08-29/latest256/current257/review91/active7;3002/3188 are closed. Served
Order256 eligibility and Order257 status hashes are exact to clean `f6089d4`.
Independent non-operating PASS is recorded at
`handoff/reviews/258-promote-orders256-257-local.md`.
