# Order 191 — Approved status refresh local promotion

**Status:** READY — D-502
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

- [ ] Exact approved Order190 app is the sole healthy loopback3000 app; no3002.
- [ ] Protected Project Status reports exact Order190 truth.
- [ ] Persistent credentials, schema, data and Order189 immutable UAT are unchanged.
- [ ] Exact Order189 rollback image remains retained.
- [ ] Independent non-operating review approves the local promotion.

## Forbidden

- Exposing or changing any credential or secret.
- Starting a second local app or binding publicly.
- Mutating PostgreSQL, Valkey, schema, permissions, seeds or financial history.
- Claiming merge, push, production deployment or Phase 5 completion.
