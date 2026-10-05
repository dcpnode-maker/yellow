# Order 281 — Build exact India GST accommodation-classification evidence

**Status:** APPROVED-D737
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

- [x] Intentional red precedes implementation.
- [x] Exact schema/resolver and hostile PostgreSQL proof are green.
- [x] Standing/static gates are green and no authority expands.
- [x] Fresh independent Tier-3 approval is recorded.

## Independent review — D737

Fresh non-implementing Tier-3 review at exact candidate
`d65ab22ceec415b0be858f06d7a82c85b9fb29ad` is APPROVED with no finding. The
reviewer personally reproduced focused12/0, the four-suite39/0 including 28 adjacent
tests, acceptance15/0, runtime-DML5/0, migration39/0, exact50 migrations / 102 public
tables / 92 forced-RLS tables and policies, exact schema and referee11/11, plus
standing894/0 with 825 database-only skips and every static gate. Primary IRIS,
FORM GST INV-01 and CBIC sources independently confirm separate `IsServc`/`HsnCd`
item fields and the exact six accommodation SACs. Review evidence is recorded in
`handoff/reviews/281-india-gst-accommodation-classification.md`; disposable reviewer
proof was removed and the stable local remained healthy and unchanged.

## Builder proof — D736

- intentional red: 0 passed / 1 failed because migration0050 was absent, before any
  source or migration existed;
- focused classification: 12/0 (196 expectations); four-suite classification/location/
  supplier/folio integration: 39/0 (406 expectations), including 28 adjacent prerequisites;
- database acceptance15/0, runtime-DML5/0, migration replay39/0 (186 expectations),
  exact50 migrations / 102 public tables / 92 RLS tables+policies, normalized schema
  exact, and fresh referee11/11;
- standing894/0 plus 825 database-only skips (9,148 expectations; 1,719 tests across
  306 files), TypeScript, 104-file boundary, 23-package licence, audit0 and diff green;
- official source audit: notified IRP schema keeps `IsServc` and `HsnCd` as separate
  mandatory item fields, while CBIC Notification11 annexure lists exactly the admitted
  accommodation-service SAC set;
- discarded harness invocations were infrastructure-only: a WSL proof container was
  host-stopped after a green referee, one combined acceptance run targeted invariant
  fixtures rather than the canonical seed, and one schema invocation omitted compose
  authority variables. Corrected Windows-Docker executions above are green. No stable
  local application resource was changed.
