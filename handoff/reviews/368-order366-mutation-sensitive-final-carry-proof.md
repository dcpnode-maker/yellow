# Orders 368 / 366 / 363 / 359 / 351 final fresh Tier-3 review

**Disposition:** APPROVE — exact mutation-sensitive and full executable proof green

**Reviewer:** `/root/order366_fresh_tier3`, fresh independent non-implementing Tier-3

**Exact subject:** detached candidate `5b9b9dd3f18b3bdb8f9cfd6dc7fdeb69684888f3`
over the governed carry implementation and proof lineage in Orders 351, 359, 363,
366 and 368. The candidate changes only the permanent carry integration proof.

## Mutation sensitivity

From a fresh isolated D: checkout and PostgreSQL 16.15 cluster, the reviewer first
obtained the restored focused result **11/0 (1,782 assertions)**. Each exact mutation
was then applied and executed separately, and exact candidate bytes were restored
before the next mutation:

- removing only approval-request uniqueness makes the isolated approval-reuse case
  red **0/1**;
- removing only request-id uniqueness makes the isolated request-reuse case red
  **0/1**;
- removing canonical event publication makes the injected rollback case red
  **0/1** because the in-transaction typed event observation is absent; and
- removing `folio_balance` from the independently discovered observation catalogue
  makes the success/isolation case red **0/1**.

The migration and test files were byte-restored after mutation (SHA-256 respectively
`2b9dc9c73b77b68a06cae3e2dd05da88e00f3f073a41232bada2569c7d49702b` and
`d986618eefb552ddcca74d4406977f5b9140763dded86e86621cf450bb1dc52d`).

## Fresh completed gates

- exact migration integration: **39/0 (187)**;
- deterministic seed: **10/0 (63)**; review seed: **24/0 (111)**;
- database acceptance: **23/0 (65)**;
- runtime-DML authority: **5/0 (120)**;
- SECURITY DEFINER containment: **3/0 (192)**;
- full standing suite: **1216/0**, 946 expected database skips, **18,519**
  expectations across 399 files;
- schema unit: **4/0 (19)**, and official upstream PostgreSQL 16.15 native
  `pg_dump` normalizes byte-exact to `tests/schema/expected.sql`;
- referee database independently migrated and fixture-loaded: **11/11**;
- typecheck, 139-file import boundaries, licence policy, production audit with zero
  vulnerabilities and exact candidate diff hygiene: green.

The initially available Ubuntu package was excluded from final acceptance because its
vendor-qualified version string is not the repository's exact `16.15` oracle. The
reviewer built official upstream PostgreSQL 16.15 in the isolated D: review area,
installed the required official contrib modules, and reran every invalidated fresh
gate above against that exact server. No Docker resource, stable port 3000, `.yellow`
state or canonical product candidate was changed.

## Decision

Orders **368 / 366 / 363 / 359 / 351 are APPROVED** at exact candidate
`5b9b9dd3f18b3bdb8f9cfd6dc7fdeb69684888f3`. Approval is bounded to the governed
business-day discrepancy carry capability and its executable mutation-sensitive
proof. It grants no later readiness/seal workflow, local-runtime, deployment, merge,
Phase-5 completion or application-completion authority. Disposable reviewer
databases, source build, cluster and worktree are removed after this record commits.
