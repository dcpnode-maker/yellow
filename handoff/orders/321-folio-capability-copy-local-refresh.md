# Order 321 — Folio capability copy local refresh

**Status:** BUILT-LOCALLY-PENDING-FRESH-TIER3-REVIEW-D892
**Phase:** 7 — founder-visible presentation of already-built Phase 5 journeys
**Branch:** `phase-7/folio-capability-copy-local-refresh`
**Base:** `4910efe` (independently approved Order320 governance head)
**Runtime source:** `94e76a8b2788e59298a0e16cdcb9267df30bb23a`
**Risk tier:** 3 — sole founder-local replacement; fresh non-operating review mandatory

## Outcome

Reflect approved Order320 copy in the one loopback3000 app while preserving every
database, companion, credential, property, status and business identity.

## Exact scope

- build exact approved runtime source and replace only the sole app;
- retain Order319 stopped for rollback and inherit its exact network, loopback bind,
  health contract and environment;
- verify health, prefilled protected login, two properties,24 routes, truthful status,
  both changed copy surfaces and unchanged database/companions/ports;
- fresh non-operating Tier3 read-only review.

## Forbidden

No second/public UI, database/provider/Valkey/network/volume change, schema/migration/
seed/data/credential/environment/status/authority/post310 work, merge, push, deploy or
rollback deletion.

## Definition of done

- [x] Exact approved image built and sole app refreshed.
- [x] Live acceptance and preservation proof pass.
- [x] Order319 remains stopped for rollback.
- [ ] Fresh non-operating Tier3 reviewer approves.

## Builder evidence — D892

- Exact approved source94e76a8 built image
  `sha256:6e1142348cc76ff1f971bb04408586fba12b4771e6a1ccbff8f0f1bd494bd819`
  with exact OCI revision and now runs as the sole healthy loopback3000 app, restart0.
- Order319 remains stopped/restart0 for rollback; environment arrays match by secret-safe
  digest. Temporary build source was removed.
- Prefill3, protected login,2 properties,24/24 routes200/no-store and both approved copy
  surfaces pass. PostgreSQL/provider/Valkey remain healthy0; obsolete ports are closed.
- Read-only database truth remains59/110+2/100/2 and8/0/8/75/22. Fresh non-operating
  Tier3 approval remains mandatory.
