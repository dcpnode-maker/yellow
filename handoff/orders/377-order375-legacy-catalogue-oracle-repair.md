# Order 377 — Order375 legacy catalogue-oracle repair

**Status:** APPROVED-CLOSED-D1078
**Phase:** 5 — Financials
**Branch:** `phase-5/legacy-catalogue-oracle-repair`
**Base:** exact withheld Order375 governance `677beb835532518bc66de2e7ccc99084cf7bd06d`
**Risk tier:** 1 — two stale test-only catalogue assertions

## Outcome and scope

Repair only D1075's independently reproduced catalogue drift:

- owner-trust `tables:115, policies:105` → `116,106`;
- token-payment `89/79/79` tables/RLS/policies → `116/106/106`.

Exact scope is those five numeric literals in
`tests/financial-owner-trust.integration.test.ts` and
`tests/financial-payments.integration.test.ts`, plus this order/review, decisions and
ledger. No source, migration, schema, other test, UI, status or local change. D1075 is
the preserved intentional red. Fresh focused proof and a different independent review
are mandatory before another from-item1 Order375 restart.

## Definition of done

- [x] Both stale expectations are independently reproduced on fresh migration64 truth.
- [x] Exact numeric-only candidate is committed; executable confirmation is reviewer-owned.
- [x] Fresh non-implementing reviewer approves exact scope and proof.

## Builder candidate — D1077

The only product-tree delta is the five pre-authorized numeric literals across the two
named tests. No source, migration, schema or other test changed. Fresh independent
execution remains mandatory.

## Fresh independent approval — D1078

Fresh non-implementing reviewer `/root/order377_fresh_reviewer` verified the exact
candidate diff and personally executed both complete financial suites on a newly
initialized Windows-native PostgreSQL 17 database migrated through all 64 files.
The live catalogue was exactly `64/116/106/106/15/2`; the suites passed 17/0 with
1,407 assertions. The disposable database was stopped and removed, port 55478 was
refused, and no WSL crash dump was generated. Order377 closes without approving
Order375 or changing any local runtime.
