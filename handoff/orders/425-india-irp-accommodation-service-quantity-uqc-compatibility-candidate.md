# Order 425 — India IRP accommodation service quantity/UQC compatibility candidate

**Status:** REPAIRED — AWAITING DIFFERENT FRESH INDEPENDENT TIER-3 — D1279
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** independently approved Order424 coordination head `d5b2aa5`
**Risk tier:** 3 — statutory fiscal-payload fields
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Add one migration-free pure Tax-Fiscal composer that enriches exact approved Order419
one-item-per-room-night service candidates with `Qty:"1.000"` and `Unit:"OTH"` solely
as current IRP validation-compatibility evidence. It is not provider-certified or
submission-ready until authenticated sandbox proof.

## Natural-Solution Test

Current official layers conflict: the notified schema and IRIS web-form describe
quantity/unit as optional for services, while the current IRIS validation catalogue
unconditionally lists missing-quantity/UQC errors 2238/2239. Order419 already defines
each line as exactly one room-night and `UnitPrice === TotAmt`, making one the only
positive quantity that preserves that exact arithmetic without recalculation. GSTN
guidance permits `OTH` for services and IRIS states its UQC master mirrors GSTN. These
are compatibility constants, not configurable commercial quantity or a claim of
provider acceptance.

## Exact contract

`composeIndiaIrpAccommodationServiceQuantityUqcCompatibilityCandidate(input)` accepts
only the approved Order419 exact deeply frozen input, invokes Order419, and emits one
item per unchanged candidate with exact schema order: `SlNo`, `IsServc`, `HsnCd`,
`Qty`, `Unit`, `UnitPrice`, `TotAmt`, `AssAmt`, `GstRt`, applicable component fields,
`TotItemVal`. `Qty` is exactly `1.000`; `Unit` exactly `OTH`.

The fixed result has exact outer key order `state`, `supplyTypeCode`, `currency`,
`items`, `lineage`, `sourceEvidenceHash`, `evidenceHash`; state is
`eligible_irp_accommodation_service_quantity_uqc_compatibility_candidate`. Exact
lineage key order is `itemCandidateEvidenceHash`, `sourceEvidenceHash`, `itemCount`,
`componentFamily`. Every item retains exact `{irp,lineage}` order and byte-exact
inherited Order419 lineage. The IRP key order is:

- IGST: `SlNo`, `IsServc`, `HsnCd`, `Qty`, `Unit`, `UnitPrice`, `TotAmt`, `AssAmt`,
  `GstRt`, `IgstAmt`, `TotItemVal`;
- split family: the same prefix, then `CgstAmt`, `SgstAmt`, `TotItemVal`.

The result retains item count/order, exact Order419 source/evidence backlinks,
component family and B2B/INR truth; uses tenant-bound deterministic hashing, recursive
freeze and tenant concealment. It must reject any condition where inherited
`UnitPrice` and `TotAmt` differ. Because approved Order419 derives both from the same
value, that defense-in-depth guard is exercised only through a controlled child/
projection mutation, never misrepresented as a valid public-input path. No child
amount is recalculated.

## Exact scope

- new `src/contexts/tax-fiscal/india-irp-accommodation-service-quantity-uqc-compatibility-candidate.ts`;
- `src/contexts/tax-fiscal/index.ts` public export;
- new exact intentional-red and permanent pure hostile/mutation tests;
- `docs/CONTRACTS.md`, Phase 7 `BUILD-PLAN.md`, this order/review,
  `DECISIONS.log` and `handoff/LEDGER.md`.

Any other path requires a recorded scope amendment before edit.

## Required proof

1. Genuine intentional red proves the exact module/export absent.
2. One, multiple and 366 room nights across every approved component family produce
   exact `Qty:1.000`, `Unit:OTH`, unchanged count/order and byte-exact child values.
3. Structural field-order/absence proof shows no other optional item field is added;
   callers cannot supply quantity/UQC.
4. Order419 remains demonstrably load-bearing under its coherent unsupported-supply
   mutation; inherited lineage/hash/count/family/currency/B2B mismatches reject;
   controlled mutation proves the otherwise unreachable UnitPrice/TotAmt guard.
5. Input remains unchanged; replay is byte-equivalent; output is deeply frozen and
   tenant-hidden; removal of compatibility fields turns permanent 2238/2239 coverage
   red.
6. Orders413–424, standing/static/schema/referee gates remain green; a fresh
   non-implementing Tier-3 reviewer personally executes complete proof.

## Forbidden

No migration/schema/table/RLS/permission/SQL/transaction/read/write/lock/entity/event/
fact/outbox/idempotency; no quantity aggregation or derivation from stays/rooms/guest
counts; no UQC alternative/configuration or claim that `OTH` is provider-certified;
no amount/rate/tax recalculation/rerounding; no complete/submission-ready payload,
DocDtls, document/series/number/hash-chain/issue, provider/submission/IRN/QR, API/UI/
seed/runtime/local/deploy/merge/push, Phase7 or application-completion authority.

## D1277 implementation evidence

Genuine intentional red `0/1` preceded the exact module and export. The pure composer
now invokes approved Order419, validates its source/evidence/count/family/currency/B2B
coherence, rejects inherited `UnitPrice != TotAmt`, and inserts only exact fixed-order
`Qty:"1.000"` and `Unit:"OTH"` while preserving all child values and item lineage.
Focused proof passes `8/0` (96 assertions), including every family, 1/2/366 nights,
structural exclusion, recursive freeze, tenant binding/hiding, hostile input and six
controlled child mismatch projections. Orders413–425 composition passes `81/0` plus
7 expected database skips (892 assertions); standing passes `1414/0` plus 1,054
expected database skips (20,567 assertions; 2,468 tests/460 files). Strict TypeScript,
158 import boundaries, 23 dependency licences, audit zero, image pins and diff checks
pass. Unchanged schema/referee proof and fresh independent Tier-3 review remain
mandatory before approval.

## D1279 proof repair

Every controlled child projection now retains an unmocked original Order419 composer,
uses normalized module identity, recomputes the mutated child's exact tenant-bound
evidence hash, and accepts only the named Order425 validation class and exact guard
message. Amount, count, family, order, currency, B2B, outer source, per-item source and
evidence-hash mutations are separate permanent tests, so unrelated exceptions cannot
produce green evidence. Production additionally binds inherited count to the approved
source room-night count and independently revalidates the Order419 evidence hash.

Removing each amount, B2B, count, family/order, currency, source or evidence guard was
personally observed to turn the intended permanent case red; restored focused proof is
`16/0` (99 assertions). Orders413–425 composition is `89/0` plus 7 expected database
skips (895 assertions); standing is `1422/0` plus 1,054 expected database skips
(20,570 assertions; 2,476 tests/460 files). TypeScript, 158 boundaries, 23 licences,
audit zero, image pins and diff are green. A different fresh Tier-3 review is mandatory.
