# Order 381 — Order375 setup-message oracle repair

**Status:** ACTIVE-D1094
**Phase:** 5 — Financials
**Branch:** `phase-5/setup-message-oracle-repair`
**Base:** exact withheld Order380 governance `bae06a4c4023e257bffcf3b4878510957cd52184`
**Risk tier:** 1 — two stale test-only setup message strings

Repair only D1093's independently reproduced two assertions in
`tests/setup-current-catalogue-oracle.test.ts` from `migrations 1-63` to the
authoritative `setup.sh` text `migrations 1-64`. Scope is those two string fragments
plus order/review/decisions/ledger. No source, setup script, migration, schema, other
test, UI, status or local change. D1093 remains the intentional red. Fresh complete
focused proof and a different independent reviewer are mandatory before Order375
restarts.

## Definition of done

- [x] Fresh review reproduced both expected `1-63` strings versus actual `1-64`.
- [ ] Exact two-string candidate is ready for complete focused proof.
- [ ] Fresh non-implementing reviewer approves the bounded repair.
