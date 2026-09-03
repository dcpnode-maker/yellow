# Order 378 — Order375 carry migration-oracle repair

**Status:** APPROVED-CLOSED-D1083
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
- [x] Exact one-token candidate is ready for the complete carry suite.
- [x] Fresh non-implementing reviewer approves the bounded repair.

## Builder note

D1082 changes only the authorized migration-count token from 63 to 64. No source,
migration, schema, other test, UI, status or local artifact changed. The complete
carry proof is deliberately reserved for the fresh reviewer.

## Independent review

D1083 records fresh non-implementing `/root/order378_fresh_reviewer` approval of
exact candidate `791e1d5b21a8d5e15d1bb64735d7cc9bbed01b9b`. The reviewer personally
applied migrations 1–64 on disposable Windows-native PostgreSQL 17, queried exact
catalogue `64/116/106/106/15/2`, and passed the complete carry integration and unit
suites: 16 passed, 0 failed, 1,891 assertions. The exact diff from D1080 contains
only the authorized test token plus Order378 append-only governance. The server was
stopped, port 55479 had no listener, the exact disposable root was removed, and no
WSL crash directory was generated. This closes Order378 only; Order375 remains
unapproved and requires another distinct full restart from item 1.
