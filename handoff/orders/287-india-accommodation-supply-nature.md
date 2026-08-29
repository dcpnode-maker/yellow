# Order 287 — Build exact India accommodation supply-nature evidence

**Status:** READY-D755
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-accommodation-supply-nature`
**Base:** `c2a8c76` (independently approved Order286 descendant)
**Risk tier:** 3 — statutory India GST supply-nature composition; independent executable review mandatory
**Owner:** Codex implementation

## Outcome

Build one pure deterministic value function that combines complete approved
Orders283–286, requires both affirmative SEZ-status snapshots to match one explicit
property-local supply date, applies IGST section7(5)(b)'s to-or-by-SEZ override before
ordinary section7(3)/8(2) state comparison, and returns only frozen deterministic
intra-State/inter-State evidence with complete lineage. It does not decide levy,
`SupTyp`, zero rating, item, document or submission truth.

## Natural-Solution Test

Order283 deliberately stops at registered-state-versus-lodging-Pos relationship
because same-state alone is insufficient when either side is an SEZ unit/developer.
Orders284–286 now provide exact supplier establishment and affirmative bilateral
registration-status evidence without changing that approved comparison. One pure
composer is therefore the smallest natural place to apply the statutory precedence.
A table, writer or mutation of approved roots would duplicate evidence. Authorized
operations/zero rating and Form-G-to-F2 renewal continuity remain separate because
they answer different legal questions.

## Exact contract

- `buildIndiaGstAccommodationSupplyNature({tenantId,supplyDate,
  registeredStateComparison,supplierServiceLocation,recipientSezStatus,
  supplierSezStatus})` accepts only an exact plain accessor/proxy/symbol-free input;
- `supplyDate` is canonical `YYYY-MM-DD`; it must equal both exact upstream
  `statusAsOf` values. No prior/latest snapshot, server clock or statutory time-of-
  supply inference is permitted;
- every upstream value must be the complete exact recursively frozen approved result;
  independently revalidate and recompute every fixed-order tenant-bound upstream
  hash/JSON and require property/reservation/folio/jurisdiction/Pos, supplier
  registration/location and recipient Party/registration lineage to agree;
- precedence is exhaustive: any recipient SEZ status produces `to_sez`, any supplier
  SEZ status produces `by_sez`, both produce `to_and_by_sez`; all three are
  `inter_state` under `IGST_ACT_7_5_B` regardless of Order283 relationship. Only
  regular/regular reaches ordinary comparison: same yields `intra_state` under
  `IGST_ACT_8_2`, different yields `inter_state` under `IGST_ACT_7_3`;
- return a recursively frozen fixed-order candidate with property/reservation/folio,
  supply date, jurisdiction, complete minimized supplier/recipient/status/location,
  place-of-supply and registered-state-comparison lineage, `supplyNature`,
  `determinationBasis`, `sezDirection` and exact legal rule, followed by exact
  `candidateJson` and SHA-256 over `{tenantId,candidate}` while tenant remains
  unexposed;
- replay and every rejection preserve all caller bytes and perform no SQL, lock,
  write, fact, event, financial or fiscal effect.

## Exact scope

- new `src/contexts/tax-fiscal/india-gst-accommodation-supply-nature.ts`;
- `src/contexts/tax-fiscal/index.ts` export only;
- new intentional-red and hostile exhaustive tests;
- `docs/CONTRACTS.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`;
- `BUILD-PLAN.md`, `handoff/PHASE-7-PLAN.md`, `handoff/ROADMAP.md`;
- this order, decision, ledger and later independent review evidence.

## Forbidden

No `Tx`, SQL, table, migration, seed, RLS, grant, writer, lock, fact, event, journal,
posting, tax detail, invoice or submission. No recipient registered-state decision,
address/GSTIN/name/config fallback, earlier/latest/as-of inference or caller-owned
statutory time of supply. No Form-F2, authorized-operations/specified-officer
endorsement, zero-rating/refund/payment-mode/`SEZWP`/`SEZWOP`, `SupTyp`,
`IgstOnIntra`, reverse charge, CGST/SGST/UTGST/IGST decomposition/rate/amount,
rounding/residual, `ItemList`/item value, document/API/HTTP/UI/local/status/promotion,
dependency/merge/public deploy, Phase-7 or application-complete claim.

## Pre-registered proof

1. Intentional red proves the source and bounded-context export are absent.
2. Exhaust all18 combinations: two Order283 relationships × three supplier statuses
   × three recipient statuses; only regular/regular reaches ordinary7(3)/8(2), every
   other pair reaches7(5)(b), with exact none/to/by/both direction evidence.
3. Both status dates must exactly equal the explicit valid supply date; malformed,
   impossible, earlier/future/mismatched dates fail closed with no clock/latest path.
4. Independently rehash complete Orders283–286 and reject every property/reservation/
   folio/jurisdiction/Pos/state/Party/registration/location/status id/hash cross-mix.
5. Reject exact-shape, frozen, accessor/proxy/symbol, candidate JSON, nested approval,
   validity/status/source/rule and post-build mutation defects.
6. Recipient registered-state mutation never participates; GSTIN/address/name/config,
   missing status and Order283 alone cannot substitute for explicit bilateral truth.
7. Candidate ordering, JSON, tenant-bound hash, recursive freeze, replay and source
   immutability are byte exact.
8. Zero-effect oracles cover Orders283–286 sources, facts/outbox/idempotency,
   journals/postings/tax details/documents/submissions.
9. Static scans prove absence of levy/decomposition, `SupTyp`, authorized operations,
   zero rating, item/document/network/database and writer authority.
10. Focused, adjacent roots, unchanged exact53/105/95/95/5 schema/referee,
    standing/static and fresh non-implementing Tier-3 execution are green.

## Definition of done

- [ ] Intentional red precedes implementation.
- [ ] Exact exhaustive/hostile supply-nature proof is green.
- [ ] Standing/static/schema gates are green and no authority expands.
- [ ] Fresh independent Tier-3 approval is recorded.
