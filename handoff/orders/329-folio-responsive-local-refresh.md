# Order 329 — Folio responsive local refresh

**Status:** BUILT-LOCALLY-PENDING-FRESH-TIER3-REVIEW-D918
**Phase:** 7 — founder-visible presentation of already-built financial journeys
**Branch:** `phase-7/folio-responsive-local-refresh`
**Base:** `c069220` (independently approved Order328 governance head)
**Runtime source:** `f11440e9f0f0fd78dbe4c1a8b9fedc4b09330aee`
**Risk tier:** 3 — sole founder-local replacement; fresh non-operating review mandatory

## Outcome

Reflect approved Order328 in the one loopback3000 app while preserving every
database, companion, credential, property, status and business identity.

## Exact scope

- build exact approved runtime source and replace only the sole app;
- retain current Order327 stopped for rollback and inherit its exact network,
  loopback bind, health contract and environment;
- verify health, protected one-button login, two properties,24 routes, truthful
  status, live Separate charges journey,375/640 containment and unchanged
  database/companions/ports;
- fresh non-operating Tier3 read-only review.

## Forbidden

No second/public UI, database/provider/Valkey/network/volume change, schema/migration/
seed/data/credential/environment/status/authority/post310 work, merge, push, deploy or
rollback deletion.

## Definition of done

- [x] Exact approved image built and sole app refreshed.
- [x] Builder live acceptance and preservation proof pass.
- [x] Order327 remains stopped for rollback.
- [ ] Fresh non-operating Tier3 reviewer approves.

## Builder evidence — D918

- Exact approved runtime `f11440e` built image
  `sha256:fc8cbf2500bcc6e70d5852b52f927663a59d2487a382c6cdc9f1922238828e09`
  with exact OCI revision and now runs as the sole healthy loopback3000 app,
  restart0. Order327 is stopped as rollback.
- The first cutover health wait exposed a Docker Desktop engine stall after the old
  app had stopped. No application, network, volume or data deletion occurred. Docker
  Desktop was recovered; the existing PostgreSQL/provider/Valkey containers were
  restarted healthy and the already-created exact replacement became healthy.
- Current and rollback environment hashes are identical, network/bind/health are
  inherited, obsolete ports3002/3123/3188 are closed, and the live no-store CSS has
  exact component containment/local-scroller rules with no root/body overflow hiding.
- A reusable guarded cutover helper now validates exact Yellow container/image names,
  preserves environment internally without output, and restores the named rollback
  on bounded health failure. Fresh non-operating Tier3 browser/database review remains
  mandatory.
