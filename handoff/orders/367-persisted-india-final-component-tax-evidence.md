# Order 367 — Persisted India final component-tax evidence

**Status:** READY-TO-RESUME-ON-APPROVED-B6DACC5-D1188
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** exact current approved coordination head `6bba460`; product frontier includes approved Order353 and migrations through 0068
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

- Orders365/362/361/360/353 are independently approved under D1044.
- Re-run approved Orders341/340/337/310/309 and exact Order350 current-head ancestry
  in one transaction; caller values/hashes never authorize persistence.
- Direct table DML is denied to PUBLIC/runtime/app roles. One fixed-search-path,
  owner-mediated capability is the sole writer under transaction-local tenant
  context, active property-scoped actor, server audit envelope and exact idempotency.
- Exact replay converges; divergent reuse conflicts; different-key races converge by
  locks and uniqueness.
- Order259 semantic routing and Order262 posting remain downstream, not prerequisites.

## Migration allocation

After approved prerequisite Order400, the frontier will be migration0069 and
`119/109/18/2`. This order then owns only forward migration0070. Three new forced-RLS
tables must yield `122/112/21/2`; fresh migration/schema proof must bind those exact
totals and preserve both views.

## Activation gap

D1066 resolves this gap: recording is invoked only by the same active authenticated
property-scoped fiscal actor that finalized the valuation, never an unattended job.
The command reuses exact existing `tax-fiscal.india-valuation:finalize` authority; no
new permission or broader grant is introduced. The capability freshly rechecks this
authority and the actor stored on the current final valuation.

## D1174 prerequisite correction

Executable pre-implementation analysis proved that Order350 persists only the
one-way Order341 evidence hash, not the exact Section14 calendar and typed
component-family ancestry needed for a SECURITY DEFINER writer to reconstruct that
hash. Multiple lawful component families can therefore share the same currently
persisted row shape. Order367 must not guess a family or trust direct app-role
amount/rate/hash claims. It is paused without changing its outcome while prerequisite
Order400 persists independently replayed Order341 evidence as typed immutable
authority. Order367 resumes on that approved root as migration0070; its expected
post-migration catalogue becomes `70/122/112/21/2`.

## Exact activated implementation scope

- `migrations/0070_india_gst_accommodation_final_component_tax.sql`;
- `src/contexts/tax-fiscal/india-gst-accommodation-final-component-tax-recorder.ts`;
- `src/contexts/tax-fiscal/index.ts`;
- `tests/india-gst-accommodation-final-component-tax-recording.intentional-red.test.ts`;
- `tests/india-gst-accommodation-final-component-tax-recording.integration.test.ts`;
- `tests/schema/expected.sql`;
- exact current catalogue/oracle repairs in `setup.sh`,
  `tests/setup-current-catalogue-oracle.test.ts`,
  `tests/database-acceptance.integration.test.ts`, `tests/migrate.integration.test.ts`,
  `tests/app-role-nonlogin.integration.test.ts`,
  `tests/runtime-database-authority.integration.test.ts`,
  `tests/business-day-discrepancy-carry.integration.test.ts`,
  `tests/financial-owner-trust.integration.test.ts`,
  `tests/financial-payments.integration.test.ts`, and
  `tests/financial-postings.integration.test.ts`, plus
  `tests/operator-owner-trust-expense-workbench.integration.test.ts`;
- bounded contract/event documentation in `docs/CONTRACTS.md` and `docs/EVENTS.md`;
- this order, its review, `handoff/LEDGER.md` and `DECISIONS.log`.

The approved pure Order353 calculator remains byte-identical. Any additional path or
behavior requires a recorded scope amendment before editing.

## Required proof

Intentional red; real persisted Order353/350 ancestry; every component family and
threshold/rounding/bigint boundary; stale/manual/zero/gap/reorder/hash/scope/tenant
hostility; correction/fork/replay/race/rollback; complete zero-write census outside
the three tables/fact/outbox/idempotency; RLS/ACL/raw-DML/`pg_temp` containment; exact
catalogue/migration/acceptance/runtime/seed/static/schema/standing/referee11/11; and
fresh independent Tier-3 execution.

## Forbidden

No route, posting, journal, document, fiscal submission, IRP, API/UI/local,
merge, deployment or Phase/application completion authority.
