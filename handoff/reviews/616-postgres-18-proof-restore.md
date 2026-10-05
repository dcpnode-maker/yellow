# Review 616 — PostgreSQL 18 proof restore

Date: 2026-09-23 10:08:32 +05:30
Reviewer: Codex root, scripted proof execution

## Commands

``powershell
powershell -ExecutionPolicy Bypass -File .\tools\postgres18-public-demo-migration.ps1 -DumpPath 'D:\Yellow\backups\yellow-full-app-20260923-095641\database\yellow_public_demo.dump' -ResetProof
``

## Result

- PostgreSQL 18.6 proof container restored the public-demo dump successfully.
- Live PostgreSQL 16 container was not modified during the proof restore.
- Core table counts in proof:
  - tenant: 1
  - reservation: 654
  - reservation_segment: 654
  - folio: 11
  - posting_line: 4
  - journal: 2
  - space_occupancy: 232
  - outbox: 1005
- Safety checks:
  - rls_disabled_tenant_tables: 0
  - public_views_without_security_invoker: 0
  - invalid_indexes: 0
  - invalid_constraints: 0

## Finding

Proof restore is accepted. Live cutover remains intentionally disabled in the script and requires a separate reviewed command/order. On 2026-09-23 the founder explicitly approved upgrading the Yellow default to PostgreSQL 18; the repository default Compose service now uses PostgreSQL 18 with a separate PG18 volume path/name so an existing PostgreSQL 16 data directory is not reused by PostgreSQL 18.
