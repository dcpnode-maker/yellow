# Order 052 — Operator rate-price correction

**Phase:** 2 · Founder-review workbench
**Branch:** `phase-2/operator-rate-price-correction`
**Tier:** 3 — sanctioned money correction and concurrency
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Let an authorized hotel operator correct a current rate price by creating one immutable
successor. Keep every business-key field locked, preserve exact minor units, and prove
that concurrent corrections cannot fork history.

## Scope

- `DECISIONS.log`
- `docs/LOCAL-REVIEW.md`
- `handoff/LEDGER.md`
- `handoff/orders/052-operator-rate-price-correction.md`
- `src/app.ts`
- `src/http/operator.ts`
- `src/http/operator/index.html`
- `src/http/operator/operator.css`
- `src/http/operator/operator.js`
- `tests/operator-rate-price-correction.integration.test.ts`
- `tests/operator-rate-pricing.integration.test.ts` (dynamic-editor asset expectation only)

## Required behavior

1. `POST /api/v1/properties/:property/rate-prices/:ratePriceId/supersede` requires
   `rates.pricing:write`, a matching property grant and `Idempotency-Key`.
2. The exact-key body accepts only typed pricing with canonical unsigned decimal
   minor-unit strings. It converts every leaf to bigint before calling
   `RatePricingService.supersede`; JavaScript numbers and ambiguous strings fail before
   a durable claim.
3. The path id and pricing are the complete correction input. Plan, unit type, dates,
   mask, currency, tenant and property cannot be supplied or changed at the HTTP edge.
4. Durable idempotency and supersession execute inside the same tenant transaction.
   Typed or unexpected command errors escape settlement before stable outer 400/404/409
   or correlated generic 503 mapping.
5. Current lookup can load its exact row into a dynamic typed correction editor. It
   supports every domain-valid occupancy tier (1..100), optional extra adult, and up to
   20 strictly ordered child-age bands. Submission clearly creates auditable history;
   it never implies in-place edit or undo.

## Forbidden

- Migrations, `tests/run_invariants.py`, direct pricing UPDATE/DELETE, changing any
  business-key field, ordinary-create correction, floats, major-unit formatting, ISO
  exponent invention, FX, tax, derived plans, packages, promotions, negotiated rates,
  quotes, reservations, availability, restrictions, occupancy, holds, OOO/OOS, journal,
  fiscal, RLS, tenant middleware, token claims, new scopes, public hosting, generic JSON,
  direct SQL, browser persistence, AI-specific mutation, self-approval, merge, or
  independent-review claims.

## Pre-registered proofs

- **P0:** the complete focused file fails before the correction route and editor exist.
- **P1:** one HTTP correction creates one successor, links old to new, preserves every
  business-key field, round-trips unsafe-number-range strings, writes two facts and one
  money-free event, and leaves old pricing unchanged.
- **P2:** exact replay is byte-equivalent with no new artifact; changed body conflicts.
- **P3:** twenty simultaneous distinct-key corrections produce exactly one 201, nineteen
  typed 409 responses, one successor, two facts and one event—never a fork or loser claim.
- **P4:** missing key, unknown keys, invalid money/tiers/bands, missing scope, foreign
  property/tenant/source and repeat correction persist no successor or claim.
- **P5:** publisher failure rolls successor, link, both facts, event and claim back;
  same-key retry succeeds after the failing dependency is removed.
- **P6:** current lookup returns only the successor after correction.
- **P7:** the editor is same-origin, in-memory, keyboard-labelled, both-skin, responsive,
  dynamically complete for domain tier/band limits, and contains no generic JSON,
  business-key edit, float conversion, database shortcut or ordinary-create correction.
- **P8:** Orders 034/042/046/048/049/050/051 remain green; complete standing gate,
  schema drift, protected hashes and fresh 11/11 remain green.

## Standing checks

Run P1-P8 on fresh isolated databases, restart the complete standing gate after any D-92
stop, perform rendered desktop/responsive review including a real correction, refresh
Graphify, commit `[codex]`, push, and open a draft stacked PR. Do not approve or merge;
preserve independent review debt.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
