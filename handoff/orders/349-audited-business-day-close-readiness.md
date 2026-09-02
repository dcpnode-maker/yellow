# Order 349 — Audited business-day close readiness

**Status:** ACTIVE-INTENTIONAL-RED-D994  
**Phase:** 5 — Financials  
**Branch:** `phase-5/audited-business-day-close-readiness`  
**Base:** `3638c96` (D990/D991 founder policy ratification)  
**Risk tier:** 3 — tenant-scoped financial close evidence and cross-context attribution  
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Return one immutable PostgreSQL-authoritative readiness snapshot for one exact
tenant, property and already-open unsealed backlog `business_day`. The snapshot
explains every blocker without changing any row. It admits only relationally and
column-attributed evidence, applies D990's strict five-minute unpublished-outbox
boundary, and reports any persisted financial, fiscal, statutory or channel work
that lacks safe exact property/date attribution as `unknown` and therefore not ready.

This is the continuously visible **readiness** closure only. It neither carries a
discrepancy nor seals, reopens, rolls, repairs or otherwise changes a business day.
It is an informational snapshot; the later audited seal command must load and
revalidate the same authoritative evidence inside its own guarded transaction.

## Ratified policy and natural solution

D990 binds the complete policy:

- outbox lag is the age of the oldest unpublished exact-property,
  exact-business-date event and is acceptable only when strictly below five minutes;
  no exact-target unpublished event is zero lag;
- only persisted safely attributed financial, fiscal, statutory and channel-delivery
  work may be classified as an exact target-day interface blocker;
- missing safe property/date attribution is explicit unknown/fail-closed; and
- payload JSON is never parsed or trusted for property, date, status, queue or
  ownership authority.

The natural solution needs **no migration, table, view, function, capability, event,
permission or direct grant**. `app_role` already has RLS-protected `SELECT` authority
for the relevant rows, and existing services establish the accepted pattern of one
typed read model executing a single CTE statement inside
`Database.withTenantTransaction`. One statement gives a coherent PostgreSQL snapshot
at one transaction-stable `transaction_timestamp()` without inventing a second
authority surface. A new SECURITY DEFINER read function would add owner-mediated
schema authority with no least-privilege benefit; separate application queries would
allow cross-statement drift. Preserve the exact approved catalogue at **61 migrations,
111 public base tables, 101 tenant RLS tables/policies, 10 FORCE-RLS tables and 2
views**.

The read model may join existing primitives solely to establish relational
attribution. It must not import another context's internal TypeScript module, write a
projection, infer state from a cache, or promote any payload field to authority.

## Exact request contract

`BusinessDayCloseReadinessService.read(input)` accepts an exact plain object:

```ts
interface BusinessDayCloseReadinessInput {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly businessDate: string; // canonical YYYY-MM-DD backlog day selected by staff
  readonly actorId: string;      // server-derived authenticated actor, never body authority
}
```

It accepts no readiness boolean, threshold, clock, timezone, status, count, queue
selection, force, carry, approval or seal input. The service:

1. enters one transaction-local tenant context;
2. proves the actor is active in that tenant and the exact node is a same-tenant
   property;
3. proves the exact `(tenant,property,business_date)` row exists and is unsealed;
4. executes one CTE statement whose time boundary is PostgreSQL
   `transaction_timestamp()`;
5. validates the exact returned shape, supported source/status vocabulary, integers,
   UUIDs, dates and instants; and
6. returns a deeply frozen immutable result.

Missing, foreign, non-property, sealed or actor-incoherent targets fail closed as
unavailable. RLS denial and not-found remain indistinguishable. A sealed day never
returns `ready: true`, even when all other counts are zero.

## Exact immutable result

The public result is structurally equivalent to:

