# Order 351 — Governed business-day discrepancy carry

**Status:** DRAFT — activation required after Order350
**Phase:** 5 — Financials
**Branch:** `phase-5/governed-business-day-discrepancy-carry`
**Base:** activation must bind the approved Order349/implemented Order350 frontier
**Risk tier:** 3 — four-eyes day attribution, mutable discrepancy transition and tenant-scoped evidence
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Carry one exact unresolved room discrepancy from one exact open property business day
to the property's already-open current business day. A 30-minute, different-user,
exactly bound approval is consumed once. In one transaction the original discrepancy
is resolved as `carried_forward`, one relationally linked unresolved discrepancy is
created for the target day, one immutable carry record, one minimized fact and one
canonical `discrepancy.carried` outbox event are written. Neither business day is
sealed, reopened or rolled.

## Ratified policy and boundary

D990, resolving Question179, is authoritative. The request binds tenant, property,
discrepancy, source business date, already-open target date, normalized reason and
request hash; expires after 30 minutes; requires a different authorized approver; is
one-use; and is stale if the discrepancy or target day changes or the target seals.
Consumption resolves the old discrepancy with immutable `carried_forward` evidence
and creates one linked unresolved current-day discrepancy atomically.

This order implements only that carry transition. Order349 readiness remains
read-only and is not modified here. Day seal/readiness, reopen/roll, ordinary
discrepancy resolution, UI/API and generic approvals are outside scope.

## Natural solution and exact schema

Reuse `discrepancy`, `business_day`, `approval_request`, durable idempotency,
`fact_log`, `outbox`, `app_user` and property-scoped role permissions. Do not create a
parallel discrepancy ledger or add a mutable carry status.

Migration0063 adds one insert-only, owner-owned
`business_day_discrepancy_carry` table. It begins with `tenant_id` and contains:

- immutable carry id and unique request id;
- exact property, source discrepancy and newly created target discrepancy ids;
- exact source and target business dates and the locked target `opened_at` value;
- exact room id, canonical pre-consumption discrepancy-state SHA-256, normalized
  reason and canonical request SHA-256;
- unique consumed approval request id, requester, different approver and approval
  requested/decided timestamps;
- `carried_at`, plus the immutable literal resolution `carried_forward`.

Every primary, unique, foreign key and index is tenant-leading. The migration adds
only the prerequisite tenant-leading uniqueness needed to reference the legacy
`discrepancy` and `business_day` rows; it does not rewrite them. The carry table has
RLS enabled and forced with the canonical transaction-local tenant predicate.
`app_role` receives SELECT only. `PUBLIC`, `app_role` and `yellow_runtime` receive no
direct INSERT/UPDATE/DELETE/TRUNCATE. The table is the immutable one-use consumption
and old/new relational link; the existing original row's only admitted mutation is
the capability's single transition from unresolved to
`resolved_at=transaction_timestamp(), resolution='carried_forward'`.

Unique `(tenant_id, source_discrepancy_id)`, `(tenant_id,
target_discrepancy_id)`, `(tenant_id, approval_request_id)` and `(tenant_id,
request_id)` constraints prohibit a second carry, target alias, approval reuse or
same-request duplicate. The existing partial unique unresolved-room index makes the
resolve-then-create transition converge for the room.

## Exact authorization and command

Two dedicated property-scoped permissions are technical enforcement of D990:

- `financials.business-day:carry-discrepancy` for the requester/consumer; and
- `financials.business-day:approve-discrepancy-carry` for the different approver.

`BusinessDayDiscrepancyCarryService.requestApproval(tx,input)` accepts only tenant,
property, discrepancy id, source date, target date, bounded normalized reason,
idempotency key and server audit envelope. PostgreSQL derives and locks the exact
unresolved discrepancy/room/property, its single canonical
`discrepancy.reported` property/date lineage, both business-day rows, property
timezone, current property-local date, active requester and permission. Source and
target must be distinct, present and unsealed; target must equal the current
property-local date and already be open. Ambiguous/missing report lineage fails
closed.

