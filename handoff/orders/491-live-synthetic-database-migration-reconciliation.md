# Order 491 — Live synthetic database migration reconciliation

## Objective

Bring the one isolated public Yellow synthetic-demo database from its observed
migration ledger version 91 to the reviewed source ledger through 95 using the normal
migration runner, with a reversible target backup and independent target-bound proof.

## Scope

- the existing `yellow-public-demo` Docker Compose runtime and its synthetic database
- current source migrations `0092` through `0095` only
- read-only preflight/postflight evidence and a dated backup stored outside the
  container volume
- `handoff/reviews/491-live-synthetic-database-migration-reconciliation.md`

## Required behaviour

- Confirm the target is only the local `yellow_public_demo` synthetic environment,
  has the expected property, and no real guest/contact/payment/provider data before
  action.
- Create and verify a restorable, timestamped database backup before migration.
- Run only `scripts/migrate.ts` through the reviewed normal deployment path. Do not
  use raw DDL or replay seeds/provisioners.
- Verify a contiguous checksum-matching ledger 1–95; normal app health; same synthetic
  property identity; no unexpected financial/guest/contact/payment row changes; and
  runtime `app_role` policy reads/RLS behavior.
- An independent agent that did not execute promotion must personally conduct
  target-bound postflight evidence before the migration is represented as accepted.

## Exclusions

- No commercial configuration provisioning, rate publication, public credential
  exposure, real data import, reset/restore, destructive cleanup, UI redesign, or
  channel/OTA integration.
