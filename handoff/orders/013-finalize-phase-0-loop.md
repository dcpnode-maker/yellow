# ORDER 013 — portable local loop and Phase 0 truth reconciliation

**Phase:** 0 · **Branch:** `phase-0/finalize-bootstrap-loop`
**Written by:** OpenAI Codex, acting as temporary architect by founder authorization
**Date:** 2026-08-15 · **Tier:** 2

## Goal

Make the documented fresh-clone loop use the proven runner/seed/referee in isolated
worktrees and reconcile Phase 0's authoritative text with the decisions now executed.

## Why now

Order 012 proves CI. This final Phase 0 implementation order makes the same path the
developer default, removes fixed-container collisions observed during stacked work,
and eliminates stale DoD wording before the cumulative integration review.

Start from the reviewed Order 012 head.

## Scope — files Codex may create or change

- `docker-compose.yml`
- `setup.sh`
- `setup.ps1`
- `state.sh`
- `state.ps1`
- `BUILD-PLAN.md`
- `PROJECT.md`
- `README.md`
- `USAGE.md`
- `START-HERE.md`
- `START-HERE-WINDOWS.md`
- `docs/CODEX.md`
- `docs/TOOLING.md`

No source, migration, fixture, test, dependency, workflow, order, decision, or review
file is in Scope.

## Contracts to honour

- `PROJECT.md` — session ritual and referee
- `DECISIONS.log` — D-14, D-16, D-68, and D-76
- Orders 010–012 command contracts
- `handoff/questions/008-ARCHITECT-RESPONSE.md` — Gate 5

## Compose worktree isolation

1. Remove explicit `container_name` from app, postgres, and valkey. Compose project
   identity owns names; do not invent replacements.
2. Make host ports configurable with defaults:
   - `YELLOW_APP_PORT` → `3000`
   - `YELLOW_POSTGRES_PORT` → `5442`
   - `YELLOW_VALKEY_PORT` → `6389`
3. Keep container ports, service names, healthchecks, volumes, and pinned images.
4. Tool services continue connecting to hostname `postgres:5432` inside Compose.
5. Document that a second worktree sets a distinct `COMPOSE_PROJECT_NAME` and host
   port triplet. Do not silently stop or delete another worktree's containers/volumes.

## Setup scripts: one authoritative path

Both setup entry points must perform the same ordered operations with native error
checking after every external command:

1. Resolve/default the three host-port variables and the current Compose project.
2. Start required Compose services and fail immediately if Compose fails.
3. Wait for the current project's Postgres service through `docker compose exec`, not
   a fixed global container name.
4. Run Order 010's production migration runner against `yellow_dev`.
5. Run Order 011's exact demo seed against `yellow_dev`.
6. Recreate only the current project's `yellow_test` database.
7. Run the production migration runner against `yellow_test`.
8. Load only `tests/seed_fixture.sql` into `yellow_test`; never load schema via psql.
9. Assert 81 public tables (80 immutable baseline tables plus `schema_migration`) and
   explain that breakdown in output.
10. Run the Python referee with a DSN built from the selected Postgres host port and
    require `11 passed, 0 failed of 11`.
11. Start/verify app health at the selected app host port for a full setup.

`-DbOnly` / `--db-only` may skip repository/account/bootstrap concerns, but must still
exercise migrate+seed+fixture+referee as above. Identical reruns must succeed.

Do not auto-install packages, create external accounts, expose production ports, or
remove Docker volumes. If Bun, Python, Docker, or psycopg2 is missing, fail with one
specific installation instruction.

## State scripts remain read-only

Replace fixed-name `docker ps`/`docker exec` logic with Compose service inspection for
the current project. Report:

- current branch/head/dirty state;
- open order/review/question counts;
- app/postgres/valkey service states when defined;
- `yellow_test` table count as `81 (80 baseline + schema_migration)` when reachable;
- the canonical reading order and referee command.

State scripts must not start, stop, create, drop, or mutate anything. Their output
must remain concise and equivalent across Bash and PowerShell.

