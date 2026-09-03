# Order 377 — Order375 legacy catalogue-oracle repair

**Status:** ACTIVE-D1076
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
- [ ] Exact numeric-only repair makes both complete suites green.
- [ ] Fresh non-implementing reviewer approves exact scope and proof.

