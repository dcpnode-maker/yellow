# ORDER 015 — repair the Windows walkthrough database check

**Phase:** 0 · **Branch:** `phase-0/windows-walkthrough-correction`
**Written by:** OpenAI Codex, acting as temporary architect under D-71
**Date:** 2026-08-15 · **Tier:** 1

## Goal

Keep the click-by-click Windows onboarding path executable after Order 013 removed
fixed Compose container names and the migration runner added its metadata table.

## Finding

`docs/WALKTHROUGH-WINDOWS.html` still tells a new user to run `docker exec` against
the retired global name `yellow-postgres`, then says the migrated database contains
80 public tables. Current stacks are named by `COMPOSE_PROJECT_NAME`, and a migrated
database contains 81 public tables: 80 immutable baseline tables plus
`schema_migration`. The linked onboarding command therefore fails before it can
check the stale expected value.

## Scope — the only file Codex may change

- `docs/WALKTHROUGH-WINDOWS.html`

Start from commit `a421e6b` plus this order commit. Do not change scripts, Compose,
CI, source, tests, dependencies, migrations, fixtures, decisions, or other docs.

## Required change

In the existing Part 7 database sanity check only:

1. Replace fixed-name `docker exec` with `docker compose exec postgres` so Compose
   resolves the current project's service.
2. Preserve the existing `psql` database, user, and query.
3. Change the expected result to 81 and state the breakdown as 80 baseline tables
   plus `schema_migration`.
4. Do not reformat, regenerate, or otherwise modernize the HTML.

## Verification

- `rg -n "yellow-postgres|docker exec" docs/WALKTHROUGH-WINDOWS.html` returns no
  matches.
- The displayed command succeeds against the current nondefault Compose project and
  returns exactly `81`.
- `rg -n "Want:.*81|80 baseline.*schema_migration" docs/WALKTHROUGH-WINDOWS.html`
  shows the corrected expectation and explanation.
- HTML tags surrounding the edited block remain balanced.
- `git diff --check` passes and only the scoped HTML file changes relative to the
  order commit.
- The standard `./setup.sh --db-only` referee remains 11/11 before review.

## Forbidden

- Fixed/global container names or hardcoded container IDs.
- Editing historical research/results merely to replace the former `SCHEMA.sql`
  source name.
- Changing any domain, tenancy, RLS, occupancy, journal, fiscal, migration, fixture,
  or invariant-referee logic.
- Merging or self-approving.

## Review requirement

Claude reviews this Tier-1 onboarding correction with the cumulative Phase-0 stack.
The builder does not merge.
