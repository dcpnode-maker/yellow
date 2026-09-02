# Order 356 — Audited business-day seal

**Status:** DRAFT — activation required after approved Orders349/352 and
independently approved Orders351/355  
**Phase:** 5 — Financials  
**Branch:** `phase-5/audited-business-day-seal`  
**Base:** activation must bind the exact approved post-Order355 frontier  
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

## Authority and activation prerequisites

No intentional red, production edit or test edit is authorized until activation
records all of the following against one exact commit frontier:

- Order349 and Order352 are approved at the exact D1004 ancestry;
- Order351's carry table, capability, event and atomic proof are independently
  approved;
- Order355's carried-lineage readiness extension is independently approved;
- the actual post-351/355 function, table, typed outbox columns, readiness query,
  decoder, context export and focused tests have been re-read, not inferred from
  these drafts; and
- the exact migration allocation, catalogue counts, file list and review ancestry
  are amended here if the actual frontier differs.

The draft currently expects the next migration after the approved carry frontier to
be `0064_audited_business_day_seal.sql`. This is a reservation, not an allocation:
activation must recalculate the migration and catalogue frontier and stop on any
collision. Assuming Orders350/351 remain as contracted and Orders355 is migration-
free, the provisional post-build catalogue is 64 migrations, 116 public base
tables, 106 tenant-RLS tables/policies, 15 FORCE-RLS tables and 2 views; no count is
authority until activation rechecks it.

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

## Exact command contract (provisional pending activation gaps)

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

An exact replay must never append a second fact/event. A divergent reuse of the
same idempotency key must conflict. The already-sealed-day behavior must be bound
at activation (see policy gaps below), not silently selected from the legacy
owner-only function's current `P0012` behavior.

The result contains only tenant/property/day identity, prior state, sealed state,
database-authored `sealedAt`, actor identity and canonical idempotency/evidence
identity. It exposes no readiness source rows, payloads, guest data, payment
tokens, queue bodies or arbitrary database error text.

## Database capability and evidence

Migration0064 may add exactly one fixed-search-path `SECURITY DEFINER` capability
(provisional name `seal_business_day_audited`) and no table, view, event, trigger,
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

The fact uses the established `business_day` entity/fact vocabulary and the event
uses the already registered `business_day.sealed` type with typed tenant, property,
business-date, actor, correlation and database-authored seal instant. Payload is
minimized identifier/state evidence only. Exact fact type, payload keys, event
version and idempotency/evidence binding must be fixed at activation from the
existing event/fact conventions; this draft does not invent a second event.

## Exact scope (to be made final at activation)

- `migrations/0064_audited_business_day_seal.sql` (or the exact collision-free
  successor allocated at activation);
- one financials seal service and the existing financials context export;
- the transaction-bound readiness loader seam only where needed to reuse the
  approved Order349/352/355 query without changing its public result or semantics;
- focused intentional-red, unit, fresh-PostgreSQL, authorization, concurrency,
  rollback, idempotency and zero-write/atomic-evidence tests;
- directly affected migration, schema, database-acceptance, runtime-authority,
  runtime-DML and SECURITY-DEFINER containment oracles;
- seal-only wording in `docs/CONTRACTS.md`, `docs/STATE-MACHINES.md`,
  `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`, `BUILD-PLAN.md`,
  `handoff/PHASE-5-PLAN.md` and `handoff/ROADMAP.md`;
- this order, its independent review and activation evidence.

No HTTP/API/operator/UI route, browser authority, local promotion, seed, Docker,
`.yellow`, stable port3000, deployment, merge or Phase/application completion claim
is in scope. Any required file outside the activated list requires a scope question
or recorded amendment before editing. `migrations/0001_init.sql`, DECISIONS.log and
`handoff/LEDGER.md` are not edited by this draft.

## Activation policy gaps — do not invent

D990 resolves readiness, interface attribution and discrepancy carry, but it does
not specify the following seal-specific policy. Activation must obtain a founder or
already-authoritative decision for each item, record the answer in the activation
amendment, and then freeze the implementation contract:

1. **Seal authorization:** the exact property-scoped permission/scope for the actor
   and whether seal is single-actor or requires a separate maker/checker approval.
   Question179 says “audited actor-bound seal command” but does not choose either
   model; existing Security text only names approval as a gate and does not define
   its binding.
2. **Serialization boundary:** the exact rows/locks or transaction isolation that
   make all Order349/355 sources and concurrent posting, cashier, discrepancy,
   interface and outbox changes reject/retry rather than letting readiness drift
   between the re-read and latch. Existing readiness is intentionally lock-free and
   Order349 expressly leaves this boundary to the later seal order.
3. **Replay and already-sealed behavior:** whether same-key replay returns the
   original result, whether a different key on an already-sealed day is a stable
   idempotent no-op or conflict, and the exact error/status mapping for missing,
   stale, sealed and concurrent targets. The state model says sealing is deterministic
   and idempotent, while the legacy function currently raises `P0012`.
4. **Canonical audit evidence:** exact fact discriminator, minimized payload keys,
   event version, causation/correlation binding and whether the approved service or
   capability owns the fact/outbox insert. Existing `business_day.sealed` is
   registered, but no audited application seal evidence shape is specified.
5. **Readiness-source closure:** after Orders351/355, the exact typed carry-link and
   event columns/constraints and resulting catalogue must be re-read; this order
   cannot assume draft names or treat any unresolved source as safe merely because
   the old Order349 snapshot was ready.

These are the exact gaps. Until they are resolved and activation records the
resulting contract, the legacy owner-only seal remains the only executable seal
authority and no application seal capability may be added.

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
  DECISIONS.log or `handoff/LEDGER.md`, self-review, merge, push or Phase/application
  completion claim.

## Definition of done

- [ ] Activation binds approved Orders349/352 and independently approved Orders351/355,
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

Creation of this draft grants no implementation or seal authority. Completion would
grant only the exact audited application seal command; it would not complete Phase 5
or the application.
