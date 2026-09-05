# Order 243 — Promote current status through Order 240 to the sole local app

**Status:** APPROVED-LOCALLY-D636
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/promote-current-status-order240-local`
**Base:** `a1ec0d1` (built Order242 plus independently approved Order241 recovery)
**Risk tier:** 2 — reversible loopback-only app replacement
**Owner:** Codex operations; independent non-operating verification

## Outcome

Replace only the existing app container on loopback port 3000 with the exact committed
Order242 descendant so the founder can use the recovered one-click sign-in and see
recorded Project Status through built Order240/current Order242. Preserve the sole
PostgreSQL/Valkey containers, persistent volume, two-hotel data, protected credentials,
permissions, schema and ports.

## Scope

- sole Compose project `yellow-order175-folio-responsive-containment`;
- app-only image build and replacement from exact committed branch HEAD;
- unchanged ignored runtime-authority and protected founder-login files;
- this order, one decision, ledger evidence and independent operational review.

No product-source, test, dependency, schema, migration, seed, database, credential,
permission, role, hotel/booking/financial data, PostgreSQL/Valkey container, volume,
second local, public bind, merge or production deployment change is admitted.

## Required behavior and proof

1. Before replacement, record exact running project/container identities, image id,
   loopback ports and read-only counts for all 93 base tables.
2. Build from exact clean committed HEAD and replace only the app service. Retain the
   previous image id for rollback and do not recreate PostgreSQL or Valkey.
3. Prove app health/root HTTP 200, no-store masked populated sign-in, protected
   operator login HTTP 200, exactly two properties, and authenticated status truth
   date `2026-08-28`, latest built 240, current 242, review 91 and currently advancing
   Phase7 with unfinished Phases5–6 still active.
4. Prove all 93 table counts and PostgreSQL/Valkey container ids are unchanged; port
   3000 is open and 3002/3188 remain closed.
5. A non-operating reviewer repeats the served/status/topology/data checks without
   exposing passwords, tokens, auth hashes or runtime secrets.

## Definition of done

- [x] Exact committed status descendant is served on the sole loopback port 3000.
- [x] Protected one-click sign-in and two-property reads succeed.
- [x] Database, cache, schema, data, credentials and ports remain unchanged.
- [x] Previous app image remains available for rollback.
- [x] Independent operational verification is recorded.

## Built and review evidence

Operator evidence records an app-only replacement from clean committed head
`e315b55`, with the previous image retained as
`yellow-order243-rollback:pre-status240`. PostgreSQL and Valkey retained container-id
prefixes `89879fcaaff4` and `14e5534bc688`; port3000 remained the sole founder app
listener and ports3002/3188 stayed closed.

Fresh independent non-operating review in
`handoff/reviews/243-promote-current-status-order240-local.md` reproduced health/root
HTTP200, no-store masked protected prefill, operator login HTTP200, exactly two
properties and both exact date2026-08-28/latest240/current242/review91/active7 status
snapshots with Phases5–7 active and live app/database operational. The served status
source is byte-exact to clean HEAD, all 93 public table counts match the owner-only
pre-change backup with zero differences, required container identities are exact and
the rollback tag exists. One corrected top-level `accessToken` verifier lookup was a
proof-helper correction only, not a product failure. D-636 approves this local-only
promotion without source, schema, data, credential, authority, public, merge,
production, Phase or application-completion authority.
