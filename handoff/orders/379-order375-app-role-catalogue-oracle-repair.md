# Order 379 — Order375 app-role catalogue-oracle repair

**Status:** ACTIVE-D1086
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
- [ ] Exact three-literal candidate is ready for complete app-role proof.
- [ ] Fresh non-implementing reviewer approves the bounded repair.
