# Order 431 — Current 18-phase GitHub status reconciliation

**Status:** ACTIVE — D1305
**Phase:** System status and delivery coordination
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Risk tier:** 1 — status, documentation and presentation truth only
**Owner:** Codex

## Outcome

Make the current GitHub branch and founder status surface consistently describe the
authoritative 18-phase Yellow plan. Remove stale current-facing claims that the plan
has 13 phases, preserve historical evidence, and record Order429 and Order430 at their
actual states without inflating Phase 7 or independent-review coverage.

## Scope

- `src/http/operator/index.html`
- `src/project-status.ts`
- `tests/founder-status.integration.test.ts`
- `tests/current-management-demo-status.intentional-red.test.ts`
- `README.md`
- `USAGE.md`
- `START-HERE.md`
- `docs/LOCAL-REVIEW.md`
- `docs/PACKAGE-AND-COST.html`
- `BUILD-PLAN.md`
- `handoff/ROADMAP.md`
- `handoff/PHASE-7-PLAN.md`
- this order, `DECISIONS.log`, and `handoff/LEDGER.md`

## Required truth

1. The current plan has 18 phases, numbered 0–17.
2. Current phase states remain 0–3 reviewed, 4 built-unverified, 5–6 reviewed,
   7 active, and 8–17 planned unless later executable evidence changes them.
3. Founder priority remains 11, then 13, then 17, dependency-gated by
   `7 → 8 → 9 → 10 → 11 → 12 → 13 → 17 → 14 → 15 → 16`.
4. Order429 is recorded as independently approved and closed, bounded to read-only
   false readiness. Order430 is recorded only at its genuinely reached state.
5. `INDEPENDENTLY_REVIEWED_THROUGH_ORDER` remains the generated coverage scalar and
   is not relabelled to imply contiguous review through Order429.
6. Historical orders, reviews, decisions and ledger entries retain their historical
   wording; only current-facing summaries are reconciled.
7. GitHub publication is a normal push/PR from the active branch. No force push,
   direct overwrite of `main`, self-merge, local-runtime mutation or deployment.

## Proof

- focused status tests and a permanent 18-phase denominator assertion;
- typecheck and repository boundary/static gates relevant to the touched files;
- search proving no stale current-facing 13-phase claim remains in scoped files;
- diff review proving no historical evidence or product authority was changed;
- push the green branch and open/update a normal PR to `main`.

## Excluded

No Phase 7 fiscal implementation, schema, database, local runtime, credentials,
`.yellow`, deployment, merge, force push or historical-evidence rewrite.
