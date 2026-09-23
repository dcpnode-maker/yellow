# Orders 346 and 344 fresh independent Tier-3 review

**Disposition:** APPROVE Order346 and Order344

**Reviewer:** `/root/order346_344_fresh_tier3`, fresh independent non-implementing
OpenAI Codex Tier-3 reviewer

**Exact reviewed candidate:** `37cb8cff33974134985a21acb1a56f648bf311e9`

## Finding

No finding. The Order346 product diff is exactly three alphabetically placed token
additions across two retained exact-equality `scp` strings: the operator gains only
`financials.trust:post`; the approver gains inherited `financials.trust:post` plus
its additional `financials.trust:approve-negative`. Fresh login and relational role
inspection prove the operator has one bounded role and no negative-approval scope,
while the approver has the intended two roles and both trust scopes. No seed,
permission, role, production, migration, schema, runtime or local behavior changes.

The underlying Order344 owner-trust capability also passes complete personal
executable review. Credit-normal availability is derived from immutable postings;
the non-negative expense needs no approval; negative availability consumes one exact
different-user decision; and the balanced trust debit/payable credit, relational
authorization, fact, two events and idempotency receipt remain atomic. Permanent
proof kills hostile tenant, actor, owner/account state, route, approval state,
self-decision, payload, replay, reuse, race, rollback and sealed-day paths.

## Fresh executable proof

I used repository-pinned PostgreSQL **16.15** with `pg_stat_statements` preloaded in
one reviewer-owned loopback-only Docker container on port59646 and tmpfs storage.
Separate fresh databases isolated review seed, trust mutation, acceptance, permanent
gates and referee fixtures. I did not use Compose, `.yellow`, port3000 or the stable
Order335 runtime.

- migrations 0001–0060 and exact catalogue: **60 / 111 tables / 101 policies /
  10 FORCE-RLS tables / 2 security-invoker views**;
- review seed: **24 pass / 0 fail / 111 assertions**;
- owner trust: **7 pass / 0 fail / 33 assertions**;
- database acceptance: **23 pass / 0 fail / 65 assertions**;
- runtime authority: **10 pass / 0 fail / 85 assertions**;
- migration runner: **39 pass / 0 fail / 187 assertions**;
- direct isolated schema dump: exact match;
- standing suite: **1,189 pass / 897 expected database skips / 0 fail /
  18,394 assertions**;
- TypeScript, 133-file import boundaries, 23-package licence policy, audit zero,
  ancestry, scope, protected baseline and diff hygiene pass;
- fresh invariant referee: **11 passed / 0 failed of 11**.

Catalogue inspection proves `create_owner_trust_expense` is `SECURITY DEFINER`, owned
by `yellow_owner`, pins `pg_catalog, public, pg_temp`, grants execution only through
`app_role`, and denies direct `yellow_runtime`/PUBLIC execution. The authorization
table is tenant-RLS, app-readable but raw app INSERT/UPDATE/DELETE denied, and all its
FKs/indexes lead with tenant identity. Journals, posting lines, facts and outbox remain
append-only; current property-local business date and account currency are derived,
not caller authority.

One initial reviewer setup reused a mutation database for acceptance and omitted the
required preload, producing two environment-fixture failures. I discarded that
reviewer-owned container, rebuilt with the repository-required preload and separate
fresh databases, and reran every affected gate to the green results above. The schema
CLI is Compose-bound, so the identical normalizer/check was executed against a direct
dump from the isolated container. The first referee attempt selected Windows' Python
alias; the repository-compatible Python3.13 with psycopg2 2.9.12 then produced the
recorded 11/11 result. None was a candidate failure or shared-state mutation.

## Approval boundary

**APPROVE** exact Order346 candidate `37cb8cff33974134985a21acb1a56f648bf311e9`
and thereby discharge D978's sole stale-oracle blocker and **APPROVE Order344**.
This grants only the exact review oracle and accounting-only owner-expense trust
guard. It grants no payout, owner statement/split/commission/reconciliation,
day-roll/close, HTTP/UI/local, tax/fiscal/document, checkout, merge, push, deployment,
Phase5 or application-completion authority.
