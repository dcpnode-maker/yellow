# ORDER 014 — resolve CI database health through Compose

**Phase:** 0 · **Branch:** `phase-0/ci-compose-health-correction`
**Written by:** OpenAI Codex, acting as temporary architect under D-71
**Date:** 2026-08-15 · **Tier:** 2

## Goal

Repair the cumulative Phase 0 database job after Order 013 removed explicit Compose
container names, without weakening its pinned-PostgreSQL health gate.

## Finding

Order 012's `Start pinned PostgreSQL` step asks Docker to inspect the literal
container name `yellow-postgres`. Order 013 correctly removed every
`container_name`, so the service is now named from `COMPOSE_PROJECT_NAME`. The final
stack would wait for a container that cannot exist and fail before running any
database proof.

## Scope — the only file Codex may change

- `.github/workflows/ci.yml`

Start from commit `c5104d7` plus this order commit. Do not change Compose, scripts,
tests, dependencies, migrations, fixtures, generated snapshots, or documentation.

## Required change

In the database job's existing PostgreSQL readiness loop:

1. Resolve the current project's PostgreSQL container ID with
   `docker compose ps --quiet postgres` on every attempt.
2. Inspect health only when that ID is nonempty, using the ID rather than any name.
3. Continue requiring Docker health status `healthy`; do not replace the gate with
   `running`, a sleep, or `|| true` success.
4. Preserve the existing 30-attempt bound, one-second interval, pinned image, job
   ordering, and failure cleanup.
5. Add no action, dependency, script, service, or duplicated health logic elsewhere.

## Verification

- `rg -n "yellow-postgres|container_name" .github/workflows/ci.yml docker-compose.yml`
  returns no matches.
- With a nondefault `COMPOSE_PROJECT_NAME`, `docker compose up -d postgres` followed
  by the exact loop resolves a nonempty service container ID and reaches `healthy`.
- A nonexistent Compose project/service cannot be mistaken for healthy.
- `docker compose config --quiet`, `git diff --check`, and the complete Bun quality
  suite pass.
- The final Python referee remains `11 passed, 0 failed of 11`.
- Only `.github/workflows/ci.yml` changes relative to the order commit.

## Forbidden

- Reintroducing a fixed/global container name.
- Editing any domain, tenancy, RLS, occupancy, journal, fiscal, migration, fixture,
  or invariant-referee logic.
- Merging, self-approving, or implementing any later phase.

## Review requirement

Claude must review this correction together with Orders 012–013 and the green
database workflow before cumulative Phase 0 integration. The builder does not merge.

---

## MERGED

Merged into `main` by the cumulative Phase 0 integration PR (head `7f1d7c3`).
Reviewed in `handoff/reviews/` before merge; see `handoff/LEDGER.md` for the verdict line.
