# Order 278 — Build exact India IRP 1.1 buyer-details candidate

**Status:** BUILT-PENDING-REVIEW-D727
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-irp-buyer-details`
**Base:** `5fe42f5` (independently approved Orders276–277 descendant)
**Risk tier:** 3 — statutory payload semantics; independent executable review mandatory
**Owner:** Codex implementation

## Outcome

Build one pure deterministic `irp_json_1_1` `BuyerDtls` candidate projection from the
exact approved `IndiaGstRecipientRegistrationResult`. The transmitted candidate
contains only notified buyer identity/address fields while the wrapper retains Party,
registration and evidence lineage outside the payload. It is not legal invoice-window
buyer designation and is not a complete invoice payload.

## Natural-Solution Test

Order276 already resolves exact typed Party registration evidence. A second table,
entity or mutable Party/account/folio lookup would duplicate that truth. The next
smallest safe operation is therefore a pure value projection mirroring approved
Order275 SellerDtls. Persisted folio-window legal-buyer designation remains later
because designation authoring/change policy is not yet decided. Official notified
schema lists buyer POS separately as JSON attribute `Pos`, so this projection must not
invent or include place of supply.

## Exact contract

- `buildIndiaIrpBuyerDetails(source: unknown)` accepts only one exact deeply frozen,
  accessor-free Order276 result with exact canonical Party/registration ids, scheme
  `in-gstin`, evidence hash and registered identity/address truth;
- output format is exact `irp_json_1_1` with candidate payload
  `{ BuyerDtls: { Gstin, LglNm, TrdNm?, Addr1, Loc, Pin, Stcd } }`;
- `TrdNm` is omitted only for exact null source trade name; no `Addr2`, phone, email,
  `Pos`, `SupTyp`, seller, item, tax, value or document field is invented;
- fail closed at exact notified/current limits: GSTIN15/checksum/state match,
  legal/trade name <=100, address1 <=100, locality <=50, six-digit nonzero PIN
  converted to a number and exact current GST state/UT code;
- never trim, truncate, split, coerce, normalize or synthesize legal evidence;
- wrapper retains exact `partyId`, `registrationId` and `evidenceHash`, fixed-order
  deterministic `payloadJson` and SHA-256 `payloadHash`; lineage never enters JSON;
- source stays unchanged; wrapper, lineage, payload and BuyerDtls are recursively
  frozen and replay is byte-identical.

## Exact scope

- new `src/contexts/tax-fiscal/india-irp-buyer-details.ts`;
- `src/contexts/tax-fiscal/index.ts` export only;
- new `tests/india-irp-buyer-details.intentional-red.test.ts`;
- new `tests/india-irp-buyer-details.test.ts`;
- adjacent Order275/276 proof;
- `docs/CONTRACTS.md`, `docs/EXTENSIONS.md`, `BUILD-PLAN.md`,
  `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`;
- this order, decision, ledger and later independent review evidence.

## Forbidden

No legal invoice buyer or folio-window designation; no `Pos`, supply-type, B2C `URP`,
export, SEZ, deemed export, CGST/SGST/IGST, item/value/tax computation, document
allocation/issue/number/hash chain, submission, provider/API/HTTP/UI; no Tx/SQL/
database/schema/migration/seed/credential/local/status/dependency/merge/public deploy,
Phase7 or application-complete claim.

## Pre-registered proof

1. Intentional red proves the exact new module/export is absent.
2. Exact happy payload/bytes, null-trade omission, three-field lineage isolation,
   fixed order, source immutability, recursive freeze, replay and SHA-256 are exact.
3. Surplus/missing/accessor/symbol/proxy and every UUID/hash/identity/length/checksum/
   state/PIN mismatch fail closed with no trimming/splitting/coercion.
4. Static effect oracle proves no Tx/SQL/service/fetch/event/document/financial/fiscal
   write authority and exact absence of `Pos`; focused, adjacent, standing/static pass.
5. Fresh non-implementing Tier-3 reviewer personally executes the complete proof.

## Definition of done

- [x] Intentional red precedes implementation.
- [x] Exact pure candidate projection and hostile proof are green.
- [x] Standing/static gates are green and no authority expands.
- [ ] Fresh independent Tier-3 approval is recorded.
