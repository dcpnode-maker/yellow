# Order 089 — Strict HTTP calendar instants

**Phase:** 4 · Reservations correctness correction  
**Branch:** `phase-4/strict-http-calendar-instants`  
**Tier:** 2 — shared operator-adapter validation, no domain authority change  
**Written by:** OpenAI Codex, autonomous architect/builder under D-95/D-115/D-221

## Outcome

Reject impossible calendar dates and clock times at the operator HTTP boundary instead of letting
JavaScript silently normalize them into a different instant. The shared parser must keep accepting
the valid offset-aware formats already supported, while every operator surface that uses it fails
with the existing `400 request/invalid` response before a service or database call.

This is a correction to the shared adapter used by Orders 082 and 084 and inherited inventory/rate
routes. It does not change a reservation, rate, occupancy, policy, authorization or persistence
contract. Orders 087 and 088 remain untouched and keep their existing gates.

## Natural-Solution Test

- Parse the calendar components, offset and optional fractional seconds once, then compare those
  exact local components with the represented instant. A finite `Date` alone is insufficient:
  Bun/JavaScript normalizes values such as February 30 and `24:00`.
- Keep one shared strict instant parser for legacy/canonical availability, holds, direct commit,
  offline leases, operational blocks and rate quotes. Do not add endpoint-specific fixes.
- Validate local `YYYY-MM-DD` horizons with the same calendar discipline so a non-leap February 29
  cannot reach PostgreSQL and become an unrelated service error.
- Preserve accepted syntax: seconds may be omitted; fractional seconds remain one to three digits;
  `Z` and exact offsets through `±14:00` remain valid; leap days remain valid in leap years.

## Scope

- `handoff/orders/089-strict-http-calendar-instants.md`
- `src/http/operator.ts`
- `src/project-status.ts` (Question 133 scope correction)
- `tests/operator-calendar-validation.test.ts`
- `tests/founder-status.integration.test.ts` (Question 133 scope correction)
- `handoff/GATE-3-MANIFEST.md` only after all proofs are green
- `handoff/LEDGER.md` only after all proofs are green
- `DECISIONS.log` only after all proofs are green

## Required work

1. Commit this order and the intentional red proof before production code.
2. Replace shape-plus-`Date` instant acceptance with exact calendar validation. Reject impossible
   month/day combinations, hour 24, leap seconds, invalid offset components and offsets beyond
   `±14:00`; do not silently canonicalize a different local time.
3. Route operational-block parsing through the same instant parser instead of its duplicate regex
   check. Add one strict local-date parser and use it for projection rebuild horizons.
4. Prove impossible values return the existing 400 problem response across canonical and legacy
   availability, direct reservation commit, cart hold, offline lease, operational block, rate quote
   and projection-horizon entry points before optional services or database work.
5. Prove supported edge formats remain accepted by the adapter, including a real leap day,
   omitted seconds, one-to-three fractional digits, `Z`, and `±14:00`.
6. Run frozen install, typecheck, import boundaries, the complete default suite, the focused pure
   proof and the inherited Order-082/084 database proofs. Then run the isolated Phase-3 gate,
   schema drift, protected hashes and a fresh app-never-started `./setup.sh --db-only` at 11/11.
7. Record the result as UNVERIFIED Gate-3 review debt, refresh the disposable Graphify code map,
   push a stacked draft PR based on Order 086, and do not merge.
8. After recording that debt, prove the founder snapshot reports Order 089 and 43 UNVERIFIED rows.
   Question 133 requires the complete self-check to restart after this correction.

## Forbidden

- Any edit under `migrations/`, `tests/run_invariants.py`, schema snapshots, package/lock files,
  Compose, Dockerfile, CI, seeds, RLS, tenant context, grants or authentication/token behavior
- Any new dependency, table, column, function, state, transition, event, permission, route, cache,
  worker, persistence path, domain command or browser feature
- Any change to availability, rate, reservation, hold, lease, operational-block or occupancy
  semantics after a request has passed adapter validation
- Relaxing accepted input into timezone-less timestamps, accepting silent date rollover, weakening
  existing hostile-input assertions, merging, approval or claiming independent review

## Pre-registered proof

### P0 — impossible calendar input is red

Before production code, call the public operator adapter directly with impossible instants and a
non-leap local date. The focused run must fail because those values currently pass parsing and fall
through to a 503/service path rather than returning 400. No database is required.

### P1 — exact instant rejection across every shared consumer

February 30, April 31, `24:00`, second 60, offset minute 60 and `±14:01` return 400 for the
availability, hold, direct-commit, offline-lease, operational-block and rate-quote shapes. No
dependency spy or transaction is invoked.

### P2 — valid boundary formats remain compatible

February 29 in a leap year, omitted seconds, `.1`/`.12`/`.123`, `Z`, `+14:00` and `-14:00` pass
adapter parsing and reach the intentionally unavailable fake service rather than returning 400.

### P3 — strict local dates

Projection horizons reject non-leap February 29 and April 31 with 400 while accepting real leap
days and valid month ends.

### P4 — inherited behavior and standing gate

Order-082 commit and Order-084 offer HTTP/database proofs remain exact. Default tests, typecheck,
boundaries, isolated gate, schema drift, protected hashes and fresh referee stay green.

### P5 — honest founder status after manifest mutation

The database-enabled founder-status proof derives the latest built order and debt count from the
committed manifest and matches the exact Order-089 snapshot. Actions run `32626477045` is the
pre-correction red proof: expected 89, received 86.

## Definition of done

## Builder evidence — UNVERIFIED

- [x] P0 is committed red before production code.
- [x] P1–P3 pass without reaching a dependency for invalid input.
- [x] P4–P5 and both protected hashes remain exact after the Question-133 correction.
- [x] Gate-3 debt is recorded; no review or merge is claimed.

Evidence captured at final production commit `f4ecae9` (calendar correction `04a0e3f`):

- Intentional red commit `4d13bfa`: 1 pass, 3 fail, 10 assertions. Impossible
  instants reached the unavailable-service path and returned 503 instead of 400.
- Corrected focused proof: 4 pass, 0 fail, 16 assertions. TypeScript and all 56
  import-boundary files pass; the default environment-independent suite is 106 pass,
  326 database-gated skips, 0 fail and 1,392 assertions.
- Fresh disposable PostgreSQL proofs: inherited Order 082 is 5/5 with 61 assertions,
  inherited Order 084 is 6/6 with 76 assertions, and the isolated Phase-3 gate is
  13/13 suites. Schema, licence and dependency audit checks are green.
- `yellow-order-089` was a fresh app-never-started Compose project; the referee is
  11 passed, 0 failed of 11.
- Actions run `32626477045` provided the P5 red proof: the committed manifest expected
  Order 089 while the status snapshot still returned 86. Question 133 added only the
  snapshot and its existing exact test; the restarted isolated gate passed 13/13,
  including founder status 4/4 with 61 assertions. The first inherited-offer attempt
  could not start without the canonical launch seed, so the pinned seed was installed
  and the complete self-check restarted from the top under D-88.
- Protected SHA-256 values remain exact:
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923` and
  `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`.
- Disposable Graphify map: 5,514 nodes, 9,494 directed edges and 643 communities at
  `f4ecae9`, with zero missing/dangling endpoints, duplicates or collapsed directed
  pairs. Ten inherited self-loops remain visible; community-label refresh is deferred.
