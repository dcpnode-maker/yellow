# Orders 365 / 362 / 361 / 360 / 353 final fresh Tier-3 rereview

**Disposition:** APPROVE — all exact executable gates green

**Reviewer:** `/root/order365_final_fresh_tier3`, new fresh independent non-implementing Tier-3

**Exact subject:** clean detached candidate `bbdea8fad3bbc8fbd4216aeedb31b5fc0af323d0`,
including tax proof `cb22cb5be5de0dde7643e82773f7fd9f80c201ce` and corrected
standing/status oracle `d447cca` / governance `bbdea8f`.

## Mutation-sensitive statutory authority

From a clean isolated D: worktree, the reviewer created separate fresh PostgreSQL
16.15 databases for the candidate and each single mutant. The restored candidate
passes the complete authority suite at **17/0 (612)**. Each isolated mutant fails
only its exact permanent case at **16/1 (612)**:

- removing both persisted/replayed ordinal comparisons exposes the coherent
  ordinal-only corruption;
- removing the positive-night guard exposes the coherent-total zero room night; and
- changing the exercised transaction-local tenant `set_config(..., true)` to
  session-level `false` exposes the post-transaction same-connection reset oracle.

No other guard masks any of the three named authorities.

## Fresh completed evidence

- exact catalogue: **63 migrations / 116 public tables / 106 policies / 15
  FORCE-RLS tables / 2 views**;
- migration integration: **39/0 (187)**;
- runtime-DML authority: **5/0 (120)**;
- SECURITY DEFINER containment: **3/0 (192)**;
- deterministic seed: **10/0 (63)**;
- review seed: **24/0 (111)**;
- Order341 real ancestor: **5/0 (570)**;
- corrected full standing suite: **1216/0**, 946 expected database skips,
  **18,519** expectations;
- schema normalization: **4/0 (19)**; typecheck, 139-file import boundaries,
  23-package licence policy, zero-vulnerability audit and diff hygiene pass;
- independently migrated and fixture-loaded referee database: **11/11**.

The native Ubuntu PostgreSQL package was deliberately excluded from final proof after
acceptance **22/1 (65)** showed that its package-qualified server version is not the
repository's required exact upstream string. The reviewer then built the official
upstream PostgreSQL **16.15** source in the isolated D: review area, provisioned a
fresh UTF-8 cluster with `pg_stat_statements` preloaded, applied all 63 migrations and
the canonical seed, and personally obtained acceptance **23/0 (65)**. The exact
upstream `pg_dump` output, with only the required random restrict wrapper removed by
the repository normalizer, byte-matches `tests/schema/expected.sql` without any
version-header substitution.

## Decision

Orders **365 / 362 / 361 / 360 / 353 are APPROVED** at exact clean candidate
`bbdea8fad3bbc8fbd4216aeedb31b5fc0af323d0`. This approval is bounded to the
implemented final-component tax calculation and its executable statutory authority
proof. It does not claim later tax persistence, semantic routing, posting, document,
IRP, local-runtime, deployment, merge, Phase-7 completion or application completion.
All disposable reviewer databases, clusters, source-build artifacts and the isolated
review worktree were removed after the governance record was committed; stable port
3000 and `.yellow` were never touched.
