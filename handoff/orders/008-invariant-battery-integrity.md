# ORDER 008 — invariant-battery harness integrity

**Phase:** 0 · **Branch:** `phase-0/invariant-battery-integrity`
**Written by:** OpenAI Codex, acting as temporary architect by founder authorization
**Date:** 2026-08-15 · **Tier:** 3

## Goal

Make TC-12.3's cleanup and TC-12.5's timing preconditions explicit without changing
either domain invariant being measured.

## Why now

Review finding F6 identified an unordered edit to the architect-owned referee, and a
subsequent real run reported negative elapsed time while passing. This order restores
the instrument's trustworthiness before any more Phase 0 code is stacked on it.

Start from `phase-0/interim-architect-orders` after its architect artifacts are
available remotely. Do not start from the historical Windows-support branch.

## Scope — the only file Codex may change

- `tests/run_invariants.py`

Anything else is out of scope. If another file appears necessary, write
`handoff/questions/008-IMPLEMENTATION.md` on the implementation branch and stop; the
existing `handoff/questions/008.md` is the architect-gate question and is immutable.

## Contracts to honour

- `PROJECT.md` — invariant 1 and “The referee”
- `DECISIONS.log` — D-69 and D-72
- `handoff/reviews/001-006-phase-0-stack.md` — F6
- `handoff/questions/008-ARCHITECT-RESPONSE.md` — Gate 1
- PostgreSQL `row_security_active(regclass)` semantics

## Required implementation

### TC-12.3 cleanup

Before deleting dorm occupancy, on the same connection that will perform the DELETE:

1. Query `row_security_active('public.space_occupancy'::regclass)`.
2. Query `has_table_privilege(current_user, 'public.space_occupancy', 'DELETE')`.
3. Raise a clear harness/configuration error unless row security is inactive and
   DELETE privilege is present. Do not turn this into a passing zero-row observation.
4. Delete only rows for the existing `DORM` identifier and commit.
5. On that same already-proven unfiltered connection, count rows for `DORM` and raise
   if the count is not exactly zero.
6. Only then run the existing 40-thread/six-bed race.

Keep the existing TC-12.3 success predicate exactly `sum(caps) == 6`. Do not restore
`SET ROLE postgres`; that role is not portable.

### TC-12.5 timing

Use `time.perf_counter()` for both timestamps. Require `dt > 0` before dividing or
reporting throughput. Keep the existing domain success predicate `done > 0`; elapsed
time is a harness validity precondition, not a new throughput service-level target.

## Executable proof

Run all of the following and paste exact output in the PR:

1. `python -m py_compile tests/run_invariants.py`
2. `./setup.sh --db-only` from WSL/Git Bash, or `./setup.ps1 -DbOnly` on Windows
3. The other setup entry point as well when available on the machine

The normal run must report TC-12.3 `claims=6`, TC-12.5 a strictly positive duration,
and `11 passed, 0 failed of 11`.

## Definition of done

- [ ] TC-12.3 proves the cleanup identity is not RLS-filtered and can DELETE.
- [ ] TC-12.3 proves the dorm is empty before racing.
- [ ] TC-12.3's claim-count predicate remains unchanged.
- [ ] TC-12.5 uses a monotonic clock and cannot print zero/negative elapsed time.
- [ ] TC-12.5's `done > 0` predicate remains unchanged.
- [ ] The full referee reports `11 passed, 0 failed of 11`.
- [ ] `git diff --check` is clean.
- [ ] The PR contains only `tests/run_invariants.py`.

## Forbidden in this order

- Editing `migrations/` or `tests/seed_fixture.sql`.
- Changing occupancy functions, grants, RLS policies, tenant context, or fixture data.
- Adding/removing/renumbering test cases or changing the final result-count logic.
- Restoring `SET ROLE postgres` or naming another environment-specific bypass role.
- Adding a throughput threshold.
- Implementing any part of Orders 009–013.

## Review requirement

This changes the Tier-3 referee and occupancy-test setup. Claude must independently
review the exact diff and the 11/11 execution before the cumulative Phase-0 PR merges.
The builder must not approve or merge it.

## Architect answers embodied here

> Q: Is a post-DELETE count sufficient?
> A: Only after the same connection proves RLS is inactive; otherwise RLS can hide
> rows from both DELETE and SELECT.

> Q: Does FORCE RLS filter the current Compose role?
> A: No. `yellow` is currently superuser+BYPASSRLS. The explicit check protects a
> future harness identity change without relying on that implementation detail.

---

## MERGED

Merged into `main` by the cumulative Phase 0 integration PR (head `7f1d7c3`).
Reviewed in `handoff/reviews/` before merge; see `handoff/LEDGER.md` for the verdict line.
