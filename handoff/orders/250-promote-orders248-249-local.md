# Order 250 — Promote Orders248–249 to the sole local app

**Status:** READY-D649
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/promote-orders248-249-local`
**Base:** `d15424f` (built Order249 descendant of built Order248)
**Risk tier:** 3 — reversible local schema and app promotion
**Owner:** Codex operations; product review remains deferred

## Outcome

Update the sole loopback-local stack from migration39/status245/246 to exact committed
migration40/status248/249. Preserve both hotel properties, protected one-click login,
all prior product data, PostgreSQL/Valkey containers and volume, and port3000 topology.

## Exact scope

- sole Compose project `yellow-order175-folio-responsive-containment`;
- owner-only verified pre-change backup on `D:\Yellow\backups`;
- committed migration runner applying only migration0040;
- app-only image rebuild/replacement from clean committed `d15424f` descendant;
- unchanged protected runtime/login authority files and PostgreSQL/Valkey services;
- this order, `DECISIONS.log`, `handoff/LEDGER.md` and operational evidence.

## Required proof

1. Pre-change exact healthy one-local topology, source/image/container/volume identity,
   migration39, 94 tables, 84 policies, two properties and all table counts.
2. Nonempty custom-format backup, restricted ACL, SHA-256 and restore catalogue before
   mutation; retain a rollback app image.
3. Apply only migration0040 with committed hash
   `b61d1332acf17df9189612d355fb584754bdd7ddda9782e377bf73be44cc589b`.
4. Post-change migration40/95 tables/85 policies, empty binding root, two properties,
   only migration ledger growth and the new empty root relative to prior counts;
   PostgreSQL/Valkey/container/volume identities unchanged.
5. Recreate only app; prove health/root HTTP200, protected populated masked no-store
   sign-in, successful operator login, exactly two properties and both status reads
   exact date2026-08-29/latest248/current249/review91/active7.
6. Port3000 remains the sole app listener; 3002/3188 remain closed; served status
   source is exact to clean committed HEAD.

## Forbidden

No provision, seed, credential/role/password change, data cleanup, second local,
PostgreSQL/Valkey recreation, public bind, merge, production deployment, product
review approval, Phase or application-complete claim.

## Rollback

Build failure leaves the app untouched. Migration failure uses the verified backup
only if required. App failure after the additive migration first restores the retained
rollback image; database restore is reserved for exact pre-order schema restoration.
