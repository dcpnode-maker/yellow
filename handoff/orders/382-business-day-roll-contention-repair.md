# Order 382 — Business-day roll contention repair

**Status:** ACTIVE-D1099
**Phase:** 5 — Financials
**Branch:** `phase-5/business-day-roll-contention-repair`
**Base:** exact withheld Order375 governance `2f087f0c596776e671b1e7685ca36a9023b45d34`
**Risk tier:** 3 — tenant-scoped financial-day creation and concurrent uniqueness

## Outcome

Repair D1098's reviewer-personal SQLSTATE `23505` so twenty concurrent attempts to
open the same PostgreSQL/property-local business day always converge to one day and
one atomic fact/outbox effect. Preserve Order347's date authority, tenant binding,
least authority, rollback, backlog independence and no-op semantics.

Migration0061 is immutable applied history. Add migration0065 to replace only
`open_current_business_day(uuid,uuid)` with the same signature, owner, grants,
fixed search path, validation and return contract, changing its insert arbitration
to targetless `ON CONFLICT DO NOTHING` so both existing redundant arbiters
participate: primary key `(property_node,business_date)` and tenant-leading unique
key `(tenant_id,property_node,business_date)`. This is not a blind domain insert: the
capability first validates the exact active same-tenant property and derives the only
admitted date from PostgreSQL. Both constraints encode the same validated identity,
and the exact follow-up tenant/property/date read resolves the existing row. No table,
policy, view, event,
permission, direct DML grant or service/API/UI behavior is added.

## Exact scope

- new `migrations/0065_business_day_roll_contention_repair.sql`;
- `tests/schema/expected.sql` for the replaced function only;
- `tests/business-day-roll.integration.test.ts` to strengthen repeated high-contention
  proof without weakening the existing twenty-contender assertion;
- directly affected exact migration/catalogue/schema/database-acceptance/authority
  oracles whose only change is migration64→65 and the new migration checksum/name;
- Order382 intentional-red and focused tests if required;
- business-day-roll repair wording only in `docs/CONTRACTS.md`, `BUILD-PLAN.md`,
  `handoff/PHASE-5-PLAN.md` and `handoff/ROADMAP.md`;
- this order, its review, `DECISIONS.log` and `handoff/LEDGER.md`.

No application service, worker, server, seed, dependency, HTTP/UI/status/local,
Docker or `.yellow` change is admitted. `migrations/0001_init.sql` and migration0061
remain byte-immutable. Any extra product behavior requires a separate order.

## Executable proof

1. Preserve D1098 as the intentional real-race red; add no artificial sleeps or
   serialization that hides contention.
2. Fresh PostgreSQL applies migrations1–65 and returns exact catalogue
   `65/116/106/106/15/2`; migration ledger checksums and expected schema are exact.
   Prove `business_day` has exactly the two admitted unique arbiters—primary key
   `(property_node,business_date)` and tenant-leading unique
   `(tenant_id,property_node,business_date)`—so a future unrelated uniqueness rule
   cannot silently become targetless no-op behavior.
3. Repeat the twenty-contender same-property proof enough times to exercise the
   race: every run resolves without `23505`, exactly one result is `opened=true`,
   and exactly one day/fact/outbox effect exists.
4. Concurrent different properties/tenants remain independent; existing-day rerun
   is a no-op; hostile tenant/property/role/pg_temp inputs fail closed.
5. Injected fact/event failure rolls the winning insert back and an exact retry wins
   once. Older unsealed backlog never blocks today's opening.
6. `app_role` alone can execute the fixed-search-path owner capability and retains
   no direct business-day DML; `PUBLIC` and `yellow_runtime` remain denied.
7. Run complete roll/worker/financial-day regressions, migration/schema/authority,
   full standing/static/acceptance and fresh referee 11/11. A fresh independent
   non-implementing Tier3 reviewer personally executes the concurrency and rollback
   proof before approval.

## Forbidden

- editing migration0061 or any prior migration/checksum;
- advisory locks, application mutexes, sleeps/retries that mask database arbitration,
  single-constraint conflict targeting, or weakening/removing either business-day
  uniqueness constraint;
- caller/browser/server date authority, catch-up/reopen/seal/readiness/carry behavior;
- new tables, policies, permissions, events, APIs, UI, local promotion, deploy, merge
  or Phase/application-completion claim.

## Definition of done

- [x] D1098's real SQLSTATE23505 race is preserved as executable review evidence.
- [ ] Migration0065 repairs both redundant conflict arbiters without authority drift.
- [ ] Repeated contention, rollback, tenancy, schema and permanent gates pass.
- [ ] Fresh independent Tier3 approval is recorded before Order375 restarts.
