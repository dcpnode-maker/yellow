# Order436 — Main-line quote fixture for documentation integration

**Status:** ACTIVE
**Date:** 2026-09-05
**Phase:** Delivery tooling; no product phase advancement
**Risk:** Test-fixture-only; preserve all product assertions
**Target:** PR81, branch phase-7/order435-main-readme, based on origin/main

## Outcome and observed failure

Order435's initial README-only candidate549208f passed quality, Windows-state and
container smoke in CI33935544793 but failed the isolated Phase3 quote suite: its
fixed September1 stay is now before the actual booking time. Seven tests stop at
the ordinary booking/stay ordering guard. Repair the disposable test clock so the
main landing-page correction can execute all existing gates. No fiscal product
change from PR80 is included.

This order explicitly extends PR81 beyond its initially README-only scope to the
single test fixture below. Do not describe the subsequent candidate as README-only.
The Order435 record of the initial candidate remains historical and accurate.

## Scope

- In the existing secondary checkout, tests/rate-quote.integration.test.ts only:
  derive one captured day and a bounded future stay, preserving 3-night, overlap,
  partial, child-reference and 30/60-night relationships and exact expected money.
- If an extension effective range now conflicts with that fixture, normalize only
  that disposable fixture's existing tax assignment/extension boundary; no change to
  seed, schema, evaluator, source privileges or expected tax/money behavior.
- In the active coordination worktree: this order, Order435 publication/evidence
  receipt, DECISIONS.log and handoff/LEDGER.md.
- PR81 title/body/status to reflect actual changed scope and CI results.

No production source, migrations, seed, package/lockfiles, workflow, auth, role/grant,
runtime/database authority or local app mutation. No skipped/weakened assertions,
generic-error acceptance, historical proof rewrite, new clone/worktree or force push.
If CI exposes another file, stop and report the exact missing scope before editing.

## Verification and independent integration

1. Main candidate differs only in README and this one test fixture; preserve main's
   exact schema and existing tests rather than cherry-picking current fiscal work.
2. Run focused native discovery/static checks without opening a local database.
3. Execute full existing CI on the exact candidate, including the canonical referee
   result 11 passed, 0 failed. Skips/failures are not proof.
4. A non-implementing agent independently inspects the exact candidate, personally
   executes available relevant checks and verifies complete remote proof before
   integrating through the normal PR. No self-merge or override of failed checks.
5. Verify remote main after integration. Leave the dirty local main checkout alone;
   no local app refresh is implied.
