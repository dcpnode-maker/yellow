# Order 325 — Room outages label local refresh

**Status:** BUILT-LOCALLY-PENDING-FRESH-TIER3-REVIEW-D906
**Phase:** 7 — founder-visible presentation of already-built stay journeys
**Branch:** `phase-7/room-outages-label-local-refresh`
**Base:** `490a2f8` (independently approved Order324 governance head)
**Runtime source:** `c3afab2b86e57be7ab6445322f42dfb6e8f648ab`
**Risk tier:** 3 — sole founder-local replacement; fresh non-operating review mandatory

## Outcome

Reflect approved Order324 in the one loopback3000 app while preserving every database,
companion, credential, property, status and business identity.

## Exact scope

- build exact approved runtime source and replace only the sole app;
- retain approved Order323 stopped for rollback and inherit its exact network, loopback
  bind, health contract and environment;
- verify health, prefilled protected login, two properties, 24 routes, truthful status,
  live Room outages labels and unchanged database/companions/ports;
- fresh non-operating Tier3 read-only review.

## Forbidden

No second/public UI, database/provider/Valkey/network/volume change, schema/migration/
seed/data/credential/environment/status/authority/post310 work, merge, push, deploy or
rollback deletion.

## Definition of done

- [x] Exact approved image built and sole app refreshed.
- [x] Live acceptance and preservation proof pass.
- [x] Order323 remains stopped for rollback.
- [ ] Fresh non-operating Tier3 reviewer approves.

## Builder evidence — D906

- Exact approved runtime `c3afab2` built image
  `sha256:58ad2103d6d254bb2cd56b3b192ea9fc2f6d58ceed5ca312a88f3f37b9823456`
  with exact OCI revision and now runs as the sole healthy loopback3000 app,
  restart0.
- Order323 is stopped as the approved rollback; its environment is byte-identical to
  the replacement. PostgreSQL/provider/Valkey remain healthy with restart0 and ports
  3002/3123/3188 remain closed.
- Protected local prefill asset, credential-valid sign-in, two properties, no-store
  property/status requests, exact status310/311/91/P7/11 and live `Room outages`
  presentation pass.
- Explicit read-only database proof confirms unchanged59 migrations,110 base tables,
  2 views,100 policies,2 properties and8/0/8/75/22 party/contact/role/fact/outbox.
