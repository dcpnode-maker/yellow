# Order 432 — PR80 CI portability repair

**Status:** REPAIRED — AWAITING FOURTH GITHUB CI — D1313
**Phase:** Delivery infrastructure
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Risk tier:** 1 — test harness and CI portability only
**Owner:** Codex

## Outcome

Make PR80's existing executable proof portable on GitHub's Linux runner without
skipping, weakening or reclassifying any product assertion. The current diagnostic
attributes all 46 quality failures to runner portability: stale child-process Bun
path, browser launch assumptions and shallow Git history.

## Scope

- `.github/workflows/ci.yml`
- the four failing Order424/425/426/429 hostile or mutation test files identified by
  the PR80 quality log;
- the six failing browser proof files for Orders195/328/330/386/389/395;
- `tests/project-mcp-config.test.ts` and
  `tests/referee-typed-parent-fixtures.integration.test.ts` only to make their exact
  preregistered historical blob/path resolution portable under a full Linux clone;
- `tests/rate-quote.integration.test.ts` only to derive its aged stay fixture from a
  bounded future offset, make the seeded tax-jurisdiction effective period deterministic,
  and bind effective-period reads to the already-provisioned runtime role;
- one existing/new test-only executable/browser helper if needed;
- focused tests for the helper/launcher behavior;
- this order, `DECISIONS.log`, and `handoff/LEDGER.md`.

## Requirements

1. CI fetches complete history required by historical-parent proofs.
2. Child-process proofs resolve the active Bun executable portably and never embed a
   stale setup-bun installation path.
3. Browser proofs locate Chrome/Chromium cross-platform and launch Linux CI with
   robust sandbox/shared-memory flags while still executing every UI assertion.
4. No test is skipped, deleted, softened, renamed to evade discovery or changed to
   accept generic errors.
5. Re-run the complete quality job; then run the container/database jobs when the
   quality gate is green.
6. The Phase-3 quote proof retains exact date relationships and tax-resolution
   assertions; only its disposable database fixture may use one bounded clock-relative
   future stay and normalize the launch extension's
   insertion-time default effective bound, and jurisdiction resolution must exercise
   the runtime-only effective-period capability through the runtime role.

## Excluded

No production behavior, Phase7 fiscal implementation, schema, database policy,
runtime/local, `.yellow`, dependency upgrade, merge, force push or historical-proof
rewrite.
