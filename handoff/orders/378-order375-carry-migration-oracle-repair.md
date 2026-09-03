# Order 378 — Order375 carry migration-oracle repair

**Status:** ACTIVE-D1081
**Phase:** 5 — Financials
**Branch:** `phase-5/carry-migration-oracle-repair`
**Base:** exact withheld Order375 governance `d9f39f8b517c0882ff4f7a9e9df9da5681fc61e4`
**Risk tier:** 1 — one stale test-only migration count

Repair only D1080's independently reproduced
`tests/business-day-discrepancy-carry.integration.test.ts:908` expectation from 63 to
the authoritative 64 migration rows. Its companion `116/106/15/2` values are already
exact. Scope is that one token plus order/review/decisions/ledger. No source,
migration, schema, other test, UI, status or local change. D1080 is the intentional
red; fresh complete carry proof and a different independent review are mandatory
before another full Order375 restart.

## Definition of done

- [x] Fresh review reproduced expected63/received64 on exact migration64 truth.
- [ ] Exact one-token candidate passes the complete carry suite.
- [ ] Fresh non-implementing reviewer approves the bounded repair.

