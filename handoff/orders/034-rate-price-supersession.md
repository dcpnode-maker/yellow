# Order 034 — Race-safe rate-price supersession

**Phase:** 2 · Slice 2C
**Branch:** `phase-2/rate-price-supersession`
**Tier:** 3 — sanctioned insert-only correction link
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Correct a current price with one immutable successor and prevent concurrent forks.

## Scope

- `DECISIONS.log`
- `docs/EVENTS.md`
- `handoff/orders/034-rate-price-supersession.md`
- `src/contexts/rates/index.ts`
- `src/contexts/rates/pricing.ts`
- `tests/rate-price-supersession.integration.test.ts`

## Required behavior

1. Lock an unsuperseded tenant/property price before inserting its exact-key successor.
2. Preserve plan, unit type, half-open dates, mask, tenant, property, and currency; only
   exact bigint pricing may change.
3. Update only the old row's `superseded_by`, once, to the new row id.
4. Record one fact for the changed old row and one for the new row, then publish one
   `rate_price.superseded` event without monetary payload.
5. Reject already-superseded, foreign, malformed, and concurrently losing attempts.

## Forbidden

- Updating pricing or any column except old `superseded_by`; deletion; changing the
  business key; migrations; RLS; referee; rate plan/policy mutation; tax, FX,
  restrictions, quote/reservation, availability, occupancy, HTTP/UI, cache/projection.
- Self-approval or merge.

## Pre-registered proofs

- **P1:** one correction creates one successor, links old→new, preserves the exact key,
  round-trips bigint, writes exactly two facts and one event.
- **P2:** 20 concurrent corrections yield exactly one winner, 19 typed conflicts, one
  successor, two facts, and one event—never a fork.
- **P3:** repeat correction, tenant B, wrong property, malformed money fail closed.
- **P4:** publisher failure rolls back successor, link, and both facts.
- **P5:** current lookup returns the successor and never the superseded source.
- **P6:** pre-existing canonical rows and unrelated current prices remain unchanged.
- **P7:** standing checks, schema drift, and canonical 11/11 remain green.

## Standing checks

Run the Order 034 database proof with its required flag, typecheck, boundaries, full
tests, licence policy, audit, schema drift, and `./setup.sh --db-only`. Commit and push
only when all are green. Do not merge.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
