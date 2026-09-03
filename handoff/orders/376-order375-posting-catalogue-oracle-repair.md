# Order 376 — Order375 posting-catalogue oracle repair

**Status:** APPROVED-CLOSED-D1073
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
- [x] The exact one-token candidate is committed; fresh executable confirmation remains
      reviewer-owned.
- [x] A different fresh non-implementing reviewer confirms exact scope and proof before
      Order375 restarts from the beginning.

## Builder candidate — D1072

The only product-tree delta is the pre-authorized P1 expectation `115 -> 116`.
No source, migration, schema or other test changed. D1070 already proves the live
catalogue is 116 and every functional posting assertion passed; a different fresh
reviewer must execute the corrected complete suite before approval.

## Fresh independent review — D1073

Fresh non-implementing reviewer `/root/order376_fresh_reviewer` approved exact
candidate `6cfa39d59bb0aa86d2c852d21071746c14efcb71`. Its product-tree delta from the
withheld Order375 governance is exactly the authorized `115 -> 116` test numeral;
the remaining delta is this order and append-only governance. There is no source,
migration, schema or other-test change.

Reviewer-personal Windows-native PostgreSQL 17 proof applied migrations 1–64,
confirmed exact live catalogue `64/116/106/106/15/2`, and passed the complete
financial-postings suite `10/0` with 111 expectations, including 500 charges and
1,000 balanced immutable posting lines without replay drift. The server stopped,
port 55476 returned no response, the exact disposable root was removed and verified
absent, and no WSL crash-dump directory was present. This closes only Order376; a
fresh Order375 exit review must restart from its beginning.
