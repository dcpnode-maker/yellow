# Order 388 — Business-day seal permission prerequisite

**Status:** ACTIVE-TECHNICAL-RESOLUTION-D1150
**Phase:** 5 — Financials operator delivery prerequisite
**Risk tier:** 3 — audited close authority

The approved audited seal capability checks `business_day.seal`, but that permission
currently exists only in tests/fixtures and is absent from the production permission
catalogue and review provisioning. After Order384, add only the exact permission through
migration0067 and provision it to the founder-approved ordinary same-property sealing
actor. Order386's still-unapproved trust prepare capability moves to prospective
migration0068.

Migration must add only the internal capability permission and canonical edge-scope
catalogue rows and grant no role. Review seed
must grant exactly the authorized ordinary review/operator role, not infer approval or
other permissions. Intentional red, replay, exact grant/non-grant, catalogue/schema/
migration/acceptance/standing/static/referee11/11 and fresh independent Tier3 proof are
mandatory. No service, HTTP/UI, seal action, local promotion, deploy or merge authority.

## Exact file scope (D1148)

- `migrations/0067_business_day_seal_permission.sql`
- `scripts/seed-review.ts`
- `tests/seed_fixture.sql`
- `tests/business-day-seal-permission.intentional-red.test.ts`
- `tests/business-day-seal-permission.integration.test.ts`
- `tests/database-acceptance.integration.test.ts`
- `tests/migrate.integration.test.ts`
- `tests/setup-current-catalogue-oracle.test.ts`
- `tests/business-day-discrepancy-carry.integration.test.ts`
- `tests/review-seed.integration.test.ts`
- `setup.sh`
- this order, its review record, `DECISIONS.log` and `handoff/LEDGER.md`

The normalized schema snapshot is expected to remain byte-identical and is not in
scope. Any required file outside this list stops the order for a recorded question or
amendment.
