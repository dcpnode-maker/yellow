# Order 323 — Arrival/departure journey local refresh

**Status:** BUILT-LOCALLY-PENDING-FRESH-TIER3-REVIEW-D898
**Phase:** 7 — founder-visible presentation of already-built stay journeys
**Branch:** `phase-7/arrival-departure-journey-local-refresh`
**Base:** `e2d2a36` (independently approved Order322 governance head)
**Runtime source:** `e1113d5b38d7edb9b6abf93dd77160a9805da25e`
**Risk tier:** 3 — sole founder-local replacement; fresh non-operating review mandatory

## Outcome

Reflect approved Order322 in the one loopback3000 app while preserving every database,
companion, credential, property, status and business identity.

## Exact scope

- build exact approved runtime source and replace only the sole app;
- retain Order321 stopped for rollback and inherit its exact network, loopback bind,
  health contract and environment;
- verify health, prefilled protected login, two properties, 24 routes, truthful status,
  live arrival/departure alignment and unchanged database/companions/ports;
- fresh non-operating Tier3 read-only review.

## Forbidden

No second/public UI, database/provider/Valkey/network/volume change, schema/migration/
seed/data/credential/environment/status/authority/post310 work, merge, push, deploy or
rollback deletion.

## Definition of done

- [x] Exact approved image built and sole app refreshed.
- [x] Live acceptance and preservation proof pass.
- [x] Order321 remains stopped for rollback.
- [ ] Fresh non-operating Tier3 reviewer approves.

## Builder evidence — D898

- Exact approved runtime `e1113d5` built image
  `sha256:780bda0a22572a699e54cc1be18e646053496323fbf27c0d8bee6d97e12f23b9`
  with exact OCI revision and now runs as sole healthy loopback3000 app, restart0.
- Order321 remains stopped for rollback; its complete environment is byte-identical to
  the replacement. PostgreSQL/provider/Valkey remain healthy with restart0 and ports
  3002/3123/3188 remain closed.
- Protected login, two properties, 24/24 authenticated routes with no-store and live
  `Arrivals & departures` placement pass.
- An explicit read-only database transaction confirms unchanged59 migrations,110 base
  tables,2 views,100 policies,2 properties and8/0/8/75/22 party/contact/role/fact/outbox.
