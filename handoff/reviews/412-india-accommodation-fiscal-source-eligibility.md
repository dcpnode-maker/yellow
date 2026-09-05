# Order 412 — Fresh independent Tier-3 review

**Verdict:** APPROVED-CLOSED-D1226

**Reviewed candidate:** `4ccc910`

**Approved base:** `0ce9033`

**Reviewer:** `/root/order412_d1225_tier3`, different fresh independent
non-implementing Tier-3 reviewer

## Verdict

Approved with no finding. The D1225 repair removes D1224's unordered-ID-set gap:
every unique embedded mapping identity is resolved through PostgreSQL and compared
to its exact semantic kind/code, transaction code, credit account and role, property,
INR currency, and selected jurisdiction identity/version/content hash. The reviewer
personally reproduced both exact attack forms: swapping only revenue/component IDs
and duplicating the revenue ID into a component slot while preserving surrounding
tuples and durable routes. Both now conflict and preserve the complete tenant census.

## Reviewer-personal execution

- repository-pinned official PostgreSQL 16.15 container, isolated port 55942,
  migrations 1–73: Order412 **5/5 (192 assertions)** and intentional-red **2/2**;
- exact-frontier databases: Order367 **17/17 (693)** at migration 70, Order406
  **10/10 (117)** at 70, Order407 **15/15 (144)** at 71, Order408 **7/7 (92)** at 72;
- database acceptance **23/23**, catalogue **73/124/114/114/23/2**, normalized schema
  byte-exact at **891689 bytes**, and invariant referee **11/11**;
- standing **1332 passed, 1047 skipped, 0 failed (19670 assertions)**; typecheck,
  149-file boundaries, 23-package licence policy, image pins and diff check green;
- dependency audit transport returned no result within 30 seconds and is not counted;
  dependency manifests and lock bytes are unchanged.

Sentinel canonicalization remained test-only and production byte replay stayed strict.
Isolated resources were removed. Stable/default databases, local port3000 and
`.yellow/` were untouched. Approval closes only Order412; no downstream document,
IRP, API, UI, local, deploy, merge or Phase authority follows.