The service builds a lowercase SHA-256 discrepancy-state hash over a versioned,
fixed-order encoding of tenant, discrepancy, room, reported/system values,
reporter/reported-at and unresolved state. It builds `request_hash` over the exact
D990 binding plus that discrepancy hash and target `opened_at`. The generic approval
is created with kind `business_day_discrepancy_carry`, subject type `discrepancy`,
the exact source discrepancy id, requester and an exact canonical payload containing
only those bound scalar values and hashes. Client JSON, clocks and hashes are never
authority.

`BusinessDayDiscrepancyCarryService.carry(tx,input)` accepts only the exact approval
id, exact expected request hash, idempotency key and server audit envelope. Its
owner-mediated fixed-search-path `SECURITY DEFINER` capability, executable only by
`app_role`, independently:

1. binds the input tenant to transaction-local `app.tenant_id`, validates the active
   requester and exact carry permission, and obtains a transaction advisory lock on
   tenant/property/discrepancy;
2. locks the approval, source discrepancy, room/property and source/target
   business-day rows in deterministic order;
3. byte-matches kind, subject, requester and the complete canonical approval payload,
   requires `approved`, a different active deciding user with the exact property-
   scoped approval permission, and requires decision and consumption strictly before
   `approval.created_at + interval '30 minutes'`;
4. re-derives the source `discrepancy.reported` lineage, discrepancy-state hash,
   request hash and current property-local date; requires the source still unresolved
   and source day still open; and requires the exact target date and `opened_at` to be
   unchanged, current and unsealed;
5. updates only the original discrepancy's unresolved resolution columns, inserts one
   new unresolved discrepancy for the same room with the exact reported/system truth
   and server actor/time, and inserts the immutable carry link; and
6. returns bounded carry identifiers/evidence so the service writes one fact and one
   `discrepancy.carried` event in the same idempotent transaction.

The event uses aggregate type `discrepancy` and the new target discrepancy id. Its
typed columns carry the exact property and target business date; its minimized
payload contains carry, source and target discrepancy ids, source/target dates,
resolution and request hash only. The fact uses entity type
`business_day_discrepancy_carry` and the carry id, with the same minimized evidence.
No second `discrepancy.reported` fact/event is emitted: `discrepancy.carried` is the
canonical creation and lineage event for the target discrepancy.

`PostgresIdempotency` operation
`financials.business-day.discrepancy-carry.consume` binds the canonical consumption
request. Exact replay returns the same carry; divergent reuse conflicts. Database
uniqueness and locks remain the arbiter across distinct keys.

## Migration and exact catalogue allocation

Order350 reserves `0062_india_gst_accommodation_final_valuation.sql`; Order349 is
migration-free. Order351 therefore reserves
`0063_governed_business_day_discrepancy_carry.sql`. Activation must re-read the exact
frontier after Order350 lands. Any collision or changed Order350 catalogue requires a
contract amendment; never rename an applied migration or guess.

Assuming Order350's contracted post-build catalogue is exact, Order351 produces:

- 63 migrations;
- 116 public base tables (`115 + 1`);
- 106 tenant-RLS tables/policies (`105 + 1`);
- 15 FORCE-RLS tables (`14 + 1`); and
- 2 security-invoker views unchanged.

## Exact scope

- this order and its bounded activation/review evidence;
- `migrations/0063_governed_business_day_discrepancy_carry.sql`;
- one financials discrepancy-carry service and exact context export;
- focused intentional-red, unit, fresh-PostgreSQL, hostile, concurrency, rollback,
  idempotency and mutation-sensitive proof;
- directly affected migration/schema/database-acceptance/runtime-authority/
  runtime-DML/SECURITY-DEFINER/catalogue tests and `tests/schema/expected.sql`;
- `scripts/seed-review.ts` only for the two exact permissions and deterministic carry
  fixtures;
- exact carry-only contract/event/state/domain/security/QA and Phase-5 governance
  evidence; and
- fresh independent non-implementing Tier-3 executable review.

`migrations/0001_init.sql` remains immutable. No implementation is authorized until
activation revalidates this allocation and exact file list.

## Hostile executable proof

