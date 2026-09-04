# Order 423 — India IRP ordinary-B2B transaction-details candidate

**Status:** ACTIVE — OUTPUT CLARIFIED — D1266
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/persisted-india-final-component-tax-evidence`
**Base:** independently approved Order422 coordination head `b77f129`
**Risk tier:** 3 — statutory fiscal-payload fields
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Add one migration-free pure Tax-Fiscal composer that consumes the exact approved
Order415 ordinary registered B2B result and emits only the IRP transaction-details
fields already authorized by approved India GST and supply-type evidence. This is
intermediate evidence, not a complete invoice payload or submission.

## Natural-Solution Test

Order415 already revalidates the complete Order414/413 statutory source and uniquely
authorizes ordinary registered non-SEZ `B2B`. The bound India GST jurisdiction and
registrations authorize tax scheme `GST`. No current approved source establishes
reverse charge, same-state IGST override or e-commerce GSTIN, so those optional fields
must be absent rather than defaulted.

## Exact contract

`composeIndiaIrpOrdinaryB2bTransactionDetailsCandidate(input)` accepts only the exact
deeply frozen canonical tenant UUID and Order413 source result using the approved
Order414/415 pure input shape. It must invoke Order415, require source evidence-hash
equality, and derive only:

- fixed `irp_json_1_1` payload `{TranDtls:{TaxSch:"GST",SupTyp:"B2B"}}`;
- exact outer key order `state`, `format`, `payload`, `payloadJson`, `lineage`,
  `sourceEvidenceHash`, `evidenceHash`, matching the approved Order422 convention;
- exact lineage key order `sourceEvidenceHash`, `supplyTypeEvidenceHash`, containing
  the Order413 source evidence hash and Order415 evidence hash;
- deterministic fixed-order JSON and a tenant-bound evidence hash.

It must reject every malformed, mutable, proxy, accessor, symbol, sparse, cyclic,
surplus, stale, foreign or correctly rehashed unsupported source already rejected by
Order415. The result is deeply frozen and tenant-hidden.

## Exact scope

- new `src/contexts/tax-fiscal/india-irp-ordinary-b2b-transaction-details-candidate.ts`;
- `src/contexts/tax-fiscal/index.ts` public export;
- new exact intentional-red and permanent pure hostile/mutation tests;
- `docs/CONTRACTS.md`, Phase 7 `BUILD-PLAN.md`, this order/review,
  `DECISIONS.log` and `handoff/LEDGER.md`.

Any other path requires a recorded scope amendment before edit.

## Required proof

1. Genuine intentional red proves the exact module/export absent.
2. Exact payload and field order are stable; `RegRev`, `IgstOnIntra`, `EcmGstin` and
   all unrelated transaction fields are absent.
3. Order415 is demonstrably load-bearing using the unchanged permanent
   `makeOrder419UnsupportedExportInput()` fixture: Order414 accepts its coherently
   rehashed numeric source while Order415 must reject it.
4. Input remains byte-unchanged; replay is byte-equivalent; output is deeply frozen;
   tenant affects only evidence-hash preimages and is absent from output.
5. Orders413–422, schema/catalogue/referee, standing and static gates remain green;
   a fresh non-implementing Tier-3 reviewer personally executes complete proof.

## Forbidden

No migration/schema/table/RLS/permission/SQL/transaction/read/write/lock/entity/event/
fact/outbox/idempotency; no reverse-charge or same-state-IGST inference/default, no
e-commerce GSTIN; no SellerDtls/BuyerDtls/DocDtls/ItemList/ValDtls, Qty/UQC, tax/rate/
value calculation, document/series/number/hash-chain/issue, provider/submission/IRN/
QR, API/UI/seed/runtime/local/deploy/merge/push, Phase7 or application-completion
authority.
