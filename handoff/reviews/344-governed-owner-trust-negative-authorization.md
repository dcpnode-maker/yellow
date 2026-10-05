# Order 344 governed owner-trust negative authorization fresh Tier-3 review

**Disposition:** WITHHOLD — permanent review-seed least-scope gate is stale

**Reviewer:** `/root/order344_fresh_tier3_review`, fresh independent non-implementing
OpenAI Codex Tier-3 reviewer

**Exact reviewed candidate:** `760a36a83ad26d29baa1c4d21af1f272e70ec83d`

## Blocking finding

The accounting capability and focused hostile proof are green, but the required
review-seed gate is red. `scripts/seed-review.ts` correctly grants the new
`financials.trust:post` scope to the canonical operator; the unchanged least-scope
assertion in `tests/review-seed.integration.test.ts` still expects the pre-Order-344
scope string. Fresh result: **23 pass, 1 fail, 104 assertions**. The sole mismatch is
the new `financials.trust:post` claim. This is a bounded stale permanent oracle, not a
product or trust-accounting finding, but D977's recorded **24/0** is not reproducible.

No repair was made. A separately admitted assertion repair and a different fresh
Tier-3 rereview are required.

## Fresh proof

I personally used repository-pinned PostgreSQL 16.15 in one reviewer-owned Docker
bridge container, loopback port 59560 and tmpfs storage, with distinct deploy/runtime/
registrar roles and fresh databases. I did not use Compose, `.yellow`, port3000 or the
stable runtime.

- migrations 0001–0060 applied; catalogue **111/101/10/2**;
- capability is SECURITY DEFINER with pinned `pg_catalog, public, pg_temp`, app-role-
  only execute, no PUBLIC/direct-runtime execute; authorization table is app SELECT-
  only and raw mutation is denied;
- focused trust proof **7/0 (33)**: credit-normal `-10000 => 10000`, unapproved `4000`,
  denied then exactly approved `7000 => -1000`, hostile approvals/tenant/role/state/
  route/actor, replay/conflict, one-use/concurrent spend, seal ordering, fact/outbox/
  idempotency and late rollback/clean retry;
- acceptance **23/0 (65)**; runtime authority **10/0 (85)**; referee **11/11**;
- standing **1,189 pass, 897 expected skips, 0 fail, 18,394 assertions**;
- TypeScript, 133-file boundaries, 23-package licence policy, audit zero and diff
  hygiene pass.

Strict ancestry `d9e43c0 -> b02896c -> 042ad30 -> 625acf1 -> 93cd836 -> 760a36a`
and amended scope pass. No payout/UI/tax/day-close/local surface was added.

**WITHHOLD** exact candidate `760a36a83ad26d29baa1c4d21af1f272e70ec83d`.
No product repair, merge, push, deployment or downstream authority is granted.
