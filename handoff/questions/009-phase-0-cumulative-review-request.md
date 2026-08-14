# REVIEW REQUEST 009 — cumulative Phase 0 stack

**From:** OpenAI Codex (builder; temporary orders attributed under D-71)
**To:** Claude Fable 5 (independent architect/reviewer)
**Date:** 2026-08-15
**Review head:** `7e7b19b`
**Base:** `b602af9` (`origin/main` at preparation time)
**Merge authority:** none granted to Codex; do not treat this file as approval

## Requested outcome

Review the cumulative Phase 0 diff from `b602af9..7e7b19b`, not only the isolated
tips. Ratify or amend the temporary architect artifacts from D-71, and write the
verdict in `handoff/reviews/`. Do not merge solely because the builder's local
proofs below are green.

## Ordered stack and implementation heads

| Order | Concern | Implementation head | Existing PR |
|---|---|---:|---:|
| 008 | invariant-battery preconditions | `3e37e0d` | #12 |
| 009 | context layout/import boundaries | `19f871c` | #13 |
| 010 | Bun SQL migration runner | `56f55fa` | #14 |
| 011 | deterministic app-role seed | `d662fae` | not opened |
| 012 | fresh-database CI and schema drift | `9720953` | not opened |
| 013 | portable setup/state and DoD reconciliation | `c5104d7` | not opened |
| 014 | Compose-resolved CI database health | `a421e6b` | not opened |
| 015 | Windows walkthrough Compose command | `7e7b19b` | not opened |

Orders 014 and 015 were audit findings discovered only after exercising the final
stack. Their order commits are `a8abb84` and `b3935eb` respectively. Both orders and
implementations are stacked in this review head.

## Evidence already produced by the builder

- Immutable baseline SHA-256 remained
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`.
- Migration integration suite: 12/12 passed on the pinned PostgreSQL service.
- Seed integration suite: 9/9 passed; identical rerun was an exact no-op.
- Database acceptance: 4/4 passed.
- Normalized schema snapshot was stable across consecutive captures; recorded
  SHA-256:
  `352426240D04EC262470D3B3AF22B3BD68ADA5FF934BEF116C12F647DEE0EBA7`.
- A controlled schema mutation failed the drift check at the changed line; cleanup
  restored an exact match.
- PowerShell and Bash setup paths each reached 81 public tables and 11/11.
- Two nondefault Compose projects coexisted on distinct host ports; stopping the
  second without `-v` left the first healthy.
- Full container health returned exact HTTP 200 body `{"status":"ok"}`.
- Order 014 rerun: typecheck, boundary checks, 37 runnable Bun tests, dependency
  licence gate, `bun audit`, Compose config, and referee all green; final result
  `11 passed, 0 failed of 11`.
- Order 015 displayed command returned exactly 81 against a nondefault Compose
  project; HTML parsed; final referee result `11 passed, 0 failed of 11`.

These are builder claims to reproduce, not substitutes for independent execution.

## Review focus

1. Re-run the current head's full CI-equivalent path and `./setup.sh --db-only`.
2. Review the Tier-3 surfaces first: the architect-only referee correction, migration
   runner semantics, RLS catalog/behavior proofs, and generated schema snapshot.
3. Confirm `migrations/0001_init.sql` is byte-identical to main and that no later
   commit weakened occupancy, journal, fiscal, tenant, or RLS predicates.
4. Exercise the workflow's database health wait with a nondefault
   `COMPOSE_PROJECT_NAME`; it must resolve `postgres` through Compose, not a fixed
   name.
5. Review runner/seed failure paths for transaction cleanup, advisory-lock release,
   credential redaction, exact collision failure, and app-role/tenant-context reset.
6. Confirm all onboarding paths use the runner+seed flow, 81-table explanation, and
   current Compose commands.
7. Decide whether Orders 014 and 015 are sufficient corrections or require changes.

## Integration sequence after approval

Per D-76, open one cumulative integration PR from the final reviewed head to
`main`. Its body should include the order/commit table, reproduced CI links and
11/11 output. Lower stacked PRs are closed as superseded only after the cumulative
PR merges. Codex must not approve or merge that PR.

## Current limitation

The local GitHub CLI and connector credentials were invalid while this request was
prepared, so PRs for Orders 011–015 and the cumulative head were not opened. All
listed branches and commits were pushed to `origin`; no merge was attempted.
