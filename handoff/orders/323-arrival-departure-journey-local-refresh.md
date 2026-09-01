# Order 323 — Arrival/departure journey local refresh

**Status:** REMEDIATED-PENDING-FRESH-TIER3-REREVIEW-D900
**Phase:** 7 — founder-visible presentation of already-built stay journeys
**Branch:** `phase-7/arrival-departure-journey-local-refresh`
**Base:** `e2d2a36` (independently approved Order322 governance head)
**Runtime source:** `9bc9ad2e3463e8588d16b2c382cf15a589272628`
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

## First fresh review — D899

The fresh reviewer withheld because Chrome cleared the email/password after the
credential-free helper's initial restoration window, leaving the founder without the
required one-button sign-in. Runtime credentials themselves authenticate and were not
exposed; every other runtime, database, route, status, journey, responsive and
accessibility check passed. Remediation is limited to strengthening the local-only,
no-store, closure-held restoration helper without changing credentials or the normal
credential-free document. Intentional red and fresh Tier3 rereview are mandatory.

## Remediation evidence — D900

- Intentional red was7 pass/1 fail/53 assertions and reproduced late browser clearing
  after the original timeout/two-frame window.
- The credential-free helper now restores only empty fields on later focus, pageshow
  and visible visibilitychange; non-empty founder input is preserved. It still uses
  no browser storage, cookie, embedded credential or cacheable response.
- Focused proof is15 pass/0 fail/184 assertions. Standing proof is1140 pass/890
  expected database skips/0 fail/17364 assertions across2030 tests/370 files;
  typecheck, boundaries127, licences23, audit0 and diff hygiene pass.
- Remediated runtime9bc9ad2 built image
  `sha256:093fd44fb33cf1d8f4d4d4c0b0d7f77ae62df832549899968885e276ba999c93`
  and is sole healthy loopback3000/restart0. The rejected D899 container and approved
  Order321 rollback are retained stopped; environment and database authority are
  unchanged. Live root contains the protected prefill payload and late-restoration
  helper. Fresh Tier3 rereview remains mandatory.

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
