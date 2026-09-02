# Order 356 — Audited business-day seal

**Status:** ACTIVE-D1066
**Phase:** 5 — Financials  
**Branch:** `phase-5/audited-business-day-seal`  
**Base:** exact approved Order374 governance tip
`74ce41c743212419b251e5a333dce5b1504012db`; unchanged product frontier
`c988e8885aabc0eb9063e12a54543e4767cedb1c`
**Risk tier:** 3 — tenant-scoped financial close transition, immutable evidence and
concurrent posting/close authority  
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Add the smallest audited application seal command for one exact tenant, property and
already-open backlog `business_day`. The command must acquire the guarded financial
lock, re-run the complete Order349/352/355 readiness and carried-discrepancy
lineage evidence in that same transaction, and seal only when the PostgreSQL result
is ready. The one-way `business_day` transition, its minimized fact and the canonical
`business_day.sealed` outbox event commit atomically or all roll back.

This order does not change readiness semantics, carry behavior, roll, reopen,
posting, correction, cashier, interface, fiscal or statutory behavior. A readiness
snapshot returned by an earlier read is never a seal token. The legacy
`seal_business_day(uuid,uuid,date,uuid)` remains owner-only; `PUBLIC`,
`yellow_runtime` and `app_role` retain no execute privilege on it, and `app_role`
retains no direct `business_day` DML.

## Authority and satisfied activation prerequisites

Order349/352 are approved at D1004; Orders351/359/363/366/368 are approved at
D1043; Orders355/373 are approved and closed at D1059/D1060. Activation re-read the
actual carry table/capability/event, typed outbox columns, readiness query/decoder,
context export, focused proof and migration catalogue at exact frontier D1065.
Migration `0064_audited_business_day_seal.sql` is allocated. Post-build catalogue is
exactly 64 migrations, 116 public base tables, 106 tenant-RLS tables and policies,
15 FORCE-RLS tables and two views.

## Ratified policy and natural solution

D990 and approved Orders349/352/351/355 are the only close policy authority:

- exact-property/exact-business-date unpublished outbox age is acceptable only
  strictly below five minutes; no matching unpublished row is zero lag;
- only safely attributed persisted financial, fiscal, statutory and channel work
  blocks; unsafe attribution is `unknown` and fails closed;
- payload JSON is never parsed for authority;
- ordinary discrepancies use the approved reported lineage, while a carried target
  requires exactly one approved immutable carry link and exactly one canonical typed
  `discrepancy.carried` event; and
- carry itself is separate, one-use and approval-bound and never seals either day.

The service must use the exact activated Order349/352/355 readiness loader inside
`Database.withTenantTransaction`, after entering transaction-local tenant context
and the governed runtime `app_role`. It must not call the public read method in a
nested transaction, accept a caller readiness boolean/hash/count, parse an event
payload, or reuse a prior snapshot. The loader and the guarded seal mutation must
share one PostgreSQL transaction timestamp and serialization boundary.

The owner-mediated capability is a narrow mutation choke point. It accepts no
caller seal instant, readiness result, threshold, timezone, current date, force,
reopen, payload or queue input. It independently binds tenant context, active
actor, exact same-tenant property and exact day, locks the day in the canonical
financial lock order, and performs only the unsealed-to-sealed latch. The service
then appends one minimized fact and one `business_day.sealed` outbox row in that
same transaction. Any capability, fact, event, idempotency or commit failure rolls
back the seal.

## Exact command contract

`BusinessDaySealService.seal(tx,input)` accepts only an exact server-bound object:

```ts
interface BusinessDaySealInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly businessDate: string; // exact existing backlog day; never derived by caller
  readonly actorId: string;       // authenticated server actor; never body authority
  readonly idempotencyKey: string;
  readonly audit: AuditEnvelope; // server-created correlation/causation evidence
}
```

The command must:

1. enter one transaction-local tenant context and prove the active actor, exact
   same-tenant property and exact open day;
2. acquire the exact day/financial serialization boundary before loading readiness;
3. re-run the complete activated readiness CTE/decoder, including carried lineage,
   with PostgreSQL `transaction_timestamp()` and no caller-supplied authority;
4. fail closed for any blocker, `source_attribution_unknown`, missing/foreign/
   ambiguous lineage, changed target, sealed/missing day, invalid actor/permission,
   stale idempotency content or any unsupported result shape;
5. invoke only the new bounded owner-mediated seal capability; and
6. append exactly one immutable `fact_log` row and one canonical
   `business_day.sealed` outbox row, returning a deeply frozen bounded result whose
   `sealedAt` is database-authored.

The durable operation is `financials.business-day.seal`; its request identity is
exactly actor, property and business date. Exact same-key/content replay returns the
stored byte-identical 200 receipt with `replayed: true` and no second effect. Divergent
same-key reuse conflicts. A different key against an already-sealed, missing or stale
day conflicts rather than becoming a no-op. Concurrent distinct keys yield exactly one
success; every loser conflicts.

