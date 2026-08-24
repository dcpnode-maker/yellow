# Question 074 — Order 058 independent review request

**Status:** OPEN — independent architect review required
**Branch:** `phase-2/availability-projection-rebuild`
**Implementation commit:** `af34ebc`
**Order commit:** `7a72dbe`
**Base:** `8495a6f` (`phase-2/operator-bulk-room-creation`)
**Tier:** 3

## Review request

Please independently review Order 058 and execute its Tier-3 proofs. Codex acted as
temporary architect and builder under D-95/D-115; every result below is builder-asserted,
not independent approval. Codex has not approved or merged this branch.

The implementation replaces a bounded tenant/property/date slice of the disposable
`availability_projection` table from PostgreSQL configuration and occupancy truth. It
projects only exact one-space sellable shapes, omits unsafe composite/shared shapes, and
does not make the projection booking authority. Migration 0005 adds only app-role DELETE
on the existing RLS-protected projection table.

## Builder evidence

- P0 on a fresh 0001–0004 database: complete new file failed red with
  `Export named 'AvailabilityProjectionService' not found` (`0 pass / 1 fail`).
- Final P1–P6 on a recreated 0001–0005 database: `6 pass, 0 fail, 45 expect()`.
  Independent DST evidence was exactly 24/23/24 hours across America/New_York spring
  transition; rollback and concurrent rebuild assertions passed.
- Inherited availability, holds, operational blocks and OOS policy sequence:
  `35 pass, 0 fail, 158 expect()`; the 500-space truth search reported 40.87 ms.
- Standing checks restarted from the lockfile: frozen install unchanged, TypeScript green,
  boundaries green across 39 files, default tests `49 pass / 0 fail` (232 database-gated
  skips), dependency licence policy green for 23 packages, `bun audit` found no
  vulnerabilities, and schema drift matched exactly.
- Fresh canonical `./setup.sh --db-only`: `11 passed, 0 failed of 11` after stopping the
  persistent app pool per D-191. The workbench was rebuilt and restored healthy on
  `http://localhost:3200`.
- Protected hashes remained exact:
  - `migrations/0001_init.sql` — `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`
  - `tests/run_invariants.py` — `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`

## Stops and corrections to inspect

Questions 070–073 and D-200–D-203 preserve four complete focused restarts: PostgreSQL
date-series overload, an invented `unit_type.status` predicate, and two independent DST
probe type/label errors. Each was answered in writing before correction; none weakened a
product assertion.

Graphify was refreshed after final source changes with `--update --no-viz --code-only`
and now reports 3,270 nodes / 4,815 edges / 338 communities. Its ignored, disposable map
warned that three SQL files were not extracted because `tree_sitter_sql` is absent; do not
use Graphify as evidence for migration 0005. Review the migration and schema proof directly.

## Deliberately deferred

Outbox-triggered rebuild scheduling, Valkey mirroring, offline leases, overbooking,
reservation commit, operator diagnostics, approval, integration and merge remain outside
Order 058. The current projection is an acceleration model only; truth search remains the
authority for unsupported shapes and every booking decision.
