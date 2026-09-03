# Order 376 — Order375 posting-catalogue oracle repair

**Status:** ACTIVE-D1071
**Phase:** 5 — Financials
**Branch:** `phase-5/posting-catalogue-oracle-repair`
**Base:** exact withheld Order375 governance `0309376b2a35c6242c3d3edfac2990e03087c062`
**Risk tier:** 1 — stale test-only catalogue numeral

## Outcome and scope

Repair only D1070's reproducible stale assertion in
`tests/financial-postings.integration.test.ts`: the approved migration-64 frontier has
116 public base tables, not historical 115. The functional suite already passed,
including 500 charges and 1,000 balanced immutable lines.

Exact scope is that one numeral, this order/review, `DECISIONS.log` and
`handoff/LEDGER.md`. No source, migration, schema, other test, product, UI, status,
local or dependency change is admitted. D1070 is the preserved intentional red.

## Definition of done

- [x] Fresh native PostgreSQL reproduced expected115/received116 while live catalogue
      was exactly `64/116/106/106/15/2`.
- [ ] The one-token repair makes the complete posting suite green on a fresh frontier.
- [ ] A different fresh non-implementing reviewer confirms exact scope and proof before
      Order375 restarts from the beginning.