```ts
type ReadinessReasonCode =
  | "unresolved_due_in"
  | "unresolved_due_out"
  | "open_cashier_session"
  | "unresolved_discrepancy"
  | "outbox_lag_exceeded"
  | "financial_interface_pending"
  | "fiscal_interface_pending"
  | "statutory_interface_pending"
  | "channel_delivery_pending"
  | "source_attribution_unknown";

interface ReadinessReason {
  readonly code: ReadinessReasonCode;
  readonly source:
    | "reservations" | "cashiers" | "discrepancies" | "outbox"
    | "financial" | "fiscal" | "statutory" | "channel";
  readonly count: number;
}

type OutboxLag =
  | { readonly kind: "none"; readonly ageMilliseconds: 0 }
  | {
      readonly kind: "within_threshold" | "over_threshold";
      readonly oldestCreatedAt: string;
      readonly ageMilliseconds: number;
      readonly thresholdMilliseconds: 300000;
    }
  | { readonly kind: "unknown"; readonly count: number };

interface BusinessDayCloseReadiness {
  readonly tenantId: string;
  readonly propertyNode: string;
  readonly businessDate: string;
  readonly capturedAt: string;
  readonly ready: boolean;
  readonly reasons: readonly ReadinessReason[];
  readonly counts: {
    readonly unresolvedDueIn: number;
    readonly unresolvedDueOut: number;
    readonly openCashiers: number;
    readonly unresolvedDiscrepancies: number;
    readonly financialInterface: number;
    readonly fiscalInterface: number;
    readonly statutoryInterface: number;
    readonly channelDelivery: number;
    readonly unknownAttribution: number;
  };
  readonly outboxLag: OutboxLag;
}
```

Reasons are unique and returned in the fixed order above; counts are non-negative
safe integers. `ready` is derived only as: target is open/unsealed, every exact
blocker count is zero, unknown attribution is zero, and outbox lag is `none` or
`within_threshold`. The application never accepts or persists a caller-computed
result. Do not expose payloads, guest data, payment tokens, fiscal/statutory payloads,
queue bodies or arbitrary source error text.

## Exact authoritative source rules

### Open target

The target is the exact unsealed `business_day` selected by its typed composite
identity. It may be older than the current property-local day; multiple unsealed
backlog days remain valid. Readiness neither derives a different day nor requires the
target to be the newest open row.

### Due-in and due-out

Current `reservation.status='due_in'` or `'due_out'` is attributed to the target day
only through its canonical outbox transition row: same tenant, exact property,
`aggregate_type='reservation'`, exact reservation id, respectively
`event_type='reservation.due_in'` or `'reservation.due_out'`, and exact typed
`outbox.business_date`. The latest applicable transition by `seq` owns current
attribution. Payload is never inspected.

A current due state with no canonical matching transition, a null/foreign property,
or otherwise incoherent relational lineage is unknown/fail-closed. A safely
attributed current due state on another exact property/date is not a blocker for this
target. Reservation segment timestamps and the property's *current* timezone must
not be used to reconstruct historical transition authority.

### Cashiers

`cashier_session` is safely attributable through its typed tenant,
`property_node` and `business_date`. `closed_at IS NULL` on the exact target is a
blocker. Closed sessions and exact other-day/property sessions are not. Incoherent
foreign/missing relational targets are unknown, not silently ignored.

### Discrepancies

An unresolved `discrepancy` (`resolved_at IS NULL`) is property/date attributable
only through both:

- its same-tenant `space.property_node`; and
- its canonical same-tenant `discrepancy.reported` outbox row with
  `aggregate_type='discrepancy'`, exact discrepancy id, matching property and typed
  `business_date`.

Exactly one creation event is required. Missing, duplicate, null-property, foreign or
mismatched evidence is unknown/fail-closed. `reported_at`, the current property
timezone and payload fields are not substitutes for the recorded business date.
Resolved discrepancies do not block this snapshot; a later separately scoped order
will govern any future carry transition and lineage.

### Outbox lag

Among unpublished rows (`published_at IS NULL`) safely matching the exact tenant,
property and business date, use `min(created_at)`. Age is
`transaction_timestamp() - oldest_created_at`; it is acceptable only when
`0 <= age < interval '5 minutes'`. Exactly five minutes and any older age block.
No matching unpublished row returns `kind:'none'` and zero lag. A future-created row,
null property, missing/foreign property relationship or otherwise unsafe target/date
attribution is `unknown` and fails closed. Event payload and sequence distance never
stand in for elapsed time.

