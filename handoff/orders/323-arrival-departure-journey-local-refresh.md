# Order 323 — Arrival/departure journey local refresh

**Status:** READY-D897
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

- [ ] Exact approved image built and sole app refreshed.
- [ ] Live acceptance and preservation proof pass.
- [ ] Order321 remains stopped for rollback.
- [ ] Fresh non-operating Tier3 reviewer approves.
