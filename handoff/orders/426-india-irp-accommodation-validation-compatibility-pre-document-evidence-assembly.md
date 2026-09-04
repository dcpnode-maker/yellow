# Order 426 — India IRP accommodation validation-compatibility pre-document evidence assembly

**Status:** BUILT — AWAITING FRESH INDEPENDENT TIER-3 REVIEW — D1282
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** independently approved Order425 coordination head `e9d4ef1`
**Risk tier:** 3 — statutory fiscal-payload assembly
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Add one migration-free pure Tax-Fiscal composer that combines independently approved
Order424 incomplete pre-document evidence with independently approved Order425
quantity/UQC compatibility evidence. It replaces only `ItemList` with the exact
Order425 enriched items, keeps every other approved section byte-exact, excludes
`DocDtls`, and remains explicitly non-submit-ready and not provider-certified.

## Exact contract

`composeIndiaIrpAccommodationValidationCompatibilityPreDocumentEvidenceAssembly(input)`
accepts only the shared approved Order414 pure input used by Orders424/425 and invokes
both approved composers independently.

The fixed result key order is `state`, `format`, `submissionReady`,
`authenticatedProviderSandboxCertified`, `explicitlyExcludedEvidence`, `sections`,
`sectionsJson`, `lineage`, `sourceEvidenceHash`, `evidenceHash`.

- `state` is exactly
  `incomplete_non_submit_ready_irp_accommodation_validation_compatibility_pre_document_evidence`;
- `format` is exactly `irp_json_1_1`;
- `submissionReady` and `authenticatedProviderSandboxCertified` are both `false`;
- `explicitlyExcludedEvidence` is exactly `["DocDtls"]` and is known non-exhaustive;
- `sections` retains exact order `Version`, `TranDtls`, `SellerDtls`, `BuyerDtls`,
  `ItemList`, `ValDtls`;
- every section except `ItemList` is byte-exact from Order424;
- `ItemList` is the exact ordered `irp` projection from Order425, including only its
  approved `Qty:"1.000"` and `Unit:"OTH"` compatibility enrichment;
- `sectionsJson` is the canonical serialization of `sections`.

Exact lineage key order is `sourceEvidenceHash`, `preDocumentEvidenceAssemblyHash`,
`serviceQuantityUqcCompatibilityEvidenceHash`, `itemCandidatesEvidenceHash`.
The composer must prove both children share the same source, item count/order,
component family, INR/B2B truth and inherited Order419 item-candidate evidence. Removing
only `Qty` and `Unit` from every enriched item must reproduce Order424 `ItemList`
byte-exact. It independently recomputes child hashes, returns tenant-bound deterministic
evidence, recursively freezes the result and conceals tenant identity.

## Exact scope

- new `src/contexts/tax-fiscal/india-irp-accommodation-validation-compatibility-pre-document-evidence-assembly.ts`;
- `src/contexts/tax-fiscal/index.ts` public export;
- new exact intentional-red and permanent pure hostile/mutation tests;
- `docs/CONTRACTS.md`, Phase 7 `BUILD-PLAN.md`, this order/review,
  `DECISIONS.log` and `handoff/LEDGER.md`.

Any other path requires a recorded scope amendment before edit.

## Required proof

1. Genuine intentional red proves the exact module/export absent.
2. One, multiple and 366 room nights across every approved component family preserve
   exact section order and add only approved `Qty`/`Unit` within `ItemList`.
3. Stripping `Qty`/`Unit` reproduces Order424 items byte-exact; Order425 items and
   lineage are preserved byte-exact without amount/rate/tax recalculation.
4. Orders424 and425 are separately load-bearing; coherent child mutations for source,
   count/order, family, currency, B2B, item ancestry or evidence hash independently
   reject even when outer hashes are recomputed.
5. `DocDtls` remains absent, both readiness flags stay false, input remains unchanged,
   replay is byte-equivalent, output is deeply frozen and tenant-hidden.
6. Orders413–425, standing/static/schema/referee gates remain green; a fresh
   non-implementing Tier-3 reviewer personally executes complete proof.

## Forbidden

No migration/schema/table/RLS/permission/SQL/transaction/read/write/lock/entity/event/
fact/outbox/idempotency; no amount/rate/tax/quantity recalculation; no alternate UQC;
no `DocDtls`, document/series/number/hash-chain/issue, complete/submission-ready claim,
provider certification/submission/IRN/QR, API/UI/seed/runtime/local/deploy/merge/push,
Phase7 or application-completion authority.

## Implementation evidence — D1282

- Genuine intentional red: the exact public composer export was absent and the
  dedicated test failed `0 pass, 1 fail` before any product implementation.
- Added the pure composer/export, exact fixed output/section/lineage order, independent
  Order424/425 composition, child-hash/source/count/order/family/INR/B2B/Order419-
  ancestry coherence, byte-exact compatibility stripping, canonical JSON, tenant-bound
  deterministic evidence, recursive freeze and tenant concealment.
- Permanent proof uses separately and coherently tenant-rehashed child mutations and
  requires the exact Order426 error class/message; it covers both children, source,
  count/order, family, currency, B2B, item ancestry/content, Qty, Unit and evidence hash.
- Focused, Orders413–426 composition, standing/static/preservation gates are recorded
  in D1282 and the ledger after execution. No database/runtime/local state changed.
- This implementation owner does not approve its own work. A fresh non-implementing
  Tier-3 reviewer must personally execute all proof before any downstream reliance.