1. **Intentional red/frontier:** prove service/export, migration0063, table,
   capability, permissions and event are absent before production; bind D990 and the
   exact approved Order349/implemented Order350 ancestry.
2. **Exact policy:** ordinary valid carry proves exact tenant/property/discrepancy,
   distinct open source/current-target date, reason, request hash, 30-minute window,
   different authorized approver and one-use consumption.
3. **Staleness:** mutate each discrepancy field/state, report-lineage attribution,
   target date/opened-at/current-date status, property timezone or target seal after
   request; each fails with zero mutation. At exactly 30 minutes and later, pending,
   rejected, expired, self-decided, unauthorized-decider and post-expiry approval all
   fail.
4. **Tenant/lineage hostility:** mixed tenant/property/room/discrepancy/day/approval/
   actor ids, same UUIDs, forged payload/date/hash, ambiguous/missing/multiple report
   events, foreign scopes and inactive actors fail closed. Cross-tenant reads return
   zero and raw direct writes fail.
5. **Atomic effect:** one success leaves the old row resolved exactly
   `carried_forward`, one same-room linked unresolved target, one immutable carry, one
   fact and one outbox event; neither day changes. Failure injected after every
   mutation/fact/event/deferred commit rolls back all and permits one clean retry.
6. **Concurrency/idempotency:** exact replay is byte-stable; changed-key content
   conflicts; twenty same/different-key contenders and two approvals converge to one
   target/carry/effect. Approval, source discrepancy and target id cannot be reused.
7. **Monetary isolation:** hostile posting, journal, account, folio, payment, currency,
   amount, tax, document and balance inputs are rejected/absent; pre/post financial
   sums and immutable ledgers are byte-identical.
8. **Authority/schema:** fresh PostgreSQL proves exact 63/116/106/15/2 catalogue,
   tenant-leading constraints/indexes, forced RLS, insert-only carry evidence,
   fixed-search-path owner/caller ACLs and hostile-`pg_temp` resistance.
9. **Preservation/review:** focused discrepancy reporting, Order349 readiness,
   approval/idempotency/fact/outbox and adjacent financial/stay suites, standing
   static/schema gates and fresh referee `11/11` pass. A different Tier-3 reviewer
   personally executes tenancy, lineage, expiry/authorization, concurrency and
   rollback proof before approval.

## Forbidden

- business-day seal, readiness calculation/change, reopen, roll, automatic carry,
  forced close or mutation of either day's timestamps;
- ordinary discrepancy resolution, dismissal, editing, deletion, target recapture,
  batch carry, generic approval inbox or approval-policy changes;
- journal/posting/account/folio/payment/tax/document/statutory/channel mutation or
  monetary input/evidence;
- HTTP/API/operator/UI, local promotion, Docker, `.yellow`, port3000, merge, push,
  deployment or Phase/application-complete claim;
- payload-derived property/date authority, caller clock/hash/actor/status authority,
  direct application discrepancy/carry DML or weakening current RLS/ACLs.

## Definition of done

- [ ] Activation revalidates the post-Order350 migration and catalogue frontier.
- [ ] Intentional red precedes all production implementation.
- [ ] Exact approval, freshness, one-use and current-open-target policy is executable.
- [ ] The old/new/link/fact/event transition is atomic, tenant-contained and leaves
      both days unsealed.
- [ ] Replay, races, expiry, stale state and injected rollback proof is green.
- [ ] Exact schema, standing/static and fresh-referee gates pass without weakening.
- [ ] Fresh independent non-implementing Tier-3 approval is recorded.

## Activation gap

Order349's current readiness contract recognizes unresolved discrepancies only through
their canonical `discrepancy.reported` event. D990 requires exactly one canonical
`discrepancy.carried` event for this transition, so the carried target would be
unknown/fail-closed to that read model until a separate, explicitly scoped readiness
contract admits the typed carry link/event. This order does not silently widen into
readiness. Activation must record that follow-on dependency; it is not authority to
emit an extra report event or weaken fail-closed attribution.

Creation of this draft grants no implementation authority. Completion grants only the
governed carry transition; no seal, readiness override or financial mutation follows.
