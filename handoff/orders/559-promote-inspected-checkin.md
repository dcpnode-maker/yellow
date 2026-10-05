# Order 559 — promote inspected check-in safely

## Objective

Promote the exact independently accepted Order558 backend and Yellow frontend into
the single public Yellow application, advancing its existing PostgreSQL database
from migrations91 through96 without reseeding, replacing data or recreating the
database, Valkey or Cloudflare tunnel.

## Scope

- Accepted Order558 bytes bound in
  `handoff/reviews/558-continuous-inspected-arrival-checkin.md`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/migrations/0092_governed_party_profile_update.sql`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/migrations/0093_governed_synthetic_clean_arrival_reconciliation.sql`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/migrations/0094_governed_synthetic_clean_arrival_account_reconciliation.sql`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/migrations/0095_rate_policy_runtime_read.sql`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/migrations/0096_governed_checkin_room_condition_lock.sql`
- `D:/Yellow/runtime/yellow-public-demo.env` (read-only deployment input)
- `D:/Yellow/runtime/yellow-public-demo.compose.yml` (read-only deployment input)
- Docker Compose project `yellow-public-demo`: one controlled migration job and
  app-service replacement only
- One private, timestamped `pg_dump` checkpoint beneath `D:/Yellow/recovery/`;
  copy to `G:/My Drive/Yellow/` only if that existing Drive mount is available
- `handoff/reviews/559-promote-inspected-checkin.md`
- `handoff/LEDGER.md`
- `handoff/FOUNDER-JOURNEY-CAPABILITY-LEDGER.md`

## Required behaviour

1. Independently recheck the Order558 hashes and the public preflight before any
   mutation. Prove the public target is healthy at migration frontier91 and that its
   current schema ledger exactly matches source migrations1–91.
2. Create a private consistent PostgreSQL custom-format backup, hash it, prove its
   archive catalogue is readable and retain it outside the container. Never print a
   credential. Google Drive is an additional destination only when the existing
   `G:` mount is actually present; its absence must not make the local backup false.
3. Stop only the public app for the bounded maintenance window. Keep PostgreSQL,
   Valkey and the existing tunnel identities. Do not run a seed or reconciliation
   command.
4. Run the normal migration authority exactly once. Apply only pending migrations
   92–96 and prove count/max96 plus exact file checksums, capability owner/ACL/search
   path, runtime direct-DML denial and the retained current property/data counts.
5. Build from the accepted source. Before replacement, prove the runtime `src/`
   delta from the currently published image is only the accepted check-in service;
   the Yellow asset delta is the accepted frontend build. Recreate only the app
   service and require healthy startup.
6. Verify loopback and public health, exact JS/CSS asset identity, automatic public
   session, one read-only named arrival readiness showing the inspected-room rule,
   375px containment and the procedural image-free neon field. Do not submit an
   operational action during postflight.
7. An independent non-implementing reviewer must personally execute or observe the
   migration/security/data-preservation/postflight proof and record the verdict.

## Rollback boundary

- Before migration failure: leave the current app/database untouched.
- Migration failure: keep the app stopped, retain logs and backup, and restore only
  through a separately authorized destructive recovery order; never improvise a
  partial down-migration.
- App-build/replacement failure after successful migration: run the previously
  published app image against the backward-compatible expanded schema and retain
  the backup. Do not restore or reseed data merely to roll back application bytes.

## Exclusions

- No seed, fixture reconciliation, guest/reservation/room/task/folio/finance write,
  check-in submission, provider action, credential change, tunnel replacement,
  database-volume recreation or PostgreSQL major-version upgrade.
- No claim that Order559 completes PMS01 or the whole PMS.

## Verification

- Independent preflight and exact accepted hash binding.
- Backup digest plus readable `pg_restore --list` catalogue.
- Exact migrations91→96 ledger transition and retained data fingerprints.
- Independent migration/helper security proof and 11/11 referee on a restored or
  equivalent reviewer-owned copy, not on the live public data.
- Healthy single public app plus desktop/375px read-only browser postflight.
