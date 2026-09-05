# Order 380 — Order375 setup migration-oracle repair

**Status:** CHANGES-REQUIRED-D1093
**Phase:** 5 — Financials
**Branch:** `phase-5/setup-catalogue-oracle-repair`
**Base:** exact withheld Order375 governance `ec75d1313e32b738a5609edb74901dc3f7a4413e`
**Risk tier:** 1 — two stale test-only migration counts

Repair only D1090's independently reproduced
`tests/setup-current-catalogue-oracle.test.ts` migration-count and highest-migration
expectations from 63 to authoritative filesystem frontier 64. The existing public
table expectation remains 116. Scope is those two numeric literals plus
order/review/decisions/ledger. No source, setup script, migration, schema, other test,
UI, status or local change. D1090 remains the intentional red. Fresh focused proof
and a different independent reviewer are mandatory before Order375 restarts.

## Definition of done

- [x] Fresh full review reproduced derived `64/64` versus expected `63/63`.
- [x] Exact two-literal candidate is ready for focused proof.
- [ ] Fresh non-implementing reviewer approves the bounded repair.

## Builder note

D1092 changes exactly the two authorized expected values from 63 to 64. No source,
setup script, migration, schema, other test, UI, status or local artifact changed.

## Independent review

D1093 withholds approval. The exact diff is bounded as declared and disk derives
`64/64/116`, but the complete focused test is still red `0/1`: its two unchanged
setup-message assertions expect `migrations 1-63` while authoritative `setup.sh`
correctly reports `migrations 1-64`. Order380 has no authority to repair or waive
those additional stale literals. No database, WSL, product, local or `.yellow`
change was made; `wsl-crashes` remained absent.
