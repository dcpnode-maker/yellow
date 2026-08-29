# Order 280 — Build exact India property fiscal-location evidence

**Status:** BUILT-PENDING-REVIEW-D733
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-property-fiscal-location`
**Base:** `4a0f3ed` (independently approved Order279 descendant)
**Risk tier:** 3 — new tenant/RLS statutory location root; independent executable review mandatory
**Owner:** Codex implementation

## Outcome

Add one typed SELECT-only tenant/property fiscal-location root and one exact read-only
resolver for canonical Indian immovable-property address evidence. This evidence is a
future place-of-supply prerequisite only; it does not emit or decide IRP `Pos`.

## Natural-Solution Test

Order272 records supplier GST registration state, not necessarily the physical
immovable property's state. `org_node` names/config, space/unit-type profiles,
recipient registration and tax code `GST_ROOM` are not typed statutory location
evidence. Reinterpreting any of them would conflate separate legal facts. One narrow
property fiscal-location root is therefore the smallest natural solution.

## Exact contract

- migration0049 creates `property_fiscal_location` with tenant-leading exact property
  identity, country fixed to `IN`, one current GST state/UT code, canonical address1,
  locality and six-digit nonzero PIN;
- `(tenant_id,property_node)` is the sole key and same-tenant composite FK to
  `org_node`; the root is RLS-enabled/forced and app-role SELECT-only with no runtime
  insert/update/delete or owner-mediated writer;
- `IndiaGstPropertyLocationService.resolve(tx,{tenantId,propertyNode})` accepts only
  the exact plain accessor/proxy/symbol-free two-UUID input, reads exactly one row under
  transaction-local tenant context and returns exact deeply frozen
  `{propertyNode,countryCode,stateCode,addressLine1,locality,pin,evidenceHash}`;
- evidence hash is deterministic SHA-256 over fixed-order tenant/property/location
  evidence while tenant id stays outside the returned result;
- no fallback to supplier/recipient GSTIN state, `org_node` name/config, property path,
  profile keys, spaces, unit types, tax codes or mutable display truth;
- absent, foreign, malformed, noncanonical or incoherent evidence fails closed and all
  reads are byte/count unchanged.

## Exact scope

- new `migrations/0049_property_fiscal_location.sql`;
- new `src/contexts/tax-fiscal/india-gst-property-location.ts`;
- `src/contexts/tax-fiscal/index.ts` export only;
- new `tests/india-gst-property-location.intentional-red.test.ts`;
- new `tests/india-gst-property-location.integration.test.ts`;
- `tests/migrate.integration.test.ts`, `tests/database-acceptance.integration.test.ts`,
  `tests/runtime-dml-authority.integration.test.ts`, `tests/schema/expected.sql` and
  `setup.sh` exact catalogue updates;
- `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`;
- `BUILD-PLAN.md`, `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`;
- this order, decision, ledger and later independent review evidence.

## Forbidden

No supplier-registration reinterpretation; no `Pos`, `SupTyp`, B2C/URP, export, SEZ,
deemed-export, accommodation/service classification, HSN/SAC, CGST/SGST/IGST, tax
rate/decomposition; no reservation/folio/recipient association, posting/correction,
document allocation/issue/number/hash chain, submission, provider/API/HTTP/UI; no
writer/capability/seed/credential/local/status/dependency/merge/public deploy, Phase7
or application-complete claim.

## Pre-registered proof

1. Intentional red proves migration, table, resolver and export are absent.
2. Fresh PostgreSQL proves exact49 migrations/101 tables/91 RLS tables/policies,
   composite FK/key, exact CHECKs, SELECT-only ACL and referee11/11.
3. Exact happy/replay/freeze/hash and nullable-free fixed-order evidence are proven;
   current state/UT, address/locality/PIN and exact stored/input shapes fail closed.
4. Cross-tenant/property, missing and hostile stored truth reveal nothing and write
   nothing; runtime raw DML is denied.
5. Supplier/recipient registration state, org-node name/config/path, profile/space/
   unit-type and GST_ROOM mutations never substitute or alter selected evidence.
6. Before/after row-count/byte oracles cover location, registrations, tax lineage,
   facts/outbox, financial/fiscal documents, journals, postings and submissions.
7. Focused, migration, acceptance, runtime-DML, schema/referee, standing/static and a
   fresh non-implementing Tier-3 reviewer personally execute the complete proof.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact schema/resolver and hostile PostgreSQL proof are green.
- [x] Standing/static gates are green and no authority expands.
- [ ] Fresh independent Tier-3 approval is recorded.
