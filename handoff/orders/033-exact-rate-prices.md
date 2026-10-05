# Order 033 — Exact bigint rate prices and current lookup

**Phase:** 2 · Slice 2B
**Branch:** `phase-2/rate-prices`
**Tier:** 3 — money invariant and authoritative rate lookup
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Insert audited, tenant-safe rate prices without losing a minor unit at the JSONB
boundary, then read the latest applicable PostgreSQL truth for a stay date.

## Scope

- `DECISIONS.log`
- `docs/EVENTS.md`
- `handoff/orders/033-exact-rate-prices.md`
- `src/contexts/rates/index.ts`
- `src/contexts/rates/pricing.ts`
- `tests/rate-pricing.integration.test.ts`

## Required behavior

1. Accept only bigint monetary inputs in signed-bigint range and persist JSONB numeric
   leaves exactly; never pass money through JavaScript `number`.
2. Require an active rate plan and unit type in the same active tenant property.
3. Use non-empty half-open date ranges, masks 1..127, non-empty occupancy tiers, and
   strictly ordered child age bands.
4. Return monetary leaves as bigint and the owning plan's currency.
5. Current lookup uses PostgreSQL date containment and weekday mask, then deterministic
   latest `recorded_at,id` precedence.
6. Each insert records one fact and one `rate_price.created` event atomically; the event
   contains identifiers/range/mask/currency, not monetary values.

## Forbidden

- Updating `superseded_by`, any other update/delete, prices derived from floats, FX,
  tax calculations, restrictions, packages, promotions, negotiated rates, quotes,
  reservations, availability, occupancy, HTTP/UI, projections, or caches.
- Migrations, schema snapshots, RLS, tenant middleware, or referee changes.
- Self-approval or merge.

## Pre-registered proofs

- **P1:** values above JavaScript's safe-integer limit and signed-bigint max round-trip
  exactly as bigint while PostgreSQL stores JSON numeric leaves.
- **P2:** foreign tenant/property/plan/unit combinations are rejected with no artifact.
- **P3:** number inputs, overflow, malformed ranges/masks/tiers/bands fail before insert.
- **P4:** publisher failure rolls price and fact back together.
- **P5:** date containment, weekday bits, and latest exact-key precedence select the
  expected row; a non-applicable day returns not found.
- **P6:** tenant B cannot read tenant A prices and events contain no monetary payload.
- **P7:** all rows remain unsuperseded and no existing rate_price row is changed.
- **P8:** standing checks, schema drift, and canonical 11/11 remain green.

## Standing checks

Run the Order 033 database proof with its required flag, typecheck, boundaries, full
tests, licence policy, audit, schema drift, and `./setup.sh --db-only`. Commit and push
only when all are green. Do not merge.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