The result is exactly tenant/property/day identity, `previousState: "open"`,
`state: "sealed"`, database-authored `sealedAt`, actor identity and `replayed`. It
exposes no readiness source rows, payloads, guest data, payment tokens, queue bodies
or arbitrary database error text.

## Database capability and evidence

Migration0064 adds exactly one fixed-search-path `SECURITY DEFINER` capability
`seal_business_day_audited(uuid,uuid,date,uuid)` and no table, view, event, trigger,
role or generic approval surface. The capability is owned by `yellow_owner`, has
`SET search_path = pg_catalog, public, pg_temp`, schema-qualifies every relation and
helper, and is executable only by a `yellow_runtime` session after it has assumed
`app_role`; `PUBLIC` and `yellow_runtime` direct execution are denied. Its function
signature and returned fields must be frozen at activation.

The capability must reject invalid transaction tenant context, null or malformed
inputs, inactive/foreign/non-property targets, inactive or foreign actors, missing
or already-sealed days, and direct deployment-owner/runtime bypasses. It must lock
and revalidate the exact row, update only `sealed_at` and `sealed_by` on the winning
unsealed row, derive `sealed_at` from PostgreSQL transaction time, and return only
database-authored seal evidence. It must not call the legacy function or grant
`app_role` execute on it. Direct `INSERT`, `UPDATE`, `DELETE` and `TRUNCATE` on
`business_day`, `fact_log` and `outbox` remain denied except for their existing
sanctioned privileges.

The service, not the capability, owns idempotency, fact and event publication in the
same transaction. The fact is `entity_type=business_day`, `entity_id=propertyNode`,
`fact_type=business_day.sealed`; the version-1 event uses the same type,
`aggregate_type=business_day`, `aggregate_id=propertyNode`, the audit correlation,
null causation, typed property/date/actor, and the same minimized payload:
`{property_node,business_date,previous_state:"open",state:"sealed",sealed_at,sealed_by}`.
The established fact writer may additionally bind its server-authored request id.

## Exact activated scope

- `migrations/0064_audited_business_day_seal.sql`;
- `src/contexts/financials/business-day-seal.ts`,
  `src/contexts/financials/business-day-close-readiness.ts` only for a byte-equivalent
  shared readiness fragment if required, and `src/contexts/financials/index.ts`;
- `tests/business-day-seal.test.ts`, `tests/business-day-seal.integration.test.ts`;
- directly affected `tests/migrate.integration.test.ts`,
  `tests/database-acceptance.integration.test.ts`,
  `tests/security-definer-containment.integration.test.ts`, and only if their exact
  catalogues require it, runtime-database-authority/runtime-DML oracles;
- `setup.sh` only for the exact migration/table catalogue assertion;
- seal-only wording in `docs/CONTRACTS.md`, `docs/STATE-MACHINES.md`,
  `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`, `BUILD-PLAN.md`,
  `handoff/PHASE-5-PLAN.md` and `handoff/ROADMAP.md`;
- this order, its independent review and activation evidence.

No HTTP/API/operator/UI route, browser authority, local promotion, seed, Docker,
`.yellow`, stable port3000, deployment, merge or Phase/application completion claim
is in scope. This order, its review, `DECISIONS.log` and `handoff/LEDGER.md` are
governance scope. Any other file requires a scope question or recorded amendment.
`migrations/0001_init.sql` remains immutable.

## Resolved activation authority — D1066

The founder explicitly approved both recommended actor policies. One active,
authenticated, same-tenant property-scoped actor whose role grants the existing
`business_day.seal` permission may seal directly. There is no maker/checker approval
for this command. Phase-7 evidence later uses the same authenticated property-scoped
fiscal actor rather than an unattended internal job.

At activation the exact frontier is 63 migrations through 0063, 116 public base
tables, 106 tenant-RLS tables/policies, 15 FORCE-RLS tables and two security-invoker
views. Migration0064 adds one function only, producing exact catalogue
64/116/106/106/15/2.

Serialization is database-enforced inside the capability before readiness. It takes
fixed-lexical SHARE ROW EXCLUSIVE locks over every mutable authorization/readiness relation derived
from the final CTE (including actor, tenant, property, role grant, day, reservation,
cashier, discrepancy/carry, payment/operation, document, fiscal/statutory submission,
inbound message and outbox sources), then locks the exact business-day row `FOR UPDATE`,
reruns the complete Order349/352/355 readiness predicate at one
`transaction_timestamp()`, and latches only a ready open day. A permanent assertion
must fail if the final readiness/auth query adds a mutable relation without adding it
to the lock set. The public lock-free read service remains unchanged and is never a
seal token.

## Hostile executable proof

