# Order 382 — Business-day roll contention repair

**Status:** APPROVED-CLOSED-D1110
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
- [x] Migration0065 repairs both redundant conflict arbiters without authority drift.
- [x] Repeated contention, rollback, tenancy, schema and permanent gates pass.
- [x] Fresh independent Tier3 approval is recorded before Order375 restarts.

## Exact-version rereview authority — D1104

D1103 found no product defect but correctly withheld because its assigned PG17.2
host could not satisfy the non-waivable PG16.15 acceptance contract. The official
EDB PostgreSQL16.15 Windows binaries are now available at a bounded `E:\yellow`
toolchain path. A fresh distinct reviewer must restart Order382 proof using that
exact server version with `shared_preload_libraries=pg_stat_statements`; no gate,
test, product byte or acceptance expectation is changed or waived.

## Final rereview after snapshot approval — D1109

Order383 is independently approved and closed at D1108 after official PG16.15 proves
the normalized schema snapshot byte-identical to live migrations1–65. Order382 now
restarts its complete proof from item1 at exact approved tip
`bcf3ba0089b3100608a73130abe6b319b25dc97a` under another distinct non-implementing
Tier3 reviewer. No D1103/D1105 partial output is reused as the approval verdict.

## Final independent approval — D1110

Fresh distinct non-implementing Tier3 reviewer
`/root/order382_final_pg16_reviewer` restarted every Order382 proof item against
activation `2e143722c198cd5f257501f1f45086f37596eeac` and independently approved
Order383 tip `bcf3ba0089b3100608a73130abe6b319b25dc97a`. Official Windows PostgreSQL
16.15 with `pg_stat_statements` preloaded applied migrations 1–65 and returned
exact catalogue `65/116/106/106/15/2`, the exact two business-day arbiters and
the bound migration0061/0065 hashes.

Two complete focused runs exercised ten reset-based twenty-contender cycles (200
calls): no `23505`, exactly one `opened=true`, and exactly one atomic
day/fact/outbox effect per cycle. Rollback/retry, backlog, property-local date,
tenant/property/role/`pg_temp`, worker, runtime-DML and SECURITY DEFINER proofs
passed. Migration regression passed **39/0 (187 assertions)** including deliberate
wrong-password `28P01`; normalized PG16.15 schema is byte-identical at SHA-256
`a5efaaae5ad3d2315cf2fc62a7dd2352e3992b9643f91784ca70994d1f89e8a9`; seeded
acceptance passed **23/0 (65 assertions)**; standing passed **1225/0** with 956
expected skips and 18,611 assertions; typecheck, 140-file boundaries, 23-package
licence policy, zero-vulnerability audit, diff hygiene and fresh referee **11/11**
passed. The exact server, port and disposable root were removed and no WSL crash
path appeared. Approval closes only Order382; Order375 is not approved or restarted.

## Builder evidence

D1102 adds only forward migration0065's replacement of the existing
`open_current_business_day(uuid,uuid)` capability, its expected-schema line,
repeated contention and exact-two-arbiter proof, direct migration/catalogue oracles,
bounded roll documentation and governance. Migration0061 remains byte-identical at
SHA-256 `50cf8593ac385b74fbe61da9d28f0ecf59b78297c7aff46ad073f34409efc34f`.
Migration0065 is bound at SHA-256
`8e28af137263ff23ecacb1f9e49b4f48b203d5f8c3773d1c2471c5a78cae331a`.

Builder-personal Windows-native PostgreSQL17.2 applies migrations1–65 and proves
exact catalogue `65/116/106/106/15/2`, the exact two admitted business-day arbiters,
unchanged owner/fixed-search-path/app-only authority, and targetless arbitration.
Five fresh resets with twenty concurrent contenders each plus worker, rollback,
hostility and discovery pass **11/0 with 55 assertions**. Standing passes
**1225/0 with 956 database skips and 18611 assertions**; typecheck, boundaries,
licences, setup-current-catalogue and diff-check pass. Migration regression passes
38/39; its unrelated wrong-password SQLSTATE-shape assertion is not portable on the
mandated PG17/Bun host. Acceptance's exact ledger/catalogue passes; its expected
PG16.15 version and absent unseeded demo fixture are the only two environment reds.
Fresh independent PG16 Tier3 execution of every mandatory gate remains required;
the builder grants no approval.

## Fresh Tier-3 review

D1103's distinct non-implementing reviewer personally applied migrations 1–65 on a
fresh Windows-native PostgreSQL 17.2 cluster and proved exact catalogue
`65/116/106/106/15/2`, the exact two admitted business-day arbiters and both bound
migration hashes. Two complete focused runs exercised ten reset-based twenty-client
races (**200 concurrent calls**) without `23505`; each cycle produced exactly one
opened result and one day/fact/outbox effect. Rollback/retry, backlog, different
property/timezone, hostile tenant/property/role, fixed-path/`pg_temp`, runtime-DML and
worker wiring proofs all pass. Standing passes **1225/0** with 956 expected database
skips and 18,611 assertions; typecheck, boundaries, 23-package licence policy,
zero-vulnerability audit, setup catalogue, diff hygiene and a fresh referee **11/11**
also pass.

Approval is nevertheless withheld because this order makes the permanent migration
and acceptance gates mandatory. On the mandated PG17/Bun host, migration regression
is **38/1**: Bun omits SQLSTATE `28P01` for the deliberate wrong-password connection.
After the canonical seed, database acceptance is **22/1**: all ledger/catalogue,
ownership, ACL and canonical-seed assertions pass, but the suite requires exact
PostgreSQL `16.15` with `pg_stat_statements` preloaded while the mandated fresh host is
PostgreSQL `17.2`. These are executable platform mismatches, not evidence against the
contention repair, but the required gates are not green and may not be waived. The
disposable server, port and root were removed; no WSL crash dump was generated.

## Exact PostgreSQL 16.15 rereview — D1105

A fresh distinct non-implementing Tier-3 reviewer restarted the proof on official
Windows PostgreSQL `16.15` with `pg_stat_statements` preloaded. Migrations 1–65
applied and live catalogue `65/116/106/106/15/2`, both business-day arbiters and
both migration hashes were exact. Two complete runs exercised ten reset-based
twenty-contender races (200 calls) with one open/day/fact/outbox effect per cycle
and no `23505`; rollback, backlog, tenant, role, `pg_temp`, worker, runtime-DML and
definer proofs passed. Migration regression passed **39/0**, including deliberate
wrong-password `28P01`; seeded exact-version acceptance passed **23/0**; standing
passed **1225/0** with 956 expected skips and 18,611 assertions; static gates passed.

Approval is withheld because the mandatory canonical schema comparison is red.
The PG16.15 dump contains migration0064's
`seal_business_day_audited(uuid,uuid,date,uuid)` definition and ACL, while
`tests/schema/expected.sql` contains neither. Its first normalized mismatch is line
6660, where the snapshot advances directly to `transition_arrival_pickup_task(...)`.
This is not version noise and cannot be waived or repaired by the reviewer. The
server stopped, port 55483 refused connections, the exact disposable root was
removed, and no WSL crash path was present. A separate scoped repair and fresh
review are required before Order375 restarts.
