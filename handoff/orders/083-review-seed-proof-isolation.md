# Order 083 — Review-seed fixture isolation and inherited Gate-3 proof coverage

**Phase:** 4 · hard-floor correction before reservation search  
**Branch:** `phase-4/gate-3-seed-proof-correction`  
**Tier:** 2 — deterministic proof fixtures and CI orchestration; no product-domain behavior  
**Written by:** OpenAI Codex, autonomous temporary architect under D-92/D-95/D-115/D-221  
**Finding:** post-review regression discovered while re-executing Claude Gate-3 F11/F12 corrections

## Outcome

Restore Order 050's exact fresh-database proof after Order 078 deliberately expanded the founder
review seed with one published FLEX rate. The legacy configuration suite must request only the
identity/inventory fixture it actually needs, while the founder CLI and Order-078 proof continue to
receive the complete published-rate review experience. All five inherited suites named by Claude's
F11 review must run in the isolated database gate on every CI database job, so later shared-fixture
changes cannot leave those pre-registered proofs silently red.

This correction changes no hotel configuration, pricing, reservation, occupancy, tenancy, audit,
publication or financial behavior. It makes fixture intent explicit and strengthens execution.

## Natural-Solution Test

- Order 050 proved an initially empty policy/plan surface, then created FLEX through authenticated
  production commands. It calls `runReviewSeed` only to provision the review identity, grants and
  inventory. Order 078 later made that same helper create canonical policies, FLEX and an active
  release for the persistent founder demo; the old proof now starts after the behavior it intends to
  exercise and deterministically returns 409.
- Changing Order 050's expected output to include the demo plan, renaming its FLEX request or
  deleting the empty-state assertion would couple an API command proof to unrelated demo content and
  hide the fixture leak. The natural boundary is an explicit review-seed mode that always provisions
  identity/inventory and optionally composes the published founder rate.
- Four of the five inherited suites are currently green on fresh isolated databases; Order 050 is
  the only red suite. The existing Phase-3 runner already provides one-database-per-suite creation,
  migration, required environment mapping, fail-fast behavior and forced cleanup. Extending that
  exact matrix with the five inherited suites is smaller and stronger than adding a second runner.

## Scope

- `scripts/seed-review.ts`
- `tests/operator-rate-configuration.integration.test.ts`
- `scripts/run-phase-3-gate.ts`
- `tests/phase-3-gate-runner.test.ts`
- `handoff/PHASE-4-PLAN.md`
- `src/project-status.ts` only for exact completed-order and Gate-3 debt counters after green proof
- `tests/founder-status.integration.test.ts` only for the same exact counters
- `handoff/orders/083-review-seed-proof-isolation.md`
- `handoff/GATE-3-MANIFEST.md` only after all proofs are green
- `handoff/LEDGER.md`
- `DECISIONS.log`
- `handoff/questions/` only if a D-92 hard-floor condition occurs

## Required work

1. Add one typed review-seed option that distinguishes `published` founder data from
   `identity_inventory` fixture data. Omitting the option retains the existing founder/CLI behavior:
   canonical policies, FLEX and one active immutable release are still created or exactly verified.
2. In `identity_inventory` mode, preserve the exact two identities, role/grants, unit types, spaces
   and sellables, but do not construct rate services or create/verify policy, plan, model, target,
   approval or release data. Return an explicit discriminated result rather than fabricated empty
   rate identifiers. Logging must state that rate provisioning was omitted without exposing secrets.
3. Make only Order 050 request `identity_inventory`. Preserve its empty first snapshot, exact FLEX
   command, idempotency, security, fact/outbox and browser-asset assertions unchanged.
4. Extend `PHASE_3_DATABASE_PROOFS` with Orders 048, 050, 051, 052 and 057. Each receives a distinct
   fixed database, its existing require/URL/password variables, migration before execution and
   forced cleanup through the existing harness. Do not remove or reorder the eight existing suites.
5. Strengthen the pure runner proof to pin all thirteen mappings, exact cardinality, sequential
   create→migrate→test→drop behavior and fail-fast cleanup. The existing package and CI command stay
   singular and unchanged.
6. Amend the Phase-4 numbering only: this hard-floor correction consumes 083, and the previously
   planned reservation orders move from 083–087 to 084–088 without changing their deliverables.
7. After all proofs pass, append D-280 evidence, advance exact founder counters, add one UNVERIFIED
   manifest row, refresh Graphify as a derived map, rebuild only the persistent app and leave it
   healthy. Independent review remains through Order 044.

## Forbidden

- Any edit under `migrations/`, `tests/run_invariants.py`, schema snapshots, dependencies, Compose,
  Dockerfile, application routes, operator assets, production rate/reservation/inventory services,
  occupancy, restriction, RLS, tenant context, audit/outbox, journal/fiscal/statutory logic,
  permissions, state machines, tables or events