### P0 — intentional red and exact frontier

On the activated post-Order355 frontier, prove the new service/export and audited
capability are absent before implementation. Preserve only this expected red and
bind the approved Order349/352/351/355 ancestry and exact catalogue.

### P1 — readiness is rerun and fail-closed

Use one real PostgreSQL transaction to create every approved ready and blocking
source: due-in/out, open cashier, ordinary reported discrepancy, valid carried
discrepancy, strict 4m59.999s/exact-five-minute/future outbox lag, each typed
interface blocker, unknown attribution, missing/duplicate/mixed/foreign carry
lineage and forged payloads. Only the exact zero-blocker, safely attributed,
unsealed target seals. Earlier snapshots, caller booleans/hashes, payload dates,
current timezone and cache/projection data cannot authorize it.

### P2 — tenancy, actor, permission and capability containment

Prove missing/inactive/foreign actor, tenant/property/day mismatch, non-property,
missing/sealed target, invalid tenant context, unauthorized scope, direct
`app_role` call to legacy `seal_business_day`, direct DML, `PUBLIC`/runtime bypass,
hostile `pg_temp`, and deployment-owner misuse fail closed with zero mutation.
Prove the new capability is fixed-search-path, owner-owned and exposes only its
declared fields.

### P3 — race, lock and one-way latch

Race a seal against posting, correction, cashier/discrepancy transition, carry,
outbox publication and another seal. The guarded transaction must either observe a
coherent ready snapshot and win once or fail/retry closed; it must never seal over a
new blocker. A sealed day admits only the existing adjustment/correction journal
exceptions, never a second seal or reopen.

### P4 — atomic evidence, replay and rollback

One success produces exactly one sealed row, one fact and one canonical event with
matching database-authored tenant/property/date/actor/correlation evidence. Inject
failure after lock, readiness, latch, fact, event and deferred commit; every effect
rolls back and one clean retry succeeds. Exact idempotent replay is byte-stable,
divergent-key reuse conflicts, and no duplicate evidence appears under twenty
concurrent contenders.

### P5 — preservation and permanent gates

Re-run the complete Order349/352/351/355 readiness, carry, posting, correction,
cashier, outbox, RLS, runtime-authority, runtime-DML and SECURITY-DEFINER suites;
prove unchanged carry/readiness result shape and no unrelated table mutation. Run
typecheck, boundaries, licences, audit, full standing/static gates, exact activated
schema/catalogue and fresh `./setup.sh --db-only` referee `11 passed, 0 failed of
11`.

### P6 — independent high-risk review

A fresh independent non-implementing Tier-3 reviewer must personally execute the
frontier, readiness-rerun, unknown/fail-closed, actor/tenant/permission,
serialization/race, capability containment, one-way latch, rollback, atomic
fact/event, replay and zero-write proofs on the exact candidate. Record reviewer,
commands, outputs, findings and clean disposable-resource teardown in
`handoff/reviews/` and only then approve this order. Implementer-pasted results are
not proof.

## Forbidden

- granting execute on legacy `seal_business_day` to `app_role`, or granting direct
  business-day/fact/outbox mutation to the application/runtime;
- accepting caller readiness, hashes, counts, timestamps, threshold, timezone,
  current date, force, approval, queue state or payload JSON as authority;
- sealing without the complete same-transaction Order349/352/355 revalidation;
- changing D990 readiness/lag/interface/carry policy, ordinary or carried lineage,
  migration0063, event vocabulary, posting/correction exceptions or roll behavior;
- reopen, auto-seal, batch seal, historical catch-up, queue drain, reconciliation,
  journal/payment/tax/fiscal/document/statutory/channel mutation or new generic
  approval authority;
- HTTP/UI/local/deployment/`.yellow`/stable-port changes, edits to `migrations/0001_init.sql`,
  self-review, merge, push or Phase/application
  completion claim.

## Definition of done

- [x] Activation binds approved Orders349/352 and independently approved Orders351/355,
      exact post-frontier catalogue and resolved seal policy gaps.
- [ ] Intentional red precedes implementation and the exact new app capability is
      absent before production edits.
- [ ] One guarded transaction reruns complete readiness/lineage, fails closed on
      every blocker/unknown, and serializes the latch against financial races.
- [ ] Legacy owner-only seal and all direct app/runtime DML denials remain green.
- [ ] One-way seal, one fact and one `business_day.sealed` event are atomic,
      database-authored, tenant-contained, immutable and replay-safe.
- [ ] Full preservation, static/schema/standing/referee gates pass, including fresh
      `11 passed, 0 failed of 11`.
- [ ] Fresh independent non-implementing Tier-3 reviewer executes and records all
      high-risk proof before approval.

Activation grants only the exact implementation and proof above. Completion would
grant only the exact audited application seal command; it would not complete Phase 5
or the application.
