# Order 284 — Build exact India GST supplier service-location evidence

**Status:** BUILT-PENDING-REVIEW-D747
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-gst-supplier-service-location`
**Base:** `2a9527a` (independently approved Order283 descendant)
**Risk tier:** 3 — new tenant/RLS statutory supplier-location root; independent executable review mandatory
**Owner:** Codex implementation

## Outcome

Add one typed SELECT-only assignment root and exact read-only resolver proving only
the IGST Act section2(15)(a) premise that this lodging-accommodation supply is made
from the exact registered place of business represented by current approved Order272
supplier evidence. The result is supplier-location evidence for later governed
supply-nature composition; it does not compare the location with `Pos` or emit an
intra-State/inter-State, levy-component or IRP decision.

## Natural-Solution Test

Order272 proves a property-bound GST registration but does not prove the statutory
location of supplier of services. GSTIN state/address, physical property location,
co-location, SellerDtls and Order283 equality cannot select the establishment from
which the supply is made. Mutating frozen Order272 would invalidate approved hashes;
extension/config/Party/org/profile truth would be an inference. One explicit narrow
assignment bound to the exact current Order272 registration id and evidence hash is
therefore the smallest natural solution. Section2(15)(b) fixed establishment,
2(15)(c) most-directly-concerned multi-establishment selection and2(15)(d) usual
residence remain unsupported and fail closed.

## Exact contract

- migration0051 creates `india_gst_supplier_service_location` with tenant-leading id,
  exact supplier registration id/evidence hash, fixed lodging-accommodation scope,
  explicit principal/additional registered-place kind, fixed supply-made-from-
  registered-place basis and `IGST_ACT_2_15_A` legal rule;
- same-tenant composite FK targets `property_fiscal_registration`; one row is unique
  for tenant/registration/evidence-hash/scope, RLS is enabled and forced, and
  `app_role` has SELECT only with no runtime or owner-mediated product writer;
- `IndiaGstSupplierServiceLocationService.resolve(tx,{tenantId,propertyNode,
  reservationId,supplierServiceLocationId})` accepts only the exact plain accessor/
  proxy/symbol-free four-UUID input, resolves exact current Order272 supplier evidence,
  then equality-selects the explicitly requested coherent assignment;
- `current` means equality with that exact resolved registration id and evidence hash,
  never server time, latest-row lookup or effective-date inference;
- return recursively frozen fixed-order `{supplierServiceLocationId,propertyNode,
  jurisdiction,supplier:{registrationId,evidenceHash},serviceScope,
  registeredPlace:{kind,stateCode,addressLine,locality,postalCode},locationBasis,
  legalRule,evidenceHash}`; every location byte comes only from revalidated Order272;
- result `evidenceHash` is SHA-256 over fixed-order `{tenantId,...complete result body
  except evidenceHash}`; tenant remains bound but unexposed;
- absent, duplicate, stale, foreign, malformed, thawed or incoherent evidence fails
  closed and every replay/rejection is byte/count unchanged.

## Exact scope

- new `migrations/0051_india_gst_supplier_service_location.sql`;
- new `src/contexts/tax-fiscal/india-gst-supplier-service-location.ts`;
- `src/contexts/tax-fiscal/index.ts` export only;
- new intentional-red and PostgreSQL integration tests;
- exact migration, acceptance, runtime-DML, schema and `setup.sh` catalogue updates to
  51 migrations / 103 public tables / 93 RLS-enabled tenant tables / 93 policies /
  3 FORCE-RLS tables;
- `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`;
- `BUILD-PLAN.md`, `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`;
- this order, decision, ledger and later independent review evidence.

## Forbidden

No inference from GSTIN prefix/address alone, property fiscal location or physical
co-location, org/profile/config/name, SellerDtls, recipient/guest/account/folio state,
Order283 relationship or absence of another establishment. No section2(15)(b), (c)
or (d) fallback; no SEZ/non-SEZ or authorized-operations evidence; no intra/inter-
State, CGST/SGST/UTGST/IGST, rate/amount, `SupTyp`, `IgstOnIntra`, zero rating,
reverse charge, item, posting/correction, document/submission/API/HTTP/UI. No writer,
fact/event/lock, seed, credential, local/status/promotion, dependency, merge/public
deploy, Phase-7-complete or application-complete claim.

## Pre-registered proof

1. Intentional red proves migration, table, resolver and export are absent.
2. Fresh PostgreSQL proves exact51/103/93/93/3, composite FK/unique/checks, forced
   RLS, SELECT-only ACL, normalized schema and referee11/11.
3. Principal and additional-place happy paths prove byte-exact replay, recursive
   freeze, source immutability and independently recomputed fixed-order hash.
4. Exact current registration/hash/property/reservation/frozen-jurisdiction binding
   is mandatory; stale address/hash/registration evidence fails closed.
5. Missing/duplicate/cross-tenant/property/reservation/assignment and hostile input or
   stored shapes reveal nothing and write nothing.
6. GSTIN state, property location, org/config, SellerDtls and Order283 relationship
   mutations never substitute for the explicit assignment; 2(15)(b–d) stay absent.
7. `app_role` DML is denied and cross-tenant reads are empty.
8. Before/after byte/count oracles cover this assignment, Orders272/280/281/282/283
   lineage, facts/outbox/idempotency, journals/postings, documents and submissions.
9. Focused, adjacent roots, acceptance, runtime-DML, migration, schema/setup/referee,
   standing/static and a fresh non-implementing Tier-3 reviewer personally execute
   the complete proof.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact schema/resolver and hostile PostgreSQL proof are green.
- [x] Standing/static gates are green and no authority expands.
- [ ] Fresh independent Tier-3 approval is recorded.

## Builder proof — D-747

Intentional red failed0/1 before migration0051, the resolver and export existed. The
complete candidate then passed fresh isolated PostgreSQL focused18/0(238), migration
replay39/0(187), database acceptance16/0(46), runtime-DML5/0(110), normalized schema
equality and protected referee11/11. The catalogue is exact51 migrations/103 public
tables/93 RLS-enabled tenant tables/93 tenant policies/3 FORCE-RLS tables. Migration
0051 SHA-256 is
`af457264bb976d64930022eb4686a55096248bf0b9e1f13151454b47d47b2496`.

Focused proof covers exact principal/additional assignments, current Order272
registration/hash/property/reservation/jurisdiction binding, independent upstream
rehash, recursive freeze, replay, hostile shapes, stale/missing/foreign evidence,
unique/FK/CHECK SQLSTATEs, RLS isolation, app-role DML denial, non-substitution and
complete zero-effect digests. Native standing `bun test` passed927 with841 database/
environment skips,0 failures and13,842 expectations across1,768 tests/312 files.
Typecheck,107-file boundaries,23-package licence policy,audit0, setup syntax and diff
checks are green. Disposable builder PostgreSQL resources are absent. The sole stable
app/PostgreSQL/Valkey remain exact, healthy, restart0 and `/health` HTTP200; no local
promotion occurred. Fresh non-implementing Tier-3 execution remains mandatory.
