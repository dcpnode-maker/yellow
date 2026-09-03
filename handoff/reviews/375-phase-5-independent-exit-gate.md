# Order 375 — Phase-5 independent exit-gate final full rereview

**Verdict:** CHANGES REQUIRED / WITHHELD

**Activation reviewed:** `c9e225df14e83c10d6f2fd3a84abb30280e4c1e5`

**Frozen product frontier:** `4ce9732`

**Reviewer:** `/root/order375_final_distinct_reviewer`, fresh non-implementing Tier 3,
distinct from every prior Order375, 376 and 377 reviewer

**Date:** 2026-09-03

## Blocking finding

The item-1 restart is withheld on one deterministic stale strict catalogue assertion.
After a fresh Windows-native PostgreSQL 17 cluster applied migrations 1–64,
`tests/business-day-discrepancy-carry.integration.test.ts:908` expected 63 migration
ledger rows while the required and observed frontier contains 64. The same assertion's
other catalogue values were exact: 116 public tables, 106 RLS relations, 15 forced-RLS
relations and 2 views.

This is a test-oracle defect, not an observed product failure, but Order375 forbids
test repair or red waiver. A separately scoped repair and another distinct full
rereview are mandatory.

## Reviewer-personal evidence before the mandatory stop

- A fresh exact disposable PostgreSQL 17 cluster accepted all 64 migrations.
- Folio, posting, statement, correction and multi-window proof passed **53/0** with
  **362 assertions**, including 500 charges / 1,000 balanced immutable lines.
- Payment, hosted deposit, settlement, cashier, receivable, complete financial
  journey and owner-trust proof passed **58/0** with **1,701 assertions**.
- The day-close batch reached **41/2** with **2,044 assertions**. One red was the
  decisive stale migration-count oracle above. The other was an environment-only
  `pg_stat_statements` preload prerequisite on this disposable server; it does not
  alter the mandatory stop caused by the deterministic repository red.
- No earlier Order375 partial output was reused as the verdict. Remaining aggregate,
  static and referee gates stopped unclaimed after the registered red.

## Teardown and boundaries

The reviewer stopped the PostgreSQL server, verified port 55479 refused connections,
removed the exact disposable root and checked that no new WSL crash dump remained.
No product, test, migration, schema, permission, seed, dependency, HTTP/UI, local,
Docker or `.yellow` file was read or changed. Phase5 and local/UI/status wiring remain
unapproved.
