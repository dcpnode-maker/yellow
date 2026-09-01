# Order 346 — Review-seed trust scope oracle repair

**Status:** READY-D979
**Phase:** 5 — Financials
**Branch:** `phase-5/review-seed-trust-scope-oracle-repair`
**Base:** `62b8582` (Order344 independent WITHHOLD)
**Risk tier:** 3 — permanent least-scope authentication proof
**Owner:** Codex implementation; different fresh non-implementing Tier-3 reviewer

## Outcome

Repair only the two exact review-login scope strings made stale by Order344's
intentional least-authority grants. The canonical operator expectation gains exactly
`financials.trust:post`; the separate canonical approver expectation gains exactly
`financials.trust:approve-negative`. Change no seed, permission, role or product behavior.

## Natural-solution boundary

Fresh Order344 review proves the seed correctly grants `financials.trust:post` and the
first sequential least-scope assertion is red solely because its expected string is
pre-Order344. Exact seed inspection also proves the different approver role receives
`financials.trust:approve-negative`; the second sequential expected string is equally
stale but masked by the first failure. Updating both exact, alphabetically ordered
expected claims prevents a second masked-oracle cycle. The test must continue exact
equality—no contains, subset or generated expected value.

## Exact scope

- `tests/review-seed.integration.test.ts`;
- this order;
- `handoff/reviews/346-review-seed-trust-scope-oracle-repair.md`;
- approval/status-only entries in Order344, `BUILD-PLAN.md`,
  `handoff/PHASE-5-PLAN.md`, `handoff/ROADMAP.md`, `DECISIONS.log` and
  `handoff/LEDGER.md`.

## Required proof

1. Preserve Order344 fresh red `23/1(104)` and its exact additional operator claim.
2. Add only `financials.trust:post` to the operator's exact sorted `scp` string and
   only `financials.trust:approve-negative` to the approver's exact sorted string.
3. Run review seed `24/0`, focused owner trust `7/0`, fresh migrations60 catalogue
   `111/101/10/2`, acceptance/runtime/schema, standing/static and referee11/11.
4. A different fresh Tier-3 reviewer personally verifies both exact identities,
   absence of cross-grants, complete Order344 hostility and all mandatory gates.

## Forbidden

- changes to seed, permissions, roles, production, migration, schema, API/UI, runtime,
  environment or credentials;
- adding either trust scope to the wrong identity, adding any other scope, weakening
  exact equality or deriving the expected string from actual claims;
- `.yellow`, port3000, stable Order335, merge, push, deployment, self-review or
  Phase/application completion claims.

## Definition of done

- [ ] The product diff is exactly two additions in two expected scope strings.
- [ ] Fresh permanent gates are green.
- [ ] A different fresh independent Tier-3 reviewer approves Order346 and Order344.