## Reconcile authoritative Phase 0 wording

Update only stale facts; do not rewrite future phases:

- Compose requirement is PostgreSQL 16 + Valkey; NATS is explicitly deferred by D-14
  until the first out-of-process consumer or second app node.
- The immutable executable baseline is `migrations/0001_init.sql` (80 baseline
  tables), applied only through the runner.
- The migration metadata table makes a migrated database contain 81 public tables.
- Schema drift compares the normalized dump with `tests/schema/expected.sql`, not raw
  text against a nonexistent root `SCHEMA.sql`.
- The seed is the deterministic `yellow-demo` tenant/property; the separate fixture
  remains two-tenant invariant data.
- Bun SQL is exercised in Phase 0. Bun.password, built-in WS/SSE, and Bun S3 remain
  mandatory choices but receive executable coverage with their first real consumers.
- Forgejo is pre-deployment founder work and Cloudflare Tunnel waits for OCI hosts,
  per D-68; neither blocks repository Phase 0.

Correct `PROJECT.md`/README references from a root `SCHEMA.sql` path to
`migrations/0001_init.sql` while preserving section references and the historical
source explanation. Correct stale 78/80/81 counts wherever a touched document uses
them.

Update all in-Scope onboarding commands that name fixed containers or hardcode ports.
Use `docker compose exec` and documented variables. Do not edit generated/research/
historical result artifacts solely to modernize prose.

## Required executable proof

From a clean worktree with default ports:

1. `docker compose config --quiet`
2. `./setup.ps1 -DbOnly` → 11/11 and 81-table explanation
3. WSL/Git Bash `./setup.sh --db-only` → 11/11 and the same explanation
4. Run both state scripts; compare their material facts
5. Run setup a second time; migration and seed report no-op and battery remains 11/11

Then, without touching the first stack, use a second Compose project name and distinct
three-port set from another worktree. Prove `docker compose up -d postgres` succeeds
and both projects' Postgres services remain healthy. Tear down only the second project
without `-v` after proof.

Finally run the complete Bun quality suite, database integration scripts, schema drift
check, image/container smoke, and Python referee.

## Definition of done

- [ ] No Compose service has an explicit container name.
- [ ] Two worktree projects coexist with distinct host ports.
- [ ] Both setup scripts use runner+seed and never psql-load migration SQL.
- [ ] Both setup scripts and state scripts agree on 81 = 80 + metadata.
- [ ] Setup rerun is idempotent and referee stays 11/11.
- [ ] Phase 0 BUILD-PLAN text matches D-14/D-68/D-76 and actual commands.
- [ ] All in-Scope onboarding paths use current names/commands/ports.
- [ ] Full local quality/database/drift/container proof is green.
- [ ] `git diff --check` is clean and only Scope files changed.

## Forbidden in this order

- Editing source code, tests, migrations, fixtures, CI, dependencies, decisions,
  orders, reviews, or generated schema snapshot.
- Deleting volumes, stopping unrelated Compose projects, or assuming fixed global
  container names.
- Changing domain invariants, RLS, tenant behavior, occupancy, journal, fiscal logic,
  states, or events.
- Adding NATS, Forgejo, Cloudflare, accounts, tunnels, or production credentials.
- Claiming Phase 0 merged/complete before final cumulative review.

## Final integration handoff

After this order's branch is independently reviewed and green:

1. Open a separate cumulative PR from this final head to `main`.
2. Include a Phase-0 requirement/evidence table, every order/PR mapping, baseline hash,
   full CI links, both setup outputs, schema-drift result, and 11/11 output.
3. Claude reviews the cumulative diff and either approves or writes a review file.
4. The builder does not merge. A founder/independent approver merges only after the
   required reviews.
5. Close PRs #1 onward as superseded only after the cumulative merge succeeds.

## Review requirement

Tier 2 because this rewires the verification/bootstrap path around already-reviewed
Tier-3 tools. Claude must review both platform outputs and the requirement/evidence
table before integration.
