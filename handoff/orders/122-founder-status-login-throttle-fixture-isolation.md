# Order 122 — Isolate founder-status login-throttle fixtures

**Phase:** 5 proof correction  
**Branch:** `phase-5/founder-status-login-throttle-fixture-isolation`  
**Base:** exact Order 118 executable SHA `09070d97e1f457a2d3f87a2ab6dc33b558bc3895`  
**Risk tier:** 1 — test-fixture lifecycle only; no product/authentication change  
**Owner:** Codex implementation and ordinary executable verification  
**Status:** DONE / REVIEWABLE — fixture-only implementation complete; independent review remains required
**Source:** Question 141, discovered by Order 118's complete cumulative gate

## Outcome

The founder-status database proof gives each test a fresh in-process
`LocalLoginService`/`LocalLoginGuard`, matching process-test isolation while preserving
Order 117's exact production budget. P1 cannot consume P2's account capacity merely
because both tests share one module-scoped app. The cumulative database runner restarts
from suite one and passes without retries, sleeps or limiter weakening.

## Scope

- `tests/founder-status.integration.test.ts`, only to isolate the existing app/login
  fixture per database test;
- this order, Question 141, `handoff/LEDGER.md` and `DECISIONS.log` only for exact
  executable evidence and the fixture-lifecycle decision.

## Required work

1. Preserve every production file and every Order 117 guard parameter/behavior.
2. Keep the existing database pool, token signer, seed, credentials, requests and HTTP
   assertions exact. Construct a fresh `LocalLoginService` and app for each test in the
   database-gated founder-status describe block.
3. Preserve the production-like fact that attempts inside one test share one guard;
   only independent tests receive independent in-memory state.
4. Commit an intentional fixture proof or otherwise demonstrate on the exact parent
   that the complete founder-status suite reaches deterministic valid-login `429` on
   its fourth cross-test attempt, then show the corrected suite passes.
5. Restart the complete cumulative 16-suite runner from suite one. Run standing tests,
   typecheck, boundaries, licences and audit. Do not resume at founder status.

## Forbidden

- Editing `src/`, migrations, login capacities/refill/backoff/concurrency, HTTP status
  behavior, credentials, clock, source-key authority or Argon2/JWT logic
- Injecting a permissive guard, raising capacity, advancing fake time, sleeping for a
  refill, accepting 429, retrying login, reordering/removing assertions or sharing a
  global reset hook with production
- Database/schema/seed changes, new dependency, dashboard/status advance, Cyber
  closure, merge, push or live-stack change

## Proof

- Parent: complete database-gated founder-status suite passes P1 then receives exact
  `429` instead of `200` in P2 on the fourth shared-account valid login.
- Green: the same suite passes all seven tests from a fresh database, while the Order
  117 focused limiter suite remains exact.
- Full: all 16 cumulative suites pass from suite one; standing/type/boundary/licence/
  audit remain green.

## Definition of done

- [x] Coordinator confirms collision-free order readiness and exact base.
- [x] Parent failure is preserved as executable evidence: the inherited parent
  deterministically returned `429` instead of `200` on the fourth shared-account
  valid login across P1/P2.
- [x] Only test-fixture lifecycle changes; production diff is empty. Executable
  implementation is `8bdd977a7db7449117c4c94ff9d8782223525b50`.
- [x] Founder status passes 7/7 with 82 assertions and Order 117 focused limiter
  proof passes 10/10 with 78 assertions; guard parameters and behavior are unchanged.
- [x] Complete cumulative 16/16 runner passes from suite one on fresh disposable
  PostgreSQL under WSL.
- [x] Standing gates pass 163/0 (402 skipped; 1,923 assertions), typecheck,
  64-file boundaries, frozen install (23 packages), licence check (23), and audit.
  A Windows attempt stopped at inherited Order 069 P8 (21.36s); the mandatory fresh
  WSL rerun passed that P8 in 13.324s and all 16 suites. This is disclosed host
  contention evidence, not a product failure.
