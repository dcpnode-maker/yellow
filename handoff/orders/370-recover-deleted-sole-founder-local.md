# Order 370 — Recover the unexpectedly deleted sole founder local

**Status:** APPROVED-LOCALLY-D1042
**Phase:** 7 — operational recovery only
**Branch:** `phase-7/governed-owner-trust-negative-authorization`
**Base:** `5b9b9dd`
**Risk tier:** 3 — verified database restore and sole-local recreation
**Owner:** Codex operations; fresh non-operating Tier-3 verification mandatory

## Incident and outcome

Docker inspection found the previously approved `yellow-order335-app` and all
`yellow-order311-*` companions, network and retained database volume absent rather
than stopped. Recover exactly one loopback-only founder local from the independently
approved Order274 two-hotel backup and the approved Order335 runtime source. Preserve
the protected existing login and runtime authority without printing or rotating
secrets.

## Exact scope

- verify that the old stable resources are absent and record the incident boundary;
- recompute the Order274 backup hash and verify its readable catalogue;
- create only `yellow_order311_local`, `yellow_order311_clean_pgdata`, the approved
  PostgreSQL, Valkey and provider companions, and one `yellow-order335-app`;
- restore the verified dump, apply committed migrations 47–59 using the approved
  production runner, and prove a zero-apply rerun;
- build the app/provider only from exact approved Order335 runtime source `1551617` if
  their approved images are no longer present;
- expose only app `127.0.0.1:3000`, provider `127.0.0.1:3001` and Valkey
  `127.0.0.1:6389`; PostgreSQL remains host-unbound;
- prove health, protected button-only login, two properties, approved status and the
  existing bounded management journeys without business mutation;
- record exact image/container/network/volume/database evidence and obtain a fresh
  independent non-operating Tier-3 review.

## Forbidden

No second local, public bind, seed or synthetic overwrite, credential disclosure or
rotation, migration/history edit, data cleanup, post-59 migration, Phase/product
completion claim, broad Docker prune, merge, push or deployment.

## Rollback

Before exposure, any failure removes only the exact newly created Order370 resources
and leaves the verified backup untouched. After exposure, database restoration requires
closing this sole local and replaying the verified dump into a replacement exact volume.

## Required proof

1. Backup SHA-256 equals
   `fe535af1da59b1aa95d11900dbddedf0c355f7b8407df1ec344597297dfca99c`
   and its PostgreSQL catalogue is readable.
2. Exactly one stable stack reaches migration59, 110 base tables plus 2 views, 100
   policies, two properties and clean `party/contact/party_role/fact/outbox`
   cardinalities `8/0/8/75/22`.
3. A second production-runner pass applies zero migrations.
4. Sole loopback3000, protected login, two properties and existing approved journeys
   pass; obsolete app ports remain closed.
5. A fresh non-operating Tier-3 reviewer records approval or findings.

## Definition of done

- [x] Verified two-hotel database restored and migrated through59 once.
- [x] Exactly one healthy founder local is available on loopback3000.
- [x] Protected authentication and bounded management journeys pass.
- [x] Fresh independent non-operating review is recorded.

## Builder evidence — D1040

- Exact approved backup independently rehashed to
  `fe535af1da59b1aa95d11900dbddedf0c355f7b8407df1ec344597297dfca99c`
  before restore. The prior stable containers, network and volume were absent.
- Docker's private network pool was exhausted. An end-to-end same-shell guard removed
  only explicitly prefixed proof networks with exactly zero attached containers; no
  volume, image, active network or broad prune was used. Docker Desktop retained
  phantom loopback binds from the deleted stack; recovered PostgreSQL and Valkey were
  cleanly stopped, the backend was restarted, and the named volume remained intact.
- A fresh exact `yellow_order311_clean_pgdata` restored the verified dump, then the
  production runner from approved Order335 source applied only migrations47–59. Its
  immediate second pass reported `applied=0 status=no-op transaction_pids=none`.
- Read-only catalogue truth is exact:59 migrations,110 public base tables,2 views,
  100 policies,2 property org nodes and clean `party/contact_point/party_role/fact_log/
  outbox` counts `8/0/8/75/22`.
- Exact approved source `15516170433b008411bb07e13c8001f823f8e16d` rebuilt one
  runtime image. App,provider,PostgreSQL and Valkey are running healthy/restart0 on
  the exact named network; PostgreSQL is host-unbound and app/provider/Valkey bind
  only loopback3000/3001/6389.
- Protected in-memory login returned200 without printing a credential or token,
  enumerated exactly2 properties, and both status probes returned operational app,
  operational database and tenant context true. Existing12 routes per property were
  24/24 HTTP200. The recorded approved runtime snapshot remains310/311/91/P7; this
  recovery intentionally does not claim later product/status promotion.

## Fresh independent non-operating Tier-3 review — D1042

- Fresh reviewer `/root/order370_fresh_nonoperating_tier3` personally rehashed the
  exact restricted dump, reproduced its readable1,324-line PostgreSQL catalogue,
  verified owner+SYSTEM-only inherited ACLs and approved the exact candidate
  `4dd2368d0dedd4f8df7a1b59b6245437f637b341` with no finding.
- Reviewer-executed read-only database proof passes exact59/110 base+2 views/100/2
  plus8/0/8/75/22, zero other open transactions and exact role/membership/ownership/
  direct-ACL containment.
- Exactly four intended containers are running healthy/restart0 on the one named
  network and volume. Exact approved-source app/provider plus pinned PostgreSQL and
  Valkey expose only loopback3000/3001/6389; PostgreSQL is host-unbound and obsolete
  app ports3002/3123/3188 are closed.
- Protected in-memory login, exactly2 authorized properties, both exact
  310/311/91/P7/13 operational status responses and24/24 no-store pages pass without
  exposing credentials or tokens. The final database snapshot and container health
  remain byte/count exact. Approval is recovery-local only and grants no later
  product, migration, Phase, merge, push or deployment authority.
