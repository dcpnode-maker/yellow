# Order 426 — India IRP accommodation validation-compatibility pre-document evidence assembly

**Status:** INDEPENDENTLY APPROVED — CLOSED — D1289
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

## Fresh Tier-3 finding — D1283

The exact candidate is not approved. Removing only the per-item compatibility source
backlink guard leaves the named compatibility-source test green because that probe
also corrupts outer source fields caught earlier. Add an isolated coherently rehashed
item-source-only projection, prove this guard mutation-red, rerun complete gates and
obtain a different fresh independent Tier-3 review. Product source was restored
byte-exact; no downstream authority exists.

## D1284 proof repair after D1283

D1283 correctly found that the compatibility-source mock changed outer, nested and
per-item source truth together. The harness now changes those three locations in
separate coherently tenant-rehashed child projections. Removing only the production
per-item `sourceEvidenceHash` guard makes its dedicated exact-class/exact-message test
red `0/1`; restoring the guard returns the focused suite to green.

The same audit separated child item count from declared count and child component
family from per-item family. Dedicated probes also cover Order424 tax scheme, format
and readiness plus Order425 state, so bundled earlier failures cannot stand in for
those assertions. Product code remains byte-exact to candidate `602f4ae`.

Repaired evidence: focused `31/0` (68 assertions), full India-IRP composition `138/0`
plus seven expected DB skips (1,182 assertions), standing `1,453/0` plus 1,054 expected
DB skips (20,638 assertions; 2,507 tests / 462 files), strict TypeScript, 159 import
boundaries, 23 licences, audit zero, image pins, protected inputs and diff green. A
different fresh non-implementing Tier-3 reviewer remains mandatory.

## Different fresh Tier-3 finding — D1286

D1283's per-item-source proof is repaired and mutation-red, but approval remains
withheld. Removing only the actual child-versus-pre-document item-count guard leaves
the named `compatibility count` test green because that mutation leaves the declared
count unchanged and the declared-count guard rejects it with the same expected
message. Add a coherently rehashed count mutation that changes both actual items and
declared count while preserving the pre-document count, prove the actual-count guard
red independently, rerun complete gates and obtain another different fresh Tier-3
review. Product source was restored byte-exact; no downstream authority exists.

## D1287 actual-versus-declared count proof repair

The compatibility `count` projection now coherently shortens both `items` and
`lineage.itemCount` while leaving the independently composed Order424 child unchanged.
It therefore reaches only the actual compatibility-child-versus-pre-document count
guard. Removing that guard makes the exact named test red `0/1` (the subprocess
reports the different later item-preservation error); restored production is green.

The separate `lineageCount` projection changes only `lineage.itemCount`. Removing only
the declared-count production guard makes its named exact-message test red `0/1`, and
restoration returns both isolated probes to green `2/0`. The remaining same-message
source, family, state and ancestry projections stay separated as recorded in D1284;
no other bundled mutation can satisfy either count oracle.

Product code remains byte-exact to `602f4ae`. Repaired complete gate evidence is
recorded in D1287 and the ledger. This implementer does not approve the repair; another
different fresh Tier-3 reviewer must personally execute the proof.

Restored gates: focused `31/0` (68 assertions), all India-IRP composition `138/0`
plus seven expected DB skips (1,182 assertions), and standing `1,452/0` plus 1,054
expected DB skips with one unrelated Order330 Chromium cleanup failure; immediate
isolated rerun passes `1/0` (4 assertions), matching the same transient previously
recorded by D1283. TypeScript, 159 boundaries, 23 licences, audit zero, image pins,
protected/product bytes and diff checks are green.

## D1289 another different fresh Tier-3 approval

Another different fresh independent non-implementing Tier-3 reviewer personally
removed only the actual compatibility-child-versus-pre-document count guard: the
exact named count probe became red `0/1` and surfaced the distinct later item-
preservation error. Removing only the declared-lineage-count guard independently
made its named probe red `0/1`; exact restoration returned the pair to `2/0`.

The reviewer separately made the repaired per-item source backlink, all four outer/
nested child-source fields, both child evidence hashes, child/per-item family,
`Qty`, `Unit`, and the shared Order419 ancestry gate mutation-red. These probes use
coherently tenant-rehashed children and exact error-class/message oracles, so no
unrelated or same-message rejection can satisfy the tested boundary. Exact Order424
and Order425 product inputs remain unchanged.

Restored proof passes focused `31/0` (68 assertions), all India-IRP composition
`138/0` plus seven expected database skips (1,182 assertions), and standing `1,453/0`
plus 1,054 expected database skips (20,638 assertions; 2,507 tests / 462 files) with
zero failures. Strict TypeScript, 159 import boundaries, 23 dependency licences,
audit zero, exact image pins, scope, protected-input and diff checks pass. Product
blob `2c41436f` and repaired test blob `d3ecb6d` are restored exact. Approval is
strictly bounded to this pure, false-readiness, non-certified assembly; it grants no
`DocDtls`, document issue, provider submission, IRN/QR, database/runtime/local,
Phase-7 or application-completion authority.
