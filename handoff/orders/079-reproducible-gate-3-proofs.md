# Order 079 — Reproducible Phase-3 and Gate-3 database proofs

**Phase:** 3 · exit evidence
**Branch:** `phase-3/reproducible-gate-3-proofs`
**Tier:** 2 — proof infrastructure and CI coverage; no hotel-domain behavior
**Written by:** OpenAI Codex, autonomous temporary architect under D-95/D-115/D-221

## Outcome

Turn the database-gated Phase-3 proof suites into one reviewer-runnable command and an always-run
CI gate. A normal green build must no longer conceal the universal rate engine behind skipped
tests. Each suite runs against its own freshly created and migrated database, with every existing
require flag enabled and every suite-specific input supplied by one bounded runner.

This order changes proof execution only. It cannot approve Orders 045–079, close Claude's
CHANGES-REQUIRED verdict by assertion, or alter any hotel configuration, price, approval,
publication, quote, occupancy, tax or compliance behavior.

## Natural-Solution Test

- Claude's Gate-3 run observed database-gated suites skipped under the default command until a
  manual per-suite harness supplied their private environment variables. The current CI database
  job never supplies the Phase-3 flags, so its green result is not the executable proof promised by
  the Gate-3 review contract.
- The suites already own their fixtures and assert their exact domain contracts. Rewriting those
  assertions would create another oracle. The missing layer is deterministic isolation and
  orchestration.
- One small Bun runner can validate two explicit inputs, create a separate database for each exact
  suite, run the existing migration runner, enable that suite's required flag and URL/password
  variables, execute it, and force-drop the database in `finally`.
- The same command works locally and in GitHub Actions; no service account, dependency, production
  seed, persistent review database or parallel price path is needed.

## Scope

- `.github/workflows/ci.yml`
- `package.json`
- `scripts/run-phase-3-gate.ts`
- `tests/phase-3-gate-runner.test.ts`
- `src/project-status.ts`
- `tests/founder-status.integration.test.ts`
- `handoff/orders/079-reproducible-gate-3-proofs.md`
- `handoff/GATE-3-MANIFEST.md`
- `handoff/LEDGER.md`
- `DECISIONS.log`
- `handoff/questions/`

## Exact suite matrix

The runner must execute these existing files, each on a distinct fresh database:

1. `tests/rate-models.integration.test.ts`
2. `tests/rate-targeting.integration.test.ts`
3. `tests/rate-publication.integration.test.ts`
4. `tests/rate-quote.integration.test.ts`
5. `tests/operator-rate-builder.integration.test.ts`
6. `tests/operator-rate-intent.integration.test.ts`
7. `tests/review-seed.integration.test.ts`
8. `tests/founder-status.integration.test.ts`

## Required work

1. Add `scripts/run-phase-3-gate.ts` with a frozen, exported matrix carrying each exact test path,
   required-flag name, URL-variable name and optional password-variable name. Reject missing or
   non-PostgreSQL admin URLs and missing/short proof passwords before creating anything.
2. Use only fixed validated database names. Connect to the supplied admin database, force-drop and
   create one database per suite, run the repository's existing `db:migrate` command, then run only
   that suite with its require flag set to `1`. Supply the URL and, where needed, the one proof
   password. Run sequentially and force-drop in `finally`, including after a failing migration or
   assertion.
3. Fail on the first non-zero migration or suite exit and label the failing suite. Never convert a
   failure to a skip, rerun a failed assertion automatically, mutate a test, or continue to produce
   a misleading aggregate green result.
4. Add a pure always-run test that pins the exact eight-suite matrix, unique database names, exact
   require/URL/password mappings, sequential command shape, validation and cleanup behavior through
   injected process/database doubles. The proof must not need PostgreSQL.
5. Add `bun run test:phase3-gate` as the sole documented entry point. Wire it into the existing CI
   database job after PostgreSQL address resolution and before the app is started. CI supplies one
   explicit non-production proof password and the existing resolved admin URL.
6. Advance only the builder snapshot and Gate-3 debt to Order 079. Keep independent review through
   Order 044, Phase 3 active and Orders 045–079 UNVERIFIED. Record D-273 and the Order-079 ledger and
   manifest evidence only after the focused and standing gates pass.

## Forbidden

- Any edit under `migrations/`, `tests/run_invariants.py`, schema snapshots, Compose, Dockerfile,
  lockfiles, dependencies, application routes, operator HTML/CSS/JS or rate-domain source
- Any change to money, rate evaluation, targeting, approval, publication, quote, RMS, policy,
  restriction, availability, occupancy, RLS, tenant context, audit/outbox, fiscal, tax or statutory
  behavior
- Sharing one mutable database across suites, using the persistent `yellow_dev` database, running
  suites in parallel, starting the app, seeding review data outside the suites, or leaving databases
  behind
- Replacing exact suite assertions with smoke tests; modifying a suite to make orchestration pass;
  accepting skips; retrying assertions; weakening time/work ceilings; hiding stdout/stderr
- New dependencies, secrets, GitHub tokens, service accounts or external model/network calls
- Marking Orders 045–079 reviewed, approved or merged; changing architect review files; merging

## Pre-registered proof

### P0 — inherited green-with-skips becomes red

Run the exact eight files with ordinary `bun test` and preserve that it exits zero while reporting
database skips. Then add the pure matrix/CI contract test before the runner and workflow exist; it
must fail on the absent suite matrix and absent CI command. Commit this intentional red before
implementation.

### P1 — pure runner contract

`bun test tests/phase-3-gate-runner.test.ts` passes without PostgreSQL and proves the exact matrix,
input validation, unique fixed names, sequential migrate-then-suite execution, fail-fast labeling
and force-drop cleanup on both success and failure.

### P2 — fresh isolated Phase-3 execution

Against the disposable Order-079 Compose PostgreSQL service, run `bun run test:phase3-gate` with
only the admin URL and proof password documented by the runner. All eight suites execute with no
skip and every temporary database is absent afterward.

### P3 — CI fidelity

The workflow parser and pure proof show the database job runs the exact package command after
address resolution and before app startup. Push only after GitHub's database job executes the same
command green; do not treat local output as remote proof.

### P4 — standing gate

From the top: frozen install; state; typecheck; import boundaries; complete default tests; licence;
audit; schema drift; protected hashes; fresh isolated app-never-started `./setup.sh --db-only`
11/11. Confirm the persistent localhost stack was not stopped, reseeded or used by P2. Refresh the
disposable Graphify code map, record parser/health limits, commit, push and open a draft PR stacked
on Order 078. Do not merge.

## Definition of done

- [x] P0 green-with-skips and intentional red evidence are preserved before implementation.
- [x] P1 proves the runner contract without a database.
- [x] P2 executes all eight existing database suites on separate migrated databases with no skip.
- [ ] P3 is green on GitHub Actions using the same package command.
- [ ] P4 is fully green and protected hashes remain exact.
- [ ] Order 079 remains builder-verified and UNVERIFIED pending independent Gate-3 execution.
