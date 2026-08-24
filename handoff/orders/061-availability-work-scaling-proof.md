# Order 061 — Availability work-scaling proof

**Phase:** 2 · Inventory and occupancy completion
**Branch:** `phase-2/availability-scaling-proof`
**Tier:** 2 — executable performance-proof hardening; no product behavior change
**Written by:** OpenAI Codex, autonomous temporary architect under D-95/D-115/D-221

## Outcome

Close Question 041 with an executable, hardware-tolerant proof that authoritative
availability work remains sub-quadratic as the canonical physical inventory fixture grows
from 250 to 500 one-space sellable units. Retain Order 031's unchanged 1,000 ms ceiling as a
catastrophic-regression guard, but stop treating a wall-clock pass as the performance
guarantee. Measure work actually performed by PostgreSQL through its already-preloaded
`pg_stat_statements` extension; do not assert a planner, scan, or index choice.

This order changes proof coverage only. It neither changes availability semantics nor
introduces a cache. The Phase-2 Valkey/NATS decision gate, offline leases, overbooking and
reservations remain separate.

## Scope

- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/GATE-3-MANIFEST.md`
- `handoff/orders/061-availability-work-scaling-proof.md`
- `tests/availability.integration.test.ts`
- `tests/availability-scaling.integration.test.ts`

Diagnostic-only temporary mutation, forbidden from the final diff and commit:

- `src/contexts/inventory/availability.ts` — remove only the D-141 materialization boundary
  long enough to prove the new structural assertion goes red, then restore the file
  byte-identical before any green run.

If an implemented proof fails unexpectedly, add only the next numbered question and
temporary-architect response plus append-only decision/ledger entries, then recreate and
restart under D-92.

## Required behavior

1. Add a dedicated database proof that creates its own isolated tenant/property/unit type and
   exact 250-space then 500-space one-to-one sellable fixtures. It must use the production
   `AvailabilityService.search()` through `Database.withTenantTransaction`, not copied SQL.
2. In the disposable proof database only, create `pg_stat_statements` if absent, reset its
   statistics immediately before each measured search, and select exactly the normalized
   production availability statement. Require exactly one measured call at each cardinality.
3. Define logical work as the sum of shared/local block hits and reads plus temporary block
   reads/writes reported for that one statement. Assert 500-space work is less than three times
   250-space work and is below 10,000 logical block operations. These deliberately generous
   bounds catch D-141's approximately 1.09-million-buffer quadratic regression without naming
   or coercing a plan.
4. Assert returned performance options are exactly 250 and 500 respectively, with one row per
   configured sellable. Statistics rows are output cardinality evidence only and must not be
   described as rows examined.
5. Rename Order 031 P8 so its test title explicitly calls the unchanged `< 1,000 ms` maximum a
   `catastrophic-regression guard`. Keep its 500-space fixture, twenty executions, exact option
   count and numeric ceiling unchanged.
6. The scaling proof must fail closed when the target statement is absent, ambiguous, has a
   call count other than one, or reports a negative/non-finite counter. It must print both
   cardinalities, logical-work totals, their ratio, and the unchanged wall-clock result.

## Forbidden

- Any persistent production-code change, migration, schema snapshot, `tests/run_invariants.py`,
  dependency, Compose image/command, RLS, tenant middleware, occupancy, holds, restriction,
  OOO/OOS, projection/cache, HTTP/UI, event, audit, or outbox change.
- `EXPLAIN` plan-node, scan-type, index-name or planner-setting assertions; forcing planner
  choices; warming until green; raising or removing the 1,000 ms ceiling; treating
  `pg_stat_statements.rows` as rows examined.
- Running the proof against the founder-review database, leaving the extension/fixtures in a
  persistent stack, committing the intentional negative mutation, self-approval, or merge.

## Pre-registered proofs

- **P0:** on a fresh disposable 0001–0005 database, add the complete new scaling proof before
  changing Order 031's title. The focused run must be red because the required
  `catastrophic-regression guard` label is absent; preserve that exact failure.
- **P1:** on a recreated disposable database, the production query returns exactly 250 then 500
  performance options and `pg_stat_statements` reports exactly one matching call after each
  reset.
- **P2:** 500-space logical work is `< 3.0 ×` the 250-space value and `< 10,000` absolute, with
  all counter inputs finite and non-negative. The output prints both totals and ratio.
- **P3:** temporarily remove only the D-141 sellable-mapping materialization boundary, rerun P2
  on another recreated disposable database, and preserve the red output showing the structural
  guard rejects the regression. Restore `src/contexts/inventory/availability.ts` to its exact
  pre-probe SHA-256 before continuing.
- **P4:** the unchanged Order 031 file passes all seven proofs; P8 still executes twenty searches,
  returns exactly 500 performance options and enforces `max_ms < 1000` under the newly honest
  catastrophic-guard title.
- **P5:** frozen install, typecheck, boundaries, default suite, licence policy, audit, schema
  drift, fresh isolated referee 11/11, live health/login, protected hashes and clean final scope
  remain green.

## Standing checks and handoff

Run P0, P1/P2, the intentional P3 red, then recreate and restart P1/P2/P4 from the top.
Run the standing self-check from the frozen lockfile. Stop the persistent app only for the
isolated referee per D-191, restore it with both workers enabled, refresh Graphify as an ignored
derived map, append an UNVERIFIED manifest row, commit `[codex]`, push and open a draft stacked
PR against Order 060. Do not approve or merge. Independent Gate-3 review must execute the
focused proof itself and inspect that the intentional negative mutation was absent from the
commit.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
