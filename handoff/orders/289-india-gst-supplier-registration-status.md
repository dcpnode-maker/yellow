# Order 289 — Build exact date-specific India GST supplier-registration-status evidence

**Status:** BUILT-PENDING-REVIEW-D766
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-gst-supplier-registration-status`
**Base:** `bb22dd7` (independently approved Order288 descendant)
**Risk tier:** 3 — statutory GST registration status, migration and forced RLS;
fresh independent executable review mandatory
**Owner:** Codex implementation

## Outcome

Build one tenant-leading, forced-RLS, SELECT-only source root and exact resolver for
the independently changeable GST Portal registration status of the exact supplier
registration represented by approved Order272 and reached through complete approved
Order284 service-location lineage. Preserve affirmative exact-date active status and
taxpayer type as frozen deterministic evidence. This source does not decide statutory
time of supply; a later composer must equality-bind its date to separately approved
time-of-supply evidence.

## Natural-Solution Test

Order286 preserves historical Form-G/B/C evidence and requires its status date
inside the original approval validity. Order288 proves only the first direct
Form-G-to-issued-Form-F2 LoA renewal. GST registration may independently suspend,
cancel or be restored, and the official GST Portal exposes GSTIN status and taxpayer
type separately. Re-dating either approved root, using Form-F2 as GST status or
calling a live portal inside a statutory composer would destroy replay and evidence
separation. One explicit persisted snapshot is therefore the smallest safe result.

## Exact contract

- migration `0055_india_gst_supplier_registration_status.sql` adds only
  `india_gst_supplier_registration_status_snapshot(tenant_id,id,
  supplier_registration_id,supplier_registration_evidence_hash,status_as_of,
  gst_registration_status,gst_taxpayer_type,gst_status_source,
  gst_status_evidence_sha256,legal_rule)` with tenant-leading identity/FK,
  canonical checks, forced RLS and `app_role` SELECT only;
- exact affirmative literals are `active`, taxpayer type `regular|sez_unit|
  sez_developer`, source `gst_common_portal`, and legal rule
  `CGST_ACT_25_29_30_AND_RULE_21A_REGISTRATION_STATUS`; lowercase SHA-256 hashes
  are mandatory;
- unique identity is exact tenant, supplier registration id, supplier evidence hash
  and `status_as_of`; no latest, nearest, clock, network or date projection;
- `resolveIndiaGstSupplierRegistrationStatus({tenantId,propertyNode,reservationId,
  supplierServiceLocationId,supplierGstRegistrationStatusId,statusAsOf})` accepts
  only an exact plain accessor/proxy/symbol-free six-key input, fully resolves and
  independently rehashes complete Order284/272 truth, and equality-selects only the
  requested tenant/registration/hash/date row;
- return exact fixed-order recursively frozen evidence with requested root id,
  property, minimized service-location/supplier lineage, exact date and affirmative
  GST Portal status/type/source/evidence, legal rule and deterministic tenant-bound
  evidence hash while tenant stays unexposed;
- missing, duplicate, stale/future-for-request, inactive, suspended, cancelled,
  unknown, malformed or cross-lineage evidence fails closed and performs no write or
  other financial/fiscal/document/event effect.

## Exact scope

- new `migrations/0055_india_gst_supplier_registration_status.sql`;
- `tests/schema/expected.sql`, `tests/database-acceptance.integration.test.ts`,
  `tests/runtime-dml-authority.integration.test.ts` only for exact 0055/schema/ACL
  catalogue changes;
- `tests/migrate.integration.test.ts` only for every exact post-0055 migration
  ledger/discovered/applied-file and catalogue expectation advanced by 0055:
  55 migrations, 107 public tables, 97 RLS tenant tables, 97 tenant policies and
  7 FORCE-RLS tables, plus exact filename/version/checksum;
- `setup.sh` only for exact table count 106 to 107 and migration diagnostic 1-54
  to 1-55;
- new `src/contexts/tax-fiscal/india-gst-supplier-registration-status.ts` and
  bounded-context index export only;
- new intentional-red and exact hostile integration tests;
- `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`;
- `BUILD-PLAN.md`, `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`, this order,
  decision, ledger and later independent review evidence.

## Forbidden

No writer, portal/network call, latest/nearest/clock lookup, date extrapolation,
status inference from GSTIN/address/SEZ approval/property/profile/config, or mutation
of Orders272/284/286/287/288. No caller-selected statutory time of supply, Form-G/
Form-F2 continuity composition, current LoA status, authorized operations,
specified-officer endorsement, BLUT, zero rating, refund, supply-nature V2,
levy/rate/amount/decomposition, `SupTyp`/`IgstOnIntra`, journal/posting/correction,
item/invoice/document/submission/API/HTTP/UI/local/status/promotion, dependency/
merge/public deploy, Phase-7 or application-complete claim.

## Pre-registered proof

1. Intentional red proves migration/table/source/export are absent.
2. Exact checksum, schema mirror, acceptance manifest, 55/107/97/97/7 catalogue,
   SELECT-only ACL, forced RLS and referee 11/11 are green.
3. Golden active regular/unit/developer exact-date snapshots resolve through complete
   Order284/272 lineage.
4. Missing/duplicate/date mismatch and inactive/suspended/cancelled/unknown or
   malformed source/type/hash/rule rows fail closed.
5. Cross-tenant/property/reservation/location/registration/hash/root mixtures reveal
   no row and write nothing.
6. Exact shape/order, canonical JSON/hash, recursive freeze, replay and source
   immutability are byte exact.
7. App-role INSERT/UPDATE/DELETE/TRUNCATE are denied; tenant isolation and
   transaction reuse are proven.
8. Static zero-effect proof excludes network/live lookup, latest/clock, LoA/renewal,
   time-of-supply, supply-nature/zero-rating/tax/item/document/writer authority.
9. Focused/adjacent/database/standing/static gates and fresh non-implementing Tier-3
   execution are green; stable local remains unchanged.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact schema/RLS/ACL and hostile lineage proof is green.
- [x] Standing/static/referee gates are green and no authority expands.
- [ ] Fresh independent Tier-3 approval is recorded.

## Builder proof — D-766

Intentional red `0/1` preceded implementation. The exact candidate then passed the
focused hostile/live PostgreSQL suite `10/0` (`225` expectations), fresh deployment
acceptance `20/0` (`58`), runtime-DML authority `5/0` (`114`) and migration runner
`39/0` (`187`). Normalized schema mirror and exact catalogue
`55 migrations / 107 public tables / 97 RLS tables / 97 policies / 7 FORCE-RLS`
match; canonical setup and standalone referee each report `11 passed, 0 failed`.
Standing proof is `976/0` plus `865` database-only skips (`15,108` expectations;
`1,841` tests / `322` files). Typecheck, `112`-file boundaries, `23`-package licence
policy, audit `0`, schema mirror and diff checks are green. Adjacent Orders284–289
produce `81` behavioral passes (`1,702` expectations); the only two deliberate
historical failures are Orders285/286 catalogue locks for their independently
approved 52/53-migration snapshots, left unchanged rather than weakened.

Migration 0055 SHA-256 is
`c0f50dc59178da55cd89ad06bcbd4ee48f36a48e154c07e41b089a7608cb1f80`.
An earlier disposable compose proof printed setup/referee `11/11` and was removed by
an overlapping cleanup before later suites, causing only connection-closed harness
results; no product assertion failed and no such result is counted. All recorded
proof above was rerun sequentially against a fresh exact isolated PostgreSQL 16.15
container. The sole stable local retains the same app/PostgreSQL/Valkey identities,
is healthy at port 3000 with restart count zero, and received no Order289 promotion.
Fresh non-implementing Tier-3 execution on the exact committed candidate remains
mandatory.
