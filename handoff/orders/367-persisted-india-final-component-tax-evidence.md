# Order 367 — Persisted India final component-tax evidence

**Status:** DRAFT — activation waits approved Orders365/362/361/360/353
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** activation must bind the exact approved post-Order353 frontier
**Risk tier:** 3 — statutory money evidence, tenancy and immutable correction lineage
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Persist the already-calculated, independently approved ordinary-final India
accommodation component-tax evidence before semantic routing or posting. Routing,
posting, documents and IRP must consume server-derived immutable evidence rather than
an ephemeral calculation result.

## Provisional natural schema

One forward migration adds three insert-only, forced-RLS, tenant-leading tables:

1. `india_gst_accommodation_final_component_tax` — exact tenant/property/reservation/
   folio, Order350 valuation identity/generation, INR taxable/tax/grand totals,
   selected family/rate and complete predecessor/evidence hashes, actor/audit fields,
   nullable superseded-result ancestry;
2. `india_gst_accommodation_final_component_tax_room_night` — dense ordinal/date,
   positive final value, selected slab/rate and rounded night tax; and
3. `india_gst_accommodation_final_component_tax_component` — ordered typed
   IGST/CGST/SGST/UTGST component, basis points and rounded INR minor-unit amount.

No authoritative money is stored in JSONB. Corrections append a new root bound to a
new Order350 generation and prior tax root; no row is edited or deleted. A later
posted result cannot be silently replaced.

One minimized `india_gst.accommodation_final_component_tax_recorded` fact/outbox pair
commits atomically with root, children and idempotency receipt. It contains bounded
identity/hash/generation evidence only—not buyer, invoice, route/account, journal or
full amount payloads.

## Authority and dependencies

- Activation waits fresh approval of Orders365/362/361/360/353.
- Re-run approved Orders341/340/337/310/309 and exact Order350 current-head ancestry
  in one transaction; caller values/hashes never authorize persistence.
- Direct table DML is denied to PUBLIC/runtime/app roles. One fixed-search-path,
  owner-mediated capability is the sole writer under transaction-local tenant
  context, active property-scoped actor, server audit envelope and exact idempotency.
- Exact replay converges; divergent reuse conflicts; different-key races converge by
  locks and uniqueness.
- Order259 semantic routing and Order262 posting remain downstream, not prerequisites.

## Migration allocation

Migration0064 remains reserved for draft Order356's audited Phase5 seal. Activation
must re-read the actual frontier and use 0065 only if 0064 has landed; it must never
steal or guess the reservation. From current `116/106/15/2`, three tables would yield
`119/109/18/2`, subject to fresh activation proof.

## Activation gap

Before activation, bind whether recording is invoked only by the same authenticated
property-scoped actor/fiscal-issue workflow that finalized valuation, or may run as an
internal automatic command. No implementation may invent that product/audit policy.

## Required proof

Intentional red; real persisted Order353/350 ancestry; every component family and
threshold/rounding/bigint boundary; stale/manual/zero/gap/reorder/hash/scope/tenant
hostility; correction/fork/replay/race/rollback; complete zero-write census outside
the three tables/fact/outbox/idempotency; RLS/ACL/raw-DML/`pg_temp` containment; exact
catalogue/migration/acceptance/runtime/seed/static/schema/standing/referee11/11; and
fresh independent Tier-3 execution.

## Forbidden

No activation or implementation before dependencies and the audit-actor policy are
resolved. No route, posting, journal, document, fiscal submission, IRP, API/UI/local,
merge, deployment or Phase/application completion authority.
