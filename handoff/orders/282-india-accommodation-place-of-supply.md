# Order 282 — Build exact India accommodation place-of-supply candidate

**Status:** BUILT-PENDING-REVIEW-D739
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-accommodation-place-of-supply`
**Base:** `2c45c6d` (independently approved Order281 descendant)
**Risk tier:** 3 — statutory place-of-supply composition; independent executable review mandatory
**Owner:** Codex implementation

## Outcome

Add one exact read-only service that composes already approved frozen seller, explicit
folio/buyer, property-location and accommodation-classification evidence into a
deterministic Indian lodging place-of-supply candidate. The candidate records only the
property state as prospective IRP `Pos`; it is not an invoice, tax decision or
submittable payload.

## Natural-Solution Test

IGST Act section 12(3)(b) locates hotel lodging at the immovable property. Supplier
GSTIN state, recipient GSTIN state, folio/account role, reservation guest address and
mutable org/profile/config are therefore not lawful substitutes. Order280 already
created exact physical-property state truth, while Orders272/279/281 prove the domestic
registered seller, explicit folio buyer and lodging classification needed to apply the
narrow rule. Compose those approved roots; create no new table, configuration or
inference path.

## Exact contract

- `IndiaGstAccommodationPlaceOfSupplyService.resolve(tx,{tenantId,propertyNode,
  reservationId,folioId,recipientPartyId,recipientRegistrationId,classificationId})`
  accepts only the exact plain accessor/proxy/symbol-free seven-UUID input;
- it composes exact approved positive-tax supplier registration, explicit folio buyer
  candidate, physical property fiscal location and accommodation classification;
- tenant, property, reservation, folio, INR, complete frozen jurisdiction, explicit
  Party/registration and classification lineage must agree exactly; missing, foreign,
  stale, malformed, duplicate or incoherent truth fails closed;
- the only `pos` value is the exact current property fiscal-location state code. Seller
  or recipient state never substitutes for it and no intra/inter-state or tax-component
  conclusion is returned;
- the deeply frozen fixed-order result records the property/reservation/folio,
  supplier, recipient/buyer-association, classification and property-location evidence
  identifiers/hashes, legal rule `IGST_ACT_12_3_B`, `pos`, deterministic candidate JSON
  and tenant-bound SHA-256 while tenant id stays outside the result;
- resolving, replaying and rejecting candidates changes no database or caller bytes and
  has no fallback to org/profile/address/account/guest/rate/tax-code/display config.

## Exact scope

- new `src/contexts/tax-fiscal/india-gst-accommodation-place-of-supply.ts`;
- `src/contexts/tax-fiscal/index.ts` export only;
- new intentional-red, hostile unit and PostgreSQL composition tests;
- `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`;
- `BUILD-PLAN.md`, `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`;
- this order, decision, ledger and later independent review evidence.

## Forbidden

No new table, migration, seed, writer, capability or configuration; no seller/recipient
or guest-state fallback; no international, multi-state-property, B2C/URP, export, SEZ
or deemed-export rule; no intra/inter-state flag, CGST/SGST/IGST rate/decomposition,
rounding/residual allocation; no `SupTyp`, `ItemList`, `SlNo`, description, quantity,
UQC, unit/gross/assessable/item value, tax amount; no posting/correction, fiscal series,
document allocation/issue/number/hash chain, provider/submission/API/HTTP/UI; no
credential, local/status/promotion/dependency/merge/public deploy, Phase-7 or
application-complete claim.

## Pre-registered proof

1. Intentional red proves the service and bounded-context export are absent.
2. Exact happy/replay/fixed-order JSON/hash and recursive freeze are proven with
   independently recomputed tenant-bound evidence.
3. Exact top-level and nested plain/frozen shapes reject null, array, prototype, proxy,
   accessor, symbol, missing and surplus input/evidence.
4. Cross-tenant/property/reservation/folio/Party/registration/classification,
   jurisdiction or evidence-hash mixing fails closed and reveals nothing.
5. Every current Indian state/UT property code resolves byte-exactly as `pos`; changing
   seller or recipient state never changes `pos`, while property-location state does.
6. Non-lodging/goods classification, absent property location, non-IN/INR, invalid
   registration, closed lineage and hostile stored truth fail closed.
7. Before/after byte/count oracles cover all source roots plus facts/outbox, journals,
   postings, documents and submissions; no effect or advisory/row lock is introduced
   beyond the inherited governed source resolvers.
8. Static absence proves no tax comparison/decomposition, `SupTyp`, item/document/
   submission field or effect authority can sprout from the candidate.
9. Focused, adjacent supplier/buyer/location/classification/eligibility, database
   acceptance, runtime-DML, migration, schema/referee, standing/static and fresh
   non-implementing Tier-3 execution are green.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact composition and hostile proof are green.
- [x] Standing/static gates are green and no authority expands.
- [ ] Fresh independent Tier-3 approval is recorded.

## Builder proof — D739

- intentional red: 0 passed / 1 failed because the source module was absent before
  implementation;
- focused hostile plus real default-service PostgreSQL composition: 12/0 with 353
  expectations; all36 current state/UT codes, seller27/recipient29/property36→pos36,
  replay/freeze/hash, wrong-classification concealment and zero-write oracles pass;
- adjacent governed supplier/buyer-folio/property-location/classification roots42/0
  plus positive-tax folio eligibility6/0; database acceptance15/0, runtime-DML5/0 and
  migration replay39/0 with186 expectations pass;
- exact50 migrations / 102 public tables / 92 forced-RLS tables and policies, normalized
  schema exact and fresh referee11/11;
- standing905/0 plus828 database-only skips (9,484 expectations;1,733 tests across308
  files), TypeScript,105-file boundary,23-package licence,audit0 and diff are green;
- official IGST Act section12(3)(b) and notified IRP audit confirms lodging `Pos` comes
  from the immovable property and service quantity/unit are optional rather than
  invented. The first WSL proof daemon host-stopped after a green setup referee; one
  migration invocation correctly rejected a protected database target; one referee
  rerun encountered prior referee fixture state. Corrected fresh Windows-Docker proofs
  above are green and no product assertion failed;
- all disposable builder proof resources were removed; the stable sole local app,
  PostgreSQL and Valkey were not changed.
