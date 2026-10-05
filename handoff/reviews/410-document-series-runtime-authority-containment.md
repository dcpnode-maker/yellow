# Order 410 — Fresh independent Tier-3 review

**Verdict:** APPROVED-CLOSED-D1218

**Reviewed candidate:** `acee3cc`

**Approved base:** `abbf7e3`

**Reviewer:** `/root/order410_fresh_tier3`, fresh independent non-implementing
Tier-3 reviewer

## Finding

No blocking finding. Migration0073 removes the runtime's raw document-series
counter authority and exposes only the fixed-path, runtime-session-bound allocator
for the caller tenant/property's unique non-fiscal folio series. Both existing folio
paths preserve their established `FolioConflictError` contract. The capability
cannot allocate fiscal truth, create documents, cross tenants, bypass the runtime
session contract, or leave a number behind after the surrounding transaction rolls
back.

The focused proof is mutation-sensitive: the approved base has both raw
`UPDATE document_series` call sites and no migration0073, while the intentional-red
checks require their removal and the bounded capability. Live assertions separately
exercise direct ACL denial, exact zero-write rejection census, publisher rollback,
primary/additional replay, final counter values and 100 concurrent unique gap-free
allocations across two tenants. Removing the update, tenant/property filters,
advisory serialization, counter bound, fixed session checks or production call-site
replacement breaks an observed assertion rather than merely a source comment.

## Reviewer-personal execution

I created a new isolated data directory and two databases at loopback port 55750
using the exact official upstream PostgreSQL 16.15 binaries from
`E:\yellow\toolchains\postgresql-16.15\pgsql\bin`, SCRAM host authentication and
`pg_stat_statements` preload. Personal results:

- fresh migrations **1–73**, canonical seed and database acceptance **23/0 (65
  expectations)**;
- exact catalogue **73 migrations / 124 public tables / 114 RLS tables / 114
  policies / 23 forced-RLS tables / 2 views**;
- exact upstream raw normalized schema equality, **891,689 bytes**, SHA-256
  `dc47520e6da64a9bcdf7fd70e653caf4da921a22dd4dec5f9ee833b2d7dee945`;
- migration0073 SHA-256
  `d5cef790f3f75f902de457d22e21f272530a77257f65daac1bb5e6e51f1688aa`;
- Order410 intentional-red/live matrix **6/0 (53 expectations)**, including
  exact owner/signature/search path/ACL, runtime/deploy direct-call denial, raw
  fiscal and non-fiscal counter/document DML denial, rejection census, rollback,
  replay and the complete two-tenant 100-way concurrency proof;
- existing primary-folio **12/0**, multi-window/folio-transfer **8/0**,
  runtime-DML **5/0**, app-role containment **5/0**, positive-tax folio eligibility
  **7/0**, and Order408 reversal **10/0**;
- a separately migrated and fixture-loaded referee database: **11 passed, 0 failed
  of 11**;
- standing **1,330 passed / 1,040 expected skips / 0 failed / 19,662 expectations
  across 439 files**; strict TypeScript, **148-file** import boundaries,
  **23-package** licence policy, exact container-image pins and `git diff --check`
  all pass.

`bun audit` was attempted twice and bounded after the registry request remained
silent; it produced no vulnerability result. This does not weaken the candidate
review: Order410 changes no dependency manifest or lock file, the 23-package licence
inventory is exact, container pins are exact, and the approved base already carried
the last successful zero-finding audit. The unavailable registry transport is
recorded rather than reported as a pass.

The first referee invocation reached the database proof but Windows' legacy console
encoding rejected an arrow character in its output. The disposable referee database
was recreated from zero and the complete UTF-8 rerun passed 11/11.

Stable/default databases, local port3000 and the pre-existing `.yellow/` directory
were not accessed or changed. This approval grants only Order410's exact non-fiscal
folio-series authority containment. It grants no fiscal document allocation,
issuance, invoice/credit/debit note, hash chain, India ItemList/provider/submission,
API/UI/local promotion, deploy, merge, Phase or application completion authority.
