# Order 406 — D1199 repair fresh independent Tier-3 review

**Verdict:** APPROVED-CLOSED-D1200

**Reviewed candidate:** `f9a7b385caf7fd1ed828520225652f525e599b99`

**Approved base:** `c9521d0`

**Reviewer:** `/root/order406_d1199_final_review`, fresh independent non-implementing Tier 3

## Verdict

No finding. The D1199 repair replaces catalogue-count proxies with actual PostgreSQL
attempts for forked/ambiguous tax and valuation roots, duplicate component children
and duplicate semantic routes. It also executes the resolver against the previously
missing foreign valuation/applicability states, every applicability parent coordinate,
missing and wrong-group routes, coherent wrong-currency/property route bundles, and
wrong jurisdiction owner/key/version. Every resolver-visible rejection is paired with
the complete unchanged financial/fiscal/fact/outbox/idempotency plus persisted-evidence,
route, transaction-code and account census.

The structural constraint attempts run directly as `yellow_deploy` and assert exact
SQLSTATE `23505` or `23503`; they do not set `session_replication_role`. The bypass is
confined to fixture setup, hostile-state construction/restoration and cleanup. The
production resolver remains migration-free, read-only and tenant-transaction/RLS
bound, aggregates only persisted amounts, requires exact Order259 route identities,
and returns recursively frozen Order367 lineage.

## Reviewer-personal execution

On a uniquely named disposable PostgreSQL **16.15** stack at explicit loopback port
`55641`, never the default/stable database, I personally obtained:

- Order406 scripted plus complete live PostgreSQL/RLS hostile matrix: **11/11, 122 assertions**;
- adjacent Order259 on its own fresh migration-only database: **10/10, 139 assertions**;
- adjacent Order367 on its own fresh migration-only database: **18/18, 694 assertions**;
- fresh migrations **1–70**, **122** public tables and migration head **70**;
- referee: **11 passed, 0 failed of 11**;
- standing: **1,318 pass, 1,013 expected skips, 0 fail, 19,578 assertions across 433 files**;
- strict TypeScript check passed; import boundaries passed across **146 TypeScript files**;
- dependency licence policy passed for **23 installed packages**;
- exact `git diff --check c9521d0..f9a7b38` passed and the diff contains only the ten authorized Order406 paths.

The production dependency graph is unchanged from exact previously audited candidate
`861ca17`. Fresh `bun audit --production` attempts stalled without a result both on
the host and in a Linux Bun 1.3.14 container; they are not counted green. A fresh OSV
query of all six locked production packages returned zero advisories.

Two initial Order406 invocations used the wrong runtime role name (`pms_app`) and
failed authentication before live proof; they are not counted green. One first
Order367 adjacency attempt on the seeded referee database met an existing
`tax_jurisdiction` fixture and is likewise excluded. The reported results are the
clean reruns using `yellow_runtime` and separate migration-only adjacency databases.

No product, test, migration, schema, local application, deployment, merge, push or
credential mutation was performed. The pre-existing untracked `.yellow/` directory
was not accessed or changed. The disposable container, databases, network and volume
were removed and verified absent.
