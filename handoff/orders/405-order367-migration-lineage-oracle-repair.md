# Order 405 — Order367 migration-lineage oracle repair

**Status:** APPROVED-CLOSED-D1194
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** exact reviewed governance head `176fa2a`; product candidate `505a6bd`
**Risk tier:** 3 because this repair gates fresh review of statutory persistence;
the repair itself is test-only
**Owner:** Codex implementation; fresh different non-implementing Tier-3 reviewer

## Outcome and exact scope

Repair the sole D1191 stale historical-lineage expectation by appending exact
filename `0070_india_gst_accommodation_final_component_tax.sql` to the existing
`appliedFiles` array in `tests/migrate.integration.test.ts`.

Allowed files are only that test, this order, a new review, `DECISIONS.log` and
`handoff/LEDGER.md`. Production, migration0070, schema, setup, authority and all
other tests remain byte-frozen. Run the focused migration case, complete matrix,
standing/static gates and a fresh different Tier-3 restart. No local, deployment,
merge, push or Phase-7 completion authority.