### Financial interface work

The currently persisted provider-work head is a `payment` attempt. A row with
`status='pending'` is unresolved work. Its `payment_operation.property_node` safely
attributes property, but the pending attempt has no authoritative typed
`business_date` (and intentionally has no journal yet). Therefore it is **unknown**
and fails closed; `created_at`, folio history, operation request JSON and a guessed
current day may not assign it to the target. Succeeded/failed attempts and hosted
requests merely awaiting guest action are not pending interface work for this gate.

If a future separately approved schema adds typed property/date delivery authority,
this contract must be amended explicitly; Order349 does not add it.

### Fiscal interface work

`fiscal_submission` statuses `pending`, `submitted`, `rejected` and `error` are
unresolved. They are safely attributable only by joining their exact same-tenant
`document`, whose typed `property_node` and `business_date` both match the target.
`cleared` and `accepted` are successful terminal evidence. Missing/foreign documents,
null property/date, or unsupported relational/status evidence is unknown/fail-closed.
Neither `document.content` nor `fiscal_submission.response` is parsed.

### Statutory interface work

`statutory_submission` statuses `pending`, `submitted` and `failed` are unresolved;
`accepted` and `not_required` are terminal for readiness. The row has a typed property
but no typed business date. Consequently every unresolved current row is unknown and
fails closed rather than being assigned from `due_at`, reservation periods, payload,
receipt or the property's current timezone. Exact future business-date attribution
belongs to the later statutory phase, not this order.

### Channel-delivery work

The current schema has no persisted outbound delivery row carrying typed channel,
property and business date together. `push_cursor` has property/channel but no
business date; `ari.push_requested` outbox rows have property/date but no typed target
channel; `inbound_message` has channel/status but no property/date. Therefore an
unconsumed/pending/error channel work item that cannot be related using typed columns
alone is unknown/fail-closed. Do not parse `outbox.payload` or
`inbound_message.payload`, assume one configured channel, apply one cursor to every
channel, or call inbound receipt outbound delivery success. Exact future outbound
delivery attribution requires a separately authorized Phase9 schema/order.

## Concurrency and time boundary

The complete snapshot is one SQL statement in one tenant transaction and uses one
PostgreSQL transaction timestamp. It takes no row locks and has no mutation or seal
authority. A concurrent state change may become visible only on the next read; the
returned snapshot remains internally coherent and truthfully stamped `capturedAt`.
It is never a reusable authorization token. The later seal order must re-run the
loader under its own prescribed locking/serialization boundary immediately before
the guarded seal, and must reject changed evidence. Order349 must not add that lock or
promise that `ready:true` remains true after return.

## Exact scope

- `src/contexts/financials/business-day-close-readiness.ts`;
- `src/contexts/financials/index.ts`;
- `tests/business-day-close-readiness.test.ts`;
- `tests/business-day-close-readiness.integration.test.ts`;
- `tests/business-day-close-readiness.intentional-red.test.ts`;
- business-day-readiness-only wording in `docs/CONTRACTS.md`,
  `docs/STATE-MACHINES.md`, `BUILD-PLAN.md`, `handoff/PHASE-5-PLAN.md` and
  `handoff/ROADMAP.md`;
- this order, `handoff/reviews/349-audited-business-day-close-readiness.md`,
  `DECISIONS.log` and `handoff/LEDGER.md`.

There is deliberately no migration/schema snapshot/setup catalogue allocation in
scope because no database object changes. Any apparently required source, status,
column, permission, function or file outside this list requires a recorded pre-commit
scope amendment or question; do not widen silently.

## Hostile executable proof

### P0 — intentional red

Before production implementation, prove the service/export and exact typed source
classification are absent. Preserve the failing focused test result in governance
evidence.

### P1 — target, tenant and actor containment

On fresh PostgreSQL61, prove exact same-tenant active actor, active property and open
target day succeed. Missing/inactive/foreign actor, missing/foreign/non-property node,
absent day, sealed day, malformed tenant context and tenant/input mismatch all fail
closed without revealing which parent was foreign. Prove direct cross-tenant rows and
RLS-hostile fixtures cannot affect counts or become visible.

