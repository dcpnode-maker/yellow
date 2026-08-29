# Order 281 — Build exact India GST accommodation-classification evidence

**Status:** READY-D735
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-gst-accommodation-classification`
**Base:** `1e01fe2` (independently approved Order280 descendant)
**Risk tier:** 3 — new tenant/RLS statutory classification root; independent executable review mandatory
**Owner:** Codex implementation

## Outcome

Add one typed SELECT-only tenant/property/jurisdiction classification root and one
exact read-only resolver for explicitly selected Indian accommodation SAC/service
evidence. This is a future item prerequisite only; it does not emit IRP `ItemList`,
`Pos`, `SupTyp` or any tax/document result.

## Natural-Solution Test

`room_revenue`, `GST_ROOM`, USALI mapping, transaction codes, semantic posting routes,
profiles, spaces and unit types are commercial or operational truth, not statutory
item identity. Extending a frozen tax-jurisdiction document would mix classification
with rate calculation and change prior evidence hashes. One narrow assignment root,
explicitly selected and equality-bound to the already frozen jurisdiction, is the
smallest natural solution.

## Exact contract

- migration0050 creates `india_gst_item_classification` with tenant-leading identity,
  same-tenant property identity, exact frozen jurisdiction lineage, fixed country
  `IN`, line `room`, revenue group `room_revenue`, system `SAC`, service flag `Y` and
  one explicitly configured official six-digit accommodation SAC;
- the allowed launch SAC set is exactly `996311`, `996312`, `996313`, `996321`,
  `996322`, `996329`; the row is unique for one tenant/property/frozen-jurisdiction/
  room line, RLS-enabled/forced and app-role SELECT-only with no runtime writer;
- `IndiaGstAccommodationClassificationService.resolve(tx,{tenantId,propertyNode,
  reservationId,classificationId})` accepts only the exact plain accessor/proxy/
  symbol-free four-UUID input, reuses exact frozen positive-tax eligibility and reads
  exactly the explicitly selected coherent classification row;
- the exact deeply frozen result contains classification id, property, complete
  jurisdiction identity, line/group, `SAC`, selected six-digit code, `Y` and a
  deterministic SHA-256 over fixed-order tenant/property/jurisdiction/classification
  evidence while tenant id stays outside the result;
- no inference or fallback from tax code, revenue group, USALI, profile, space, unit
  type, posting route, rate plan or property name/config; absent, foreign, malformed,
  stale or incoherent evidence fails closed and every read is byte/count unchanged.

## Exact scope

- new `migrations/0050_india_gst_item_classification.sql`;
- new `src/contexts/tax-fiscal/india-gst-accommodation-classification.ts`;
- `src/contexts/tax-fiscal/index.ts` export only;
- new intentional-red and PostgreSQL integration tests;
- exact migration, acceptance, runtime-DML, schema and `setup.sh` catalogue updates to
  50 migrations / 102 public tables / 92 RLS tables and policies;
- `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`;
- `BUILD-PLAN.md`, `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`;
- this order, decision, ledger and later independent review evidence.

## Forbidden

No inference-based classification; no `Pos`, `SupTyp`, B2C/URP, export, SEZ,
deemed-export, CGST/SGST/IGST, tax rate/decomposition; no seller/buyer/folio-window
composition; no IRP item/value/quantity/UOM payload, posting/correction, document
allocation/issue/number/hash chain, provider/submission/API/HTTP/UI; no writer,
capability, seed, credential, local/status/promotion/dependency/merge/public deploy,
Phase-7 or application-complete claim.

## Pre-registered proof

1. Intentional red proves migration, table, resolver and export are absent.
2. Fresh PostgreSQL proves exact50/102/92, composite FKs/unique identity/CHECKs,
   forced RLS, SELECT-only ACL, schema match and referee11/11.
3. Every allowed SAC resolves as exact `SAC`/`Y` evidence with replay, freeze and
   independently recomputed fixed-order hash.
4. Goods flag, HSN system, arbitrary/non-accommodation code, malformed or mismatched
   jurisdiction/line/input and duplicate truth fail closed.
5. Cross-tenant/property/reservation/classification and inactive or changed frozen
   jurisdiction truth reveal and write nothing.
6. Mutating `GST_ROOM`, USALI, profiles, spaces, unit types, `tx_code`, semantic routes,
   rate-plan or org display truth never selects or changes the explicit evidence.
7. Before/after row-count/byte oracles cover classification, registrations, tax
   lineage, facts/outbox, journals/postings, documents and submissions.
8. Focused, adjacent eligibility, migration, acceptance, runtime-DML, schema/referee,
   standing/static and fresh non-implementing Tier-3 execution are green.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Exact schema/resolver and hostile PostgreSQL proof are green.
- [ ] Standing/static gates are green and no authority expands.
- [ ] Fresh independent Tier-3 approval is recorded.
