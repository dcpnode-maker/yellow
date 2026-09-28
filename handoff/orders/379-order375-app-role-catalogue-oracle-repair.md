# Order 379 — Order375 app-role catalogue-oracle repair

**Status:** APPROVED-CLOSED-D1088
**Phase:** 5 — Financials
**Branch:** `phase-5/app-role-catalogue-oracle-repair`
**Base:** exact withheld Order375 governance `0124f7367fce092c73a5cc17bb0287fd2b380fea`
**Risk tier:** 1 — three stale test-only catalogue counts

Repair only D1085's independently reproduced
`tests/app-role-nonlogin.integration.test.ts:232` expectations from legacy
`89/79/79` to authoritative migration64 truth `116/106/106` for public tables,
RLS-enabled tables and policies. Scope is those three numeric literals plus
order/review/decisions/ledger. No source, migration, schema, other test, UI, status
or local change. D1085 remains the intentional red. Fresh complete app-role proof
and a different independent reviewer are mandatory before another Order375 restart.

## Definition of done

- [x] Fresh review reproduced expected `89/79/79` versus live `116/106/106`.
- [x] Exact three-literal candidate is ready for complete app-role proof.
- [x] Fresh non-implementing reviewer approves the bounded repair.

## Builder note

D1087 changes only the three authorized catalogue literals to `116/106/106`. No
source, migration, schema, other test, UI, status or local artifact changed. Complete
app-role execution remains reserved for the fresh reviewer.

## Independent review

D1088: fresh non-implementing reviewer `/root/order379_fresh_reviewer` approves exact
candidate `a84c5b0bbde32b713bbc89eb7dd68d769c36ecc1`. Reviewer-personal Windows-native
PostgreSQL 17.2 proof applied migrations 1–64, queried exact live catalogue
`64/116/106/106/15/2`, and passed the complete app-role containment suite at
5/0 with 25 assertions. Exact diff inspection confirms only the three authorized
numeric literals plus append-only Order379 governance. The server stopped, its port
refused connections, the exact disposable root was removed, and no WSL crash dump
was generated. This closes only Order379; Order375 still requires a new full restart
from item 1.
