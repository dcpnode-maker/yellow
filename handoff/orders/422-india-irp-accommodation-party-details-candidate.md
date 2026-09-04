# Order 422 — India IRP accommodation party-details candidate

**Status:** ACTIVE — INPUT CLARIFIED — D1262
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** independently approved Order420 coordination head `ea97120`
**Risk tier:** 3 — statutory fiscal-payload fields
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Add one migration-free pure Tax-Fiscal composer that consumes the exact approved
Order413 accommodation source and emits only the IRP seller and buyer party sections,
with the separately approved property place-of-supply code added as `BuyerDtls.Pos`.
This remains intermediate evidence: it is not an invoice, document, complete payload,
provider call or submission.

## Natural-Solution Test

Order413 already re-resolves and binds approved seller registration, SellerDtls,
legal window buyer, recipient registration, BuyerDtls and property place-of-supply
truth. Reusing that complete source is the only safe authority. Mutable Party/account/
reservation display data and caller-supplied POS are not alternative sources.

## Exact contract

`composeIndiaIrpAccommodationPartyDetailsCandidate(input)` accepts only the exact
deeply frozen canonical tenant UUID and Order413 source result using the same pure
input shape already approved for Order414. It must invoke the approved Order414
numeric-source composer as a validation-only descendant, require its
`sourceEvidenceHash` to equal the supplied Order413 evidence hash, discard all numeric
output, and derive:

- exact approved `SellerDtls` without alteration;
- exact approved `BuyerDtls` identity/address fields plus `Pos` equal to the approved
  Order413 `placeOfSupply.pos`;
- fixed `irp_json_1_1` lineage containing the Order413 evidence hash, seller payload
  hash, buyer payload hash and place-of-supply candidate hash;
- deterministic fixed-order JSON and a tenant-bound evidence hash.

It must reject every malformed, mutable, proxy, accessor, symbol, sparse, cyclic,
surplus, stale, foreign or correctly rehashed unsupported source already rejected by
Order413, plus incoherent party payload/hash/POS lineage. The result is deeply frozen
and tenant-hidden.

## Exact scope

- new `src/contexts/tax-fiscal/india-irp-accommodation-party-details-candidate.ts`;
- `src/contexts/tax-fiscal/index.ts` public export;
- new exact intentional-red and permanent pure hostile/mutation tests;
- `docs/CONTRACTS.md`, Phase 7 `BUILD-PLAN.md`, this order/review,
  `DECISIONS.log` and `handoff/LEDGER.md`.

Any other path requires a recorded scope amendment before edit.

## Required proof

1. Genuine intentional red proves the exact module/export absent.
2. Trade-name present/absent fixtures prove exact field order and no optional-field
   invention beyond each approved source.
3. `BuyerDtls.Pos` equals approved property POS and cannot be caller-controlled.
4. Order414's complete pure revalidation of Order413 is demonstrably load-bearing
   under a permanent coherently rehashed party-specific hostile source mutation.
5. Input remains byte-unchanged; replay is byte-equivalent; output is deeply frozen;
   tenant affects only the evidence-hash preimage and is absent from output.
6. Orders413–420, schema/catalogue/referee, standing and static gates remain green;
   a fresh non-implementing Tier-3 reviewer personally executes complete proof.

## Forbidden

No migration/schema/table/RLS/permission/SQL/transaction/read/write/lock/entity/event/
fact/outbox/idempotency; no Party/account/reservation inference; no SupTyp/TranDtls,
ItemList/ValDtls/tax/rate/value calculation, Qty/UQC, document/series/number/hash-chain/
issue, provider/submission/IRN/QR, API/UI/seed/runtime/local/deploy/merge/push, Phase7
or application-completion authority.
