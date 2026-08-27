# Order 191 — Approved status refresh local promotion

**Status:** BUILT-UNREVIEWED — D-503
**Phase:** 5 · founder human testing
**Branch:** `phase-5/folio-charge-correction-resumed`
**Base:** `ce3fc95709cfeccde4bb0070ae20ba38273f6ec8`
**Risk tier:** 2 — reversible app-only local replacement
**Owner:** Codex operations; independent non-operating post-promotion reviewer

## Outcome

Promote the exact independently approved Order190 executable to the sole founder app
at `http://127.0.0.1:3000` so Project Status reports latest-built189/current190 while
preserving the persistent database, credentials, approved Order189 financial UAT and
single-local topology.

## Scope

- build and label one exact Order190 application image from the approved governance
  head, retaining exact Order189 as rollback;
- replace only `yellow-local-current-app-1` on loopback port 3000 using its existing
  in-memory runtime configuration;
- prove image/source identity, sole-app topology, port3002 unbound, health/assets and
  protected authenticated Project Status truth;
- prove representative protected reservation/folio reads and the four approved
  Order189 financial UAT journals remain byte-for-byte present and balanced;
- this order, D-502, ledger and independent non-operating review.

No database backup or mutation is required because this order has no schema, seed,
permission or data change. No credential readout/reset, second app, public bind,
migration, scenario import, financial command, merge, push or production deployment.

## Required operation and proof

1. Preflight exact approved SHA, clean worktree, healthy sole loopback3000 app,
   healthy persistent PostgreSQL/Valkey, unbound3002 and exact retained Order189 image.
2. Build the candidate while the approved app remains live; record its digest and
   source/order labels without exposing environment or credentials.
3. Preserve the old image as an explicit rollback tag, then recreate only the app
   with the existing configuration and networks. On failure restore the old app.
4. Prove health, served source identity, exact five appearances and protected status
   fields: recordedAt2026-08-27, latest-built189, current190, review-through91,
   Order187 absent and Phase5 active.
5. Prove existing protected property, reservation and folio reads plus Order189's
   immutable balanced UAT evidence; no persistent row count may change.
6. A non-operating reviewer independently reproduces topology, identity, status and
   no-data-drift proof before approval.

## Definition of done

- [x] Exact approved Order190 app is the sole healthy loopback3000 app; no3002.
- [x] Protected Project Status reports exact Order190 truth.
- [x] Persistent credentials, schema, data and Order189 immutable UAT are unchanged.
- [x] Exact Order189 rollback image remains retained.
- [ ] Independent non-operating review approves the local promotion.

## Operator evidence — D-503

- Preflight found exact healthy Order189 image
  `sha256:5a50503e89c44d11bd313359ca74b40ff427354790b6b2a7c0b746120777906b`
  (`yellow.git=0096ac4eff2944af68b033700cf5ef227f6ce971`,
  `yellow.order=188`) as the sole app on `127.0.0.1:3000`, with port 3002
  unbound. Persistent PostgreSQL and Valkey container identities were captured before
  the operation.
- Exact approved Order190 source was built while Order189 remained live. Candidate
  image `sha256:d7a7fdcd1da27346542367635ad0ed8cecb19c60bdeffc49e24c01fe489cf4d3`
  carries `yellow.git=ce3fc95709cfeccde4bb0070ae20ba38273f6ec8` and
  `yellow.order=190`. The prior exact image remains tagged
  `yellow-order189-rollback:5a50503e89`.
- Only `yellow-local-current-app-1` was recreated, using the existing process-only
  runtime configuration and `yellow-local-current_default` network. PostgreSQL and
  Valkey container IDs are unchanged. The candidate is healthy, is the only running
  app service, binds only `127.0.0.1:3000`, and port 3002 remains unbound.
- Root, health, CSS and JavaScript return successfully. Served CSS SHA-256
  `ee99b2d9b46dd3f58b45383f164e45949f4b165bc699e282bfe5f3f25c2e0e72`
  and JavaScript SHA-256
  `0a1d9c510eba4f26703adbf98f7e0373c77fbb717b157237904034731e5c27fe`
  are byte-identical to the approved source, and all five appearance markers are
  present.
- Protected login returned all three granted properties. Authenticated Project Status
  is exact: recorded date `2026-08-27`, latest built Order189, current Order190,
  independent review through91, Order187 absent and Phase5 active. Representative
  reservation and `FOL-1` statement reads both succeed.
- Exact public-table row counts remain 48,604 rows across 85 tables, with unchanged
  fingerprint
  `753e12bdb05db990f6940c2e7b88a4369cb588d4c3d6358e490574c86e68cac2`.
  The eight posting rows for the four Order189 UAT journals retain fingerprint
  `cc5e3a56f0dc6bdbd86158f4de08f8af0c4c7e01aa43bfa38eb8f8f2232153fe`;
  every named journal still sums to zero and migration rows remain exactly20.
- Two initial read-only fingerprint projections referenced outdated column names and
  failed before returning rows. The corrected read-only projections produced the
  recorded pre/post-identical evidence; no database command in this operation wrote
  schema, permissions, seeds, credentials or data.

## Forbidden

- Exposing or changing any credential or secret.
- Starting a second local app or binding publicly.
- Mutating PostgreSQL, Valkey, schema, permissions, seeds or financial history.
- Claiming merge, push, production deployment or Phase 5 completion.
