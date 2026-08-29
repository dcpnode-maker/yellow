# Order 286 — Build exact India GST supplier SEZ-status evidence

**Status:** BUILT-PENDING-REVIEW-D753
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-gst-supplier-sez-status`
**Base:** `20ae4e9` (independently approved Order285 descendant)
**Risk tier:** 3 — new tenant/RLS statutory registration/SEZ evidence root; independent executable review mandatory
**Owner:** Codex implementation

## Outcome

Add one typed SELECT-only registration-specific supplier status root and exact
read-only resolver for affirmative official evidence that the exact current Order272
GST registration reached through approved Order284 service-location evidence is
either a regular non-SEZ registration, an SEZ unit or an SEZ developer. Absence or
unsupported/stale evidence remains unresolved and never means non-SEZ. This result is
a later IGST section7(5)(b)/8(2) prerequisite only; it does not decide bilateral
supply nature, authorized operations, zero rating, levy or IRP fields.

## Natural-Solution Test

Official GST registration distinguishes SEZ unit/developer registrations from
outside-SEZ registrations and requires separate registration, while SEZ approval
role/validity is its own official evidence. Order284 is essential lineage proving
which exact registered place supplies the lodging service, but status belongs to the
underlying Order272 registration rather than being duplicated per place. Supplier
GSTIN/address/property co-location, SellerDtls, Order283 relationship, Party/config
and recipient Order285 status cannot own this truth. One registration-FK/hash-bound
status root composed through exact Order284 lineage is the smallest natural solution.
The later bilateral supply-nature composer, authorized-operations endorsement and
Form-F2 renewal evidence remain separate orders.

## Exact contract

- migration0053 creates `india_gst_supplier_sez_status` with tenant-leading id,
  exact supplier registration id/evidence hash and evidence-as-of date;
- GST registration evidence is fixed active and sourced from `gst_common_portal`;
  taxpayer type is exactly `regular`, `sez_unit` or `sez_developer` with its own
  lowercase SHA-256 evidence hash;
- `regular` requires every SEZ-approval field null and maps only to
  `affirmatively_non_sez_regular`; `sez_unit` requires in-force Form G evidence;
  `sez_developer` requires in-force Form B or C evidence; positive reference,
  finite canonical `[)` validity and lowercase SHA-256 are mandatory, and
  `status_as_of` must fall inside validity;
- same-tenant composite FK targets `property_fiscal_registration`; one status is
  unique for tenant/registration/evidence-hash/as-of date, RLS is enabled and forced,
  and `app_role` has SELECT only with no product writer;
- `IndiaGstSupplierSezStatusService.resolve(tx,{tenantId,propertyNode,reservationId,
  supplierServiceLocationId,supplierSezStatusId})` accepts only the exact plain
  accessor/proxy/symbol-free five-UUID input, resolves and independently rehashes
  complete exact Order284 evidence, then equality-selects the requested status row
  by the returned Order272 registration id/hash;
- return recursively frozen fixed-order `{supplierSezStatusId,propertyNode,
  supplierServiceLocation:{id,evidenceHash},supplier:{registrationId,evidenceHash},
  statusAsOf,gstRegistration,sezStatus,approval,legalRule,evidenceHash}` with exact
  approval validity `{fromInclusive,toExclusive}` when present; final SHA-256 hashes
  fixed-order `{tenantId,...complete body except evidenceHash}` while tenant remains
  unexposed;
- no server-clock/latest-row/effective-date inference: `statusAsOf` is evidence time,
  not a claim that the snapshot controls a future supply date; replay and rejection
  are byte/count unchanged.

## Exact scope

- new `migrations/0053_india_gst_supplier_sez_status.sql`;
- new `src/contexts/tax-fiscal/india-gst-supplier-sez-status.ts`;
- `src/contexts/tax-fiscal/index.ts` export only;
- new intentional-red and PostgreSQL integration tests;
- exact migration, acceptance, runtime-DML, schema and `setup.sh` catalogue updates to
  53 migrations / 105 public tables / 95 RLS-enabled tenant tables / 95 policies /
  5 FORCE-RLS tables;
- `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`;
- `BUILD-PLAN.md`, `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`;
- this order, decision, ledger and later independent review evidence.

## Forbidden

No inference from GSTIN/state/address/name containing SEZ, property co-location,
Party/org/profile/config, SellerDtls, Order283 relationship or recipient Order285
status. No Form-F2 renewal, authorized-operations or specified-officer endorsement,
zero-rating/refund/payment-mode/`SEZWP`/`SEZWOP`, bilateral intra/inter-State result,
levy/rate/amount, `SupTyp`, `IgstOnIntra`, reverse charge, item, posting/correction,
document, submission/API/HTTP/UI/network. No writer, fact/event/lock, seed, credential,
local/status/promotion, dependency, merge/public deploy, Phase-7 or application
completion.

## Pre-registered proof

1. Intentional red proves migration, table, resolver and export are absent.
2. Fresh PostgreSQL proves exact53/105/95/95/5, composite FK/unique/conditional
   CHECKs, forced RLS, SELECT-only ACL, normalized schema and referee11/11.
3. Exact regular, unit/Form-G, developer/Form-B and co-developer/Form-C paths prove
   fixed bytes/hash/freeze/replay through principal/additional Order284 locations.
4. Missing/partial/mismatched approval tuple, regular-with-approval, malformed/empty/
   noncanonical validity, boundary/as-of, reference/hash/status/source/rule defects
   fail at PostgreSQL and resolver boundaries.
5. Missing, stale, unsupported, suspended/cancelled, expired/future, cross-tenant/
   property/reservation/location/registration/status and hostile input/stored truth
   fail closed; absence never yields non-SEZ.
6. Complete current Order284 location and underlying Order272 registration/hash are
   independently revalidated; GSTIN/address/property/config, Order283 and Order285
   cannot substitute.
7. `app_role` DML is denied and cross-tenant reads are empty.
8. Before/after byte/count oracles cover this root, Orders272/284/285, facts/outbox/
   idempotency, journals/postings/tax details/documents/submissions.
9. Static scans prove absence of bilateral supply nature, authorized operations,
   zero rating, levy, item/document/network and writer authority.
10. Focused, adjacent roots, acceptance, runtime-DML, migration, schema/setup/referee,
    standing/static and a fresh non-implementing Tier-3 reviewer personally execute
    the complete proof.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact schema/resolver and hostile PostgreSQL proof are green.
- [x] Standing/static gates are green and no authority expands.
- [ ] Fresh independent Tier-3 approval is recorded.

## Builder proof — D-753

Intentional red failed0/1 before migration0053, the resolver and export existed. The
complete candidate then passed fresh isolated PostgreSQL focused16/0(317), migration
replay39/0(187), database acceptance18/0(52), runtime-DML5/0(112), normalized schema
equality, canonical `./setup.sh --db-only` and protected referee11/11. The catalogue
is exact53 migrations/105 public tables/95 RLS-enabled tenant tables/95 tenant
policies/5 FORCE-RLS tables. Migration0053 SHA-256 is
`e5208a1698c06db64842946876c90912c03d9aa0481ed0ceced6fa0295020c3d`.

Focused proof covers affirmative regular, unit/Form-G, developer/Form-B and co-
developer/Form-C through principal/additional Order284 evidence; exact Order284 and
underlying Order272 registration/hash revalidation; finite validity/boundaries;
fixed bytes/hash/freeze/replay; hostile input/stored shapes; stale, missing, foreign
or unsupported evidence; conditional CHECK/FK/unique failures; RLS isolation;
app-role DML denial; non-substitution and complete zero-effect digests. Native
standing `bun test` passed945 with861 database/environment skips,0 failures and
14,270 expectations across1,806 tests/316 files. Typecheck,109-file boundaries,
23-package licence policy,audit0, setup syntax and diff checks are green. Disposable
builder PostgreSQL resources are absent. The sole stable app/PostgreSQL/Valkey remain
exact, healthy, restart0 and `/health` HTTP200; no local promotion occurred. Fresh
non-implementing Tier-3 execution remains mandatory.
