# Order 250 — sole-local Orders248–249 promotion verification

**Conclusion:** PASS — local-only operational verification

**Promoted source:** `1f13e8b` (exact descendant of built Order249 `d15424f`)

**Verifier:** independent non-operating Codex worker

## Scope

The verifier did not build, restart, migrate, seed, edit, back up, change credentials,
mutate data or alter containers. It repeated read-only Docker, PostgreSQL catalogue,
loopback HTTP, authenticated status, protected-file ACL/hash and source-hash checks.
Protected values and the short-lived access token remained in process memory.

## Backup and exact database lineage

The restricted custom-format backup is
`D:\Yellow\backups\yellow-pre-order250-20260828T192814Z.dump`, 659,190 bytes,
SHA-256 `049c31e3839b704643797a324a860d1d3f0b5b1afe1604af7c003abd010095e6`.
Its restore catalogue has 1,245 lines and both files grant access only to the current
owner and SYSTEM.

Migration0040 is recorded with exact committed SHA-256
`b61d1332acf17df9189612d355fb584754bdd7ddda9782e377bf73be44cc589b`.
The database is migration40/95 tables/85 policies/two properties, with zero binding
and attribution rows. Normalizing only the new empty binding and ledger40 back to the
preflight shape reproduces the exact independent 94-table baseline digest
`5887325c056a4740281e2335d6df6e16b7dd4536cfdf4b1d41317b0f60be073e`.
Binding RLS, tenant policy and read-only app authority are exact. Live schema matches
the committed snapshot.

## Sole app and founder access

Exactly one healthy app listens on loopback3000; ports3002/3188 are closed. PostgreSQL
id prefix `89879fcaaff4`, Valkey id prefix `14e5534bc688` and volume
`yellow-order175-folio-responsive-containment_yellow-pgdata` are retained. Root and
health return HTTP200/no-store; the protected sign-in is populated and password
masked; protected login and exactly two property reads return HTTP200/no-store.

Both statuses are exact date2026-08-29/latest248/current249/review91/active7. Served
`src/project-status.ts` SHA-256
`f5f8d8a7c21618362da6c7121c2b7a725728f713ed6e50722983045f8be8e8de`
matches clean current HEAD source. Rollback image
`yellow-order250-rollback:pre-order248-249` retains the prior app image.

## Boundary

This approves the local promotion only. It does not approve product code, raise review
coverage above91, merge, expose publicly, deploy to production or claim any Phase or
application complete.
