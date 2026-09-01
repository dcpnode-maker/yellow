# Order 346 — Review-seed trust scope oracle repair

**Status:** APPROVED-D981
**Phase:** 5 — Financials
**Branch:** `phase-5/review-seed-trust-scope-oracle-repair`
**Base:** `62b8582` (Order344 independent WITHHOLD)
**Risk tier:** 3 — permanent least-scope authentication proof
**Owner:** Codex implementation; different fresh non-implementing Tier-3 reviewer

## Outcome

Repair only the two exact review-login scope strings made stale by Order344's
intentional least-authority grants. The canonical operator expectation gains exactly
`financials.trust:post`; the canonical approver expectation gains exactly both
`financials.trust:post` from its inherited operator role and
`financials.trust:approve-negative` from its additional approver role. Change no seed,
permission, role or product behavior.

## Natural-solution boundary

Fresh Order344 review proves the seed correctly grants `financials.trust:post` and the
first sequential least-scope assertion is red solely because its expected string is
pre-Order344. Exact seed inspection also proves the different approver role receives
`financials.trust:approve-negative`; the second sequential expected string is equally
stale but masked by the first failure. Updating both exact, alphabetically ordered
expected claims prevents a second masked-oracle cycle. D267 establishes that the
approver intentionally holds the same bounded operator role plus its additional
approver role; four-eyes is enforced by different-user request/decision binding, not
by preventing that user from separately initiating another request. The test must continue exact
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
   both `financials.trust:post` and `financials.trust:approve-negative` to the
   approver's exact sorted string.
3. Run review seed `24/0`, focused owner trust `7/0`, fresh migrations60 catalogue
   `111/101/10/2`, acceptance/runtime/schema, standing/static and referee11/11.
4. A different fresh Tier-3 reviewer personally verifies both exact identities,
   exact inherited/additional role composition, complete Order344 hostility and all
   mandatory gates.

## Forbidden

- changes to seed, permissions, roles, production, migration, schema, API/UI, runtime,
  environment or credentials;
- adding negative-approval to the operator, adding any other scope, weakening
  exact equality or deriving the expected string from actual claims;
- `.yellow`, port3000, stable Order335, merge, push, deployment, self-review or
  Phase/application completion claims.

## Definition of done

- [x] The product diff is exactly three token additions in two expected scope strings.
- [x] Fresh permanent gates are green.
- [x] A different fresh independent Tier-3 reviewer approves Order346 and Order344.

## Role-composition correction

D980 records the pre-commit executable discovery: the operator expectation passes with
only `trust:post`; the approver actual claim set contains both trust scopes because the
seed deliberately grants every canonical review user the bounded operator role and the
approver receives an additional role. Retain that established architecture and update
the approver expectation with both exact tokens. No seed or authority changes.

## Independent approval

D981 records fresh non-implementing Tier-3 approval at exact candidate `37cb8cf`:
review-seed24/0, owner-trust7/0, fresh60/111/101/10/2, acceptance23/0,
runtime-authority10/0, migrate39/0, exact schema, standing1189/0 plus897 expected
database skips, static gates and referee11/11. Order346 and the underlying Order344
are approved within their exact accounting-only boundaries.
