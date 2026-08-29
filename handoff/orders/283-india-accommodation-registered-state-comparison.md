# Order 283 — Build exact India accommodation registered-state comparison

**Status:** CHANGES-REQUIRED-D743
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-accommodation-registered-state-comparison`
**Base:** `b257949` (independently approved Order282 descendant)
**Risk tier:** 3 — statutory evidence composition; fresh independent executable review mandatory
**Owner:** Codex implementation

## Outcome

Build one pure deterministic value function that compares the exact canonical state/UT
code in approved property-bound Order272 supplier-registration evidence with the exact
property-derived `pos` in approved Order282 accommodation place-of-supply evidence.
The result records only
`same_state_or_union_territory` or `different_state_or_union_territory`, complete
source lineage, fixed-order JSON and a tenant-bound SHA-256. It is evidence for later
governed supply-nature policy, not an intra-State/inter-State, levy-component or IRP
`SupTyp` decision.

This boundary is intentionally exact. IGST Act sections7(3) and8(2) compare the
location of the supplier with place of supply, but section7(5)(b), section8(2) and
CBIC Circular48/22/2018 make supplies to/by an SEZ inter-State even when ordinary
state codes match. Current approved evidence has no bilateral SEZ status or legal
exception selection. The registered-state comparison must therefore never overclaim
the legal nature of supply.

## Exact contract

- `buildIndiaGstAccommodationRegisteredStateComparison({tenantId,supplier,
  placeOfSupply})` accepts only the exact plain/proxy/accessor/symbol-free input;
- `supplier` is the complete exact recursively frozen approved Order272 result and
  `placeOfSupply` is the complete exact recursively frozen approved Order282 result;
- independently recompute supplier evidence JSON/hash and Order282 candidate
  JSON/hash from the complete fixed shapes, binding the unexposed tenant;
- require supplier registration id/evidence hash, property, reservation, complete
  frozen jurisdiction and all carried Order282 lineage to remain coherent;
- compare only `supplier.stateCode` and `placeOfSupply.pos`. Recipient/guest/account/
  org/profile/config/address state never participates;
- return a recursively frozen fixed-order body with property/reservation/folio,
  jurisdiction, supplier registration/hash/state, recipient, buyer association,
  classification, place-of-supply candidate/hash/rule/`pos`, comparison rule and exact
  state relationship, followed by deterministic candidate JSON and tenant-bound
  SHA-256 while tenant id remains outside the result;
- replay and every rejection leave caller bytes unchanged and perform no SQL, lock,
  write, fact, event, financial or fiscal effect.

## Exact scope

- new `src/contexts/tax-fiscal/india-gst-accommodation-registered-state-comparison.ts`;
- `src/contexts/tax-fiscal/index.ts` export only;
- new intentional-red and hostile focused/integration tests;
- `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`;
- `BUILD-PLAN.md`, `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`;
- this order, decision, ledger and later independent review evidence.

## Forbidden

No `Tx`, SQL, table, migration, seed, RLS, grant, writer, service resolver, lock, fact,
event, journal, posting, tax-detail, document or submission. No supplier-location
establishment selection beyond the exact registered-state evidence; no recipient-
state comparison or guest/account/org/profile/config fallback. No intra-State/inter-
State conclusion, SEZ/non-SEZ inference, B2C/URP/export/deemed-export treatment,
`SupTyp`, `IgstOnIntra`, reverse charge, CGST/SGST/UTGST/IGST route/rate/amount,
rounding/residual, `ItemList`/item value, document/API/HTTP/UI/local/status/promotion,
dependency/merge/public deploy, Phase-7 or application-complete claim.

## Pre-registered proof

1. Intentional red proves the source and bounded-context export are absent.
2. Exact same-code and different-code results prove fixed ordering, deterministic
   tenant-bound hash, recursive freeze, replay and source immutability.
3. Exhaustive current 36×36 matrix produces exactly36 same diagonal and1,260
   different off-diagonal comparisons, preserving leading-zero state/UT codes.
4. Recipient state changes across every current code never change the relationship;
   recipient lineage/hash may change but never supplies the comparison input.
5. Exact top-level, supplier, jurisdiction, Order282 candidate and nested shapes reject
   null/array/prototype/proxy/accessor/symbol/missing/surplus or unfrozen evidence.
6. GSTIN/checksum/state, tenant/property/reservation/folio/Party/registration/
   classification/jurisdiction and every nested evidence/candidate hash cross-mix
   fails closed without revealing foreign truth.
7. Invalid/noncurrent/numeric/name/whitespace state codes and tampered JSON/hash fail
   closed; zero authority and forbidden-label static canaries stay green.
8. Real PostgreSQL composition obtains approved Order272 and Order282 sources and
   proves supplier27/recipient29/property`pos`36 yields only the exact different-code
   relationship with byte/count zero-write oracles.
9. Focused, adjacent roots/eligibility, database acceptance, runtime-DML, migration,
   exact schema/referee, standing/static and fresh non-implementing Tier-3 execution
   are green; schema counts stay exact50 migrations/102 tables/92 forced-RLS policies.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact hostile and exhaustive comparison proof is green.
- [x] Standing/static/schema/referee gates are green and no authority expands.
- [ ] Fresh independent Tier-3 approval is recorded.

## Builder proof — D-742

Intentional red failed0/1 before the product file/export existed. The completed
candidate then passed exact focused12/0 with4,187 expectations, including the
exhaustive36×36 matrix and real approved Order272+282 PostgreSQL composition. Four
approved-root suites passed50/0; Order282 passed12/0; SellerDtls passed9/0;
positive-tax folio eligibility passed7/0; database acceptance passed15/0;
runtime-DML passed5/0; migration replay passed39/0. The isolated catalogue remained
exact50 migrations/102 public tables/92 forced-RLS tenant tables/92 policies, schema
matched and the protected referee passed11/11. Standing `bun test` passed916 with831
database/environment skips,0 failures,13,655 expectations across1,747 tests/310
files. Typecheck,106-file import boundaries,23-package licence policy,audit0 and
diff checks are green.

The first database composition attempt intentionally stopped before a product
assertion because the manually migrated runner lacked the canonical extension-type
fixture; loading the same fixture used by `setup.sh` made it green. The first
acceptance invocation was pointed at that invariant fixture and correctly rejected
its two non-demo tenants; rerunning against the separately seeded canonical
deployment database passed15/15. These were runner-target corrections, not product
failures. The isolated PostgreSQL container/network/volume are removed. The sole
stable app/PostgreSQL/Valkey remain the exact healthy containers, restart0, with
`/health` HTTP200; no local promotion occurred.
