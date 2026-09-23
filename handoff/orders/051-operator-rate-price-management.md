# Order 051 — Operator rate-price management

**Phase:** 2 · Founder-review workbench
**Branch:** `phase-2/operator-rate-price-management`
**Tier:** 3 — authenticated money-bearing rate configuration
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Let an authorized hotel operator create exact append-only rate prices and query the
current PostgreSQL-selected price for a stay date. Preserve every minor unit by using
canonical decimal strings at HTTP/browser boundaries and bigint inside the domain.

## Scope

- `DECISIONS.log`
- `docs/LOCAL-REVIEW.md`
- `handoff/LEDGER.md`
- `handoff/orders/051-operator-rate-price-management.md`
- `handoff/questions/056-order-051-idempotent-response-bytes.md`
- `handoff/questions/056-ARCHITECT-RESPONSE.md`
- `scripts/seed-review.ts`
- `src/app.ts`
- `src/http/operator.ts`
- `src/http/operator/index.html`
- `src/http/operator/operator.css`
- `src/http/operator/operator.js`
- `src/server.ts`
- `tests/operator-rate-pricing.integration.test.ts`
- `tests/operator-inventory.integration.test.ts` (exact nine-scope expectation only)
- `tests/operator-restrictions.integration.test.ts` (exact nine-scope expectation only)
- `tests/operator-rate-configuration.integration.test.ts` (exact nine-scope expectation only)
- `tests/review-seed.integration.test.ts` (exact nine-scope expectation only)

## Required behavior

1. Add exact scopes `rates.pricing:read` and `rates.pricing:write`; the deterministic
   local review role gains both.
2. A property-authorized read endpoint accepts exact plan, unit type and real stay date,
   then calls `RatePricingService.findCurrent`. It returns every monetary leaf as an
   unquoted-in-domain but JSON string boundary value and exposes no foreign row.
3. A property-authorized idempotent create endpoint accepts exact IDs, half-open dates,
   weekday mask and typed pricing. Every amount is a canonical unsigned decimal string in
   signed-bigint range; JavaScript numbers, signs, exponents, decimals and leading zeros
   are rejected before a claim.
4. Creation uses `PostgresIdempotency.execute` and `RatePricingService.create` in the same
   tenant transaction. Typed and unexpected command failures escape settlement before the
   outer boundary maps stable 400/404/409 or correlated generic 503.
5. Extend the single Rates workbench with a price step: plan/unit selectors, half-open
   dates, weekday choices, occupancy tiers, and progressively disclosed extra-adult and
   ordered child bands. Clearly label amounts as exact minor units and current lookup as
   PostgreSQL truth, not a quote or tax calculation.

## Forbidden

- Migrations, `tests/run_invariants.py`, supersession/correction, update/delete, floats,
  major-unit formatting, ISO currency exponent invention, FX, tax calculation, derived
  plans, packages, promotions, negotiated rates, quotes, reservations, availability,
  restrictions, occupancy, holds, OOO/OOS, journal, fiscal, RLS, tenant middleware, token
  claims, public hosting, generic JSON, direct SQL, browser persistence, AI-specific
  mutation, self-approval, merge, or independent-review claims.

## Pre-registered proofs

- **P0:** complete focused file fails before pricing routes/service/UI exist.
- **P1:** current lookup returns an exact unsafe-number-range amount as a string and obeys
  PostgreSQL date/mask/latest truth with tenant/property authorization.
- **P2:** create accepts exact string amounts, persists JSONB numeric leaves, and returns
  byte-exact strings with one fact/event and no money in the event.
- **P3:** exact replay is byte-equivalent with no new artifacts; changed request conflicts.
- **P4:** missing key, unknown keys, number/sign/exponent/decimal/leading-zero/overflow
  amounts, malformed tiers/bands/dates/masks, missing scope, foreign property/tenant and
  foreign plan/unit persist no price or claim.
- **P5:** publisher failure rolls price, fact, event and claim back; same-key retry succeeds
  after removing the failing dependency.
- **P6:** UI is same-origin, in-memory only, accessible, both-skin, responsive, typed and
  contains no generic JSON, float conversion, database shortcut or supersession control.
- **P7:** Orders 033/042/046/048/049/050 remain green with exact nine-scope login; complete
  standing gate, schema drift, protected hashes and fresh 11/11 remain green.

## Standing checks

Run P1-P7 on fresh isolated databases, restart the complete standing gate after any D-92
stop, perform rendered desktop/responsive review, refresh Graphify, commit `[codex]`, push,
and open a draft stacked PR. Do not approve or merge; preserve independent review debt.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
