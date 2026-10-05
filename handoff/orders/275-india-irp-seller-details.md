# Order 275 — Build exact India IRP 1.1 seller details

**Status:** APPROVED-D719
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-irp-seller-details`
**Base:** `71b2c34` (independently approved Order274 descendant)
**Risk tier:** 3 — statutory payload semantics; independent executable review mandatory
**Owner:** Codex implementation

## Outcome

Build one pure deterministic `irp_json_1_1` `SellerDtls` projection from the exact
approved `IndiaGstSupplierRegistrationResult`. The transmitted payload contains only
the notified seller fields while the wrapper retains registration/evidence lineage
and a deterministic payload hash outside the payload.

## Exact contract

- `buildIndiaIrpSellerDetails(source: unknown)` accepts only one exact plain,
  accessor-free Order272 supplier result with scheme `in-gstin`, currency `INR`,
  canonical evidence hash and complete frozen jurisdiction identity;
- output format is exact `irp_json_1_1` with payload
  `{ SellerDtls: { Gstin, LglNm, TrdNm?, Addr1, Loc, Pin, Stcd } }`;
- `TrdNm` is omitted only for exact null source trade name; no `Addr2`, phone, email,
  recipient, place-of-supply, tax, value or document field is invented;
- IRP limits fail closed: GSTIN15, legal/trade name at most100, address1 at most100,
  locality at most50, exact six-digit nonzero PIN converted to a number, and exact
  current GST state/UT code;
- never trim, truncate, split, coerce or otherwise alter legal identity evidence;
- wrapper retains exact `registrationId` and `evidenceHash`, deterministic fixed-order
  `payloadJson` and SHA-256 `payloadHash`; lineage never enters transmitted JSON;
- source remains unchanged; wrapper, lineage, payload and seller details are deeply
  frozen and replay is byte-identical.

## Exact scope

- new `src/contexts/tax-fiscal/india-irp-seller-details.ts`;
- `src/contexts/tax-fiscal/index.ts` export only;
- new `tests/india-irp-seller-details.intentional-red.test.ts`;
- new `tests/india-irp-seller-details.test.ts`;
- adjacent Order272 proof;
- `docs/CONTRACTS.md`, `docs/EXTENSIONS.md`, `BUILD-PLAN.md`,
  `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`;
- this order, decision, ledger and later independent review evidence.

## Forbidden

No buyer, recipient, SEZ, place-of-supply or supply-type policy; no CGST/SGST/IGST,
item/value/tax computation, document allocation/issue/number/hash chain, submission,
provider/API/HTTP/UI; no database, transaction, SQL, schema, migration, seed,
credential, local/status, dependency, merge/public deploy, Phase7 or application-
complete claim.

## Pre-registered proof

1. Intentional red proves the new module/export is absent before implementation.
2. Exact happy payload and byte string, null trade-name omission, lineage isolation,
   fixed order, deep freeze, source immutability, replay and SHA-256 are exact.
3. Surplus/missing/accessor/symbol/proxy and every identity/length/checksum/state/PIN/
   evidence mismatch fail closed; no truncation/splitting/coercion occurs.
4. Static effect oracle proves no Tx/SQL/service/fetch/event/document/financial/fiscal
   write authority; focused, Order272-adjacent, standing and static gates pass.
5. Fresh non-implementing Tier-3 reviewer personally executes the proof.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact pure projection and hostile proof are green.
- [x] Standing/static gates are green and no authority expands.
- [x] Fresh independent Tier-3 approval is recorded.