- Changing Order 050's FLEX code, initial empty expectation, HTTP status expectations or security
  assertions to accommodate the founder seed
- Removing Order 078's published review rate, changing CLI default behavior, bypassing publication
  or four-eyes evidence, or creating a second seed implementation
- Reusing one database across suites, allowing skips, retrying red assertions, continuing after a
  failed suite, hiding output or leaving temporary databases behind
- Approval, independent review, merge, or representing this builder correction as reviewer-executed

## Pre-registered proof

### P0 — preserved red

On a fresh migrated database at the Order-082 tip, execute Order 050 with its required URL and
password variables. The observed result is exactly 4 pass / 3 fail: P1 receives four policies and
one FLEX plan instead of empty, and P3/P4 receive 409 because the demo FLEX already exists. Orders
048, 051, 052 and 057 pass in their own fresh databases. Commit this order before production or
fixture code changes; do not weaken the three red assertions.

### P1 — explicit fixture boundary

On a fresh database, Order 050's `identity_inventory` mode produces an authenticated review user and
the canonical inventory but zero policy, rate-plan, model, target, release or approval rows before
P1. All seven Order-050 proofs then pass unchanged. The normal/default seed proof still creates and
exactly replays the Order-078 published rate and four-eyes evidence.

### P2 — inherited proof restart

Run Orders 048, 050, 051, 052 and 057 through the expanded runner from freshly recreated dedicated
databases. All five pass; the syntax-aware browser guard remains active in every suite.

### P3 — complete isolated gate

Run the single `bun run test:phase3-gate` command with an explicit admin URL and proof-only password.
All thirteen suites migrate, execute and force-clean in sequence; no fixed-name proof database
remains. The pure runner suite proves the matrix and fail-fast cleanup without a database.

### P4 — standing gate and localhost

From the top: frozen install; state; typecheck; import boundaries; complete default tests; review
coverage check; licence and dependency audits; schema drift; protected hashes; fresh isolated
app-never-started `./setup.sh --db-only` at 11/11. Refresh Graphify code-only and record parser limits.
Rebuild only the persistent app, authenticate, confirm independently reviewed through 044 with the
new current-order/debt counts, and leave app/PostgreSQL/Valkey healthy. Commit, push a stacked draft
PR and do not merge.

## Definition of done

## Builder evidence — UNVERIFIED

- P0 was reproduced at the exact Order-082 tip `383c98f` before fixture code changed. Order 050
  returned 4 pass / 3 fail: the initial snapshot contained four policies and one FLEX plan, and its
  own plan creation/replay returned 409. Orders 048, 051, 052 and 057 passed in separate fresh
  databases. The order was committed as `60e88b9` before implementation.
- P1 passed after the explicit fixture split: Order 050 returned 7 pass / 0 fail and 50 assertions
  on a fresh database, including zero policy/plan/model/target/release/approval rows before its first
  command. Its FLEX, status, idempotency, evidence and security assertions were not weakened. The
  default founder seed still passed all eleven published-rate proofs.
- P2/P3 passed through the one expanded runner: 13/13 isolated suites, 92 tests and 1,693
  assertions. Each database was recreated, migrated, executed and force-dropped sequentially; a
  catalog query found zero `yellow_ci_p*` or `yellow_verify_*` proof databases afterward.
- P4 passed from frozen dependencies: 100 default tests / 0 fail / 1,371 assertions with 311
  database-gated skips explicitly covered by the isolated gate; exact typecheck/import boundaries;
  23-package licence policy; zero dependency vulnerabilities; byte-exact review coverage and schema;
  fresh app-never-started referee 11/11. Protected hashes remain
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923` and
  `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`.
- Graphify refreshed code-only with zero token/API cost to 4,738 nodes, 8,348 directed edges and
  517 communities. Diagnostics report zero missing/dangling endpoints, duplicates or collapsed
  directed pairs; ten inherited self-loops remain visible as a parser limitation.
- Draft PR #64 run `32605943315` passed quality, Windows state, container smoke and the expanded
  database job at `939bb14`; the database job completed in 1m58s. This evidence remains UNVERIFIED.
- Independent review remains exact through Order 044. Order 083 and every later builder result are
  recorded `UNVERIFIED`; this correction is neither self-review nor approval.

- [x] P0 red evidence is preserved and this order is committed before implementation.
- [x] Order 050 passes without changing its product assertions or the founder seed default.
- [x] The five inherited suites and complete thirteen-suite isolated gate are green.
- [x] Standing checks, protected hashes and fresh referee are exact.
- [x] Persistent localhost is healthy and review debt remains honestly UNVERIFIED.