### P2 — exact operational blockers

For each due-in, due-out, open cashier and unresolved discrepancy source, prove one
exact target blocker, exact other-property/date exclusion, resolved/closed exclusion,
multiple-row counting and deterministic reason order. Remove or mismatch the canonical
outbox lineage for due/discrepancy fixtures and prove unknown/fail-closed. Prove
timezone changes and forged transition/discrepancy payload dates cannot change typed
attribution.

### P3 — exact five-minute lag

Using database-controlled instants, prove no exact-target unpublished event is zero
lag; 4m59.999s is within threshold; exactly 5m and older block; future, null-property,
foreign-property and malformed-attribution rows are unknown. Published, other exact
property/date and newer non-oldest rows behave correctly. Payload dates and sequence
distance do not affect age.

### P4 — interface classification and fail-closed unknown

Prove pending payment work cannot acquire a business date from created time, folio or
payload and is unknown; final attempts and passive guest hosted requests do not block.
Prove fiscal unresolved/success statuses against exact typed documents, including
null/missing/foreign document attribution. Prove unresolved statutory work remains
unknown despite forged due/payload/receipt dates. Prove channel cursor, inbound and
ARI payload forgeries cannot create safe attribution; unresolved typed-incomplete
work is unknown. Unsupported/impossible database result shapes fail closed in the
TypeScript decoder.

### P5 — immutability, one-statement coherence and no authority

Prove the result and every nested collection/object are frozen; mutation attempts do
not change them. Instrument the database port to prove one tenant transaction and one
snapshot statement. Concurrently resolve/publish/close after snapshot acquisition and
prove the captured result remains coherent while a subsequent read changes; never
claim it authorized a seal. Assert zero changes to business_day, reservation,
cashier, discrepancy, payment, document/submission, cursor/inbound, fact, outbox,
idempotency and approval rows.

### P6 — permanent and independent gates

Run focused readiness tests plus existing business-day roll/seal authority, due-in,
due-out, cashier, discrepancy, payment, fiscal/statutory schema and outbox regressions;
exact migration/schema/database-acceptance/runtime-authority/SECURITY-DEFINER gates;
typecheck, boundaries, licences, audit, the full standing suite; and fresh
`./setup.sh --db-only` referee `11/11`. A fresh independent non-implementing Tier-3
reviewer personally executes the tenant/actor, attribution, five-minute boundary,
unknown-source, payload-hostility, concurrency and zero-write proofs on the exact
candidate and records commands/results before approval.

## Forbidden

- discrepancy resolution/carry/linkage/approval, business-day seal/reopen/roll,
  cashier close, reservation transition, interface retry/drain/acknowledgement or any
  other write;
- migration0062 or any migration/schema/view/function/table/column/index/policy/role,
  permission, event, fact, outbox, idempotency or approval change;
- payload JSON parsing or `->>`/JSON-path authority; timestamp/current-time/timezone
  reconstruction where typed business-date evidence is absent; caller/browser,
  JavaScript clock, process timezone, Valkey, projection or cache authority;
- HTTP/API/operator/UI/dashboard route, local seed/status/promotion, credentials,
  `.yellow`, Docker, stable Order335, port3000, merge, push, deployment or Phase5/app
  completion claim;
- weakening exact catalogue, standing, static or referee oracles because this order
  changes no schema.

## Definition of done

- [ ] Intentional red precedes production implementation and is recorded.
- [ ] Exact open backlog-day snapshot is tenant/property/actor bound, immutable,
      PostgreSQL-authored and read-only.
- [ ] Due/cashier/discrepancy and outbox-lag evidence follows the exact typed rules,
      including strict `< 5 minutes`.
- [ ] Financial/fiscal/statutory/channel work is exact when safely attributable and
      explicit unknown/fail-closed otherwise, with zero payload authority.
- [ ] Exact `61/111/101/10/2` catalogue and every permanent gate remain unchanged and
      green; fresh referee prints `11 passed, 0 failed of 11`.
- [ ] Fresh independent non-implementing Tier-3 review and reviewer-run executable
      proof are recorded before approval.
