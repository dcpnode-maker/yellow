# Order 290 — Build exact India GST accommodation service-provision-date evidence

**Status:** BUILT-PENDING-REVIEW-D769
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-gst-accommodation-service-provision-date`
**Base:** `8f5c600` (independently approved Order289 descendant)
**Risk tier:** 3 — statutory service-date evidence, migration and forced RLS;
fresh independent executable review mandatory
**Owner:** Codex implementation

## Outcome

Build one tenant-leading, forced-RLS, SELECT-only source root and exact resolver for
an externally evidenced accommodation `serviceProvisionDate`, bound to the exact
approved Order252 reservation/first-segment lineage and canonical Order240 positive
room-revenue attribution. Preserve the asserted date and provenance as frozen,
deterministic evidence for a later CGST section 13 time-of-supply composer. This
order neither derives the date from operational truth nor decides time of supply.

## Natural-Solution Test

CGST Act section 13 chooses time of supply from invoice, payment and—in its fallback
branch—service-provision inputs. Current Yellow truth has no approved fiscal invoice
issue or payment-date evidence for that statutory decision. Order287 `supplyDate` is
an explicit rule-applicability coordinate; Order240 room-night `businessDate` is
quote-time tax-assignment evidence; Order252 `period` is a planned reservation range;
check-in, occupancy, checkout and journal business dates are operational or posting
facts. Relabelling any of them would fabricate statutory truth. A separately sourced,
lineage-bound exact-date root is the smallest honest prerequisite. Full section 13
composition must wait for independently approved invoice/payment inputs.

## Exact contract

- migration `0056_india_gst_accommodation_service_provision_date.sql` adds only
  `india_gst_accommodation_service_provision_snapshot(tenant_id,id,property_node,
  reservation_lineage_id,hold_binding_id,attribution_id,reservation_id,segment_id,
  origin_quote_hash,snapshot_hash,currency,service_provision_date,
  service_provision_source,service_provision_evidence_sha256,legal_rule)`;
- the table has tenant-leading identity, an exact composite FK to Order252's complete
  immutable posting-identity tuple, finite date/hash/currency checks, exact source
  `governed_service_provision_record`, exact legal literal
  `CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY`, unique tenant/lineage/date,
  forced RLS and `app_role` SELECT only;
- no app/runtime writer, ingestion command or attestation policy is admitted; deployment
  fixtures represent already governed external evidence and production ingestion is
  a separate order;
- `resolveIndiaGstAccommodationServiceProvisionDate({tenantId,propertyNode,
  reservationId,serviceProvisionSnapshotId,serviceProvisionDate})` accepts only an
  exact plain accessor/proxy/symbol-free five-key input, independently revalidates
  complete Order252 lineage and reparses canonical Order240 attribution, requires
  `rate_quote`, line `room`, revenue group `room_revenue`, exact quote/snapshot/currency
  coherence, and equality-selects only the requested root id/date;
- return fixed-order recursively frozen minimized lineage, exact date/source/evidence/
  legal rule and deterministic tenant-bound evidence hash while tenant remains
  unexposed;
- missing, duplicate, malformed, cross-lineage or stale-hash evidence fails closed.
  No comparison to room-night dates, reservation period, check-in/out, occupancy,
  checkout, journal date or any clock/latest value is allowed.

## Exact scope

- new `migrations/0056_india_gst_accommodation_service_provision_date.sql`;
- `tests/schema/expected.sql`, `tests/database-acceptance.integration.test.ts`,
  `tests/runtime-dml-authority.integration.test.ts` only for exact schema/ACL counts;
- `tests/migrate.integration.test.ts` only for exact post-0056 ledger/discovered/
  applied-file and catalogue expectations: 56 migrations, 108 public tables,
  98 RLS tenant tables, 98 policies and 8 FORCE-RLS tables, plus exact checksum;
- `setup.sh` only for public table count 107→108 and migrations 1-55→1-56;
- new `src/contexts/tax-fiscal/india-gst-accommodation-service-provision-date.ts`
  and bounded-context index export only;
- new intentional-red and exact hostile/live integration tests;
- `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`;
- `BUILD-PLAN.md`, `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`, this order,
  decisions, ledger and later independent review evidence.

## Forbidden

No writer, API/UI/local promotion, network/source lookup, latest/nearest/clock,
operator identity, source attestation workflow or mutation of Orders240/252. No
derivation/equality from quote room-night business date, segment period, reservation
arrival/departure, occupancy, check-in/out, checkout or journal/posting date. No
section13 earliest-date result, invoice/document/number/hash-chain, payment/receipt,
section14 change-in-rate, Order289 consumption, effective GST/LoA status, Form-F2
extension, supply-nature V2, authorized operations/specified-officer/BLUT/zero rating/
refund, levy/rate/amount/decomposition, `SupTyp`/`IgstOnIntra`, item, posting,
correction, submission, provider, merge/deploy/Phase7/application-complete claim.

## Pre-registered proof

1. Intentional red proves migration/table/source/export are absent.
2. Exact checksum, schema mirror, acceptance manifest, 56/108/98/98/8 catalogue,
   SELECT-only ACL, forced RLS and referee 11/11 are green.
3. Golden explicit service date resolves through complete Order252/240 lineage and
   returns exact fixed-order frozen tenant-bound evidence.
4. Missing/duplicate/date/id/hash/source/legal/currency/shape defects fail closed.
5. Tenant/property/reservation/lineage/binding/attribution/segment/hash mixtures reveal
   no row and write nothing.
6. Stored attribution is reparsed and exact `rate_quote` room/room-revenue evidence is
   mandatory; hostile canonical snapshot bytes reject.
7. Non-substitution canaries prove Order287 supply date, quote room-night date,
   reservation period, operational dates, posting date and clocks are unused.
8. App-role INSERT/UPDATE/DELETE/TRUNCATE are denied; tenant isolation, replay,
   recursive freeze, canonical hash and complete zero-effect truth are executable.
9. Focused/adjacent/database/migration/schema/setup/referee/standing/static gates and
   fresh non-implementing Tier-3 review are green; stable local remains unchanged.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact schema/RLS/ACL and hostile lineage/non-substitution proof is green.
- [x] Standing/static/referee gates are green and no authority expands.
- [ ] Fresh independent Tier-3 approval is recorded.

## Builder evidence — D769

Intentional red failed before implementation with `0` passes, `1` failure and `2`
expectations. The integrated candidate then passed focused live proof `10/0` (`178`
expectations), database acceptance `21/0` (`61`), runtime-DML authority `5/0`
(`115`), migration proof `39/0` (`187`), exact normalized
`56/108/98/98/8` schema, and canonical clean setup/referee `11/11`. Standing proof
is `985/0` plus `867` expected skips (`15278` expectations; `1852` tests in `324`
files); typecheck, `113`-file boundaries, `23` licences, audit-zero and diff checks
are green. Migration SHA-256 is
`920b98c03e65e7ed968b2fe277f6f9d67185be125a68aec3123b9ad0b8f27658`; normalized
schema SHA-256 is
`15955a37996c71d9eb7a12401fa075205eac93a0fa3168d271b02c1b9e00cea8`.
The first canonical setup attempt reused a retained proof port and encountered only a
Compose bind conflict; a clean isolated project then passed exactly. The sole stable
port-3000 app remains healthy, restart-free and unchanged. Fresh independent Tier-3
review remains mandatory before approval.
