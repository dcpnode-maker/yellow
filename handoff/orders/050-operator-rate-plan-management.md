# Order 050 — Operator rate-plan management

**Phase:** 2 · Founder-review workbench
**Branch:** `phase-2/operator-rate-plan-management`
**Tier:** 3 — authenticated commercial policy and rate-plan mutations
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Let an authorized hotel operator list and create the existing validated policy and base
rate-plan configurations from the local workbench. Offer a simple progressive authoring
path without exposing generic JSON, money-bearing prices, derivation, or a privileged AI
write path.

## Scope

- `DECISIONS.log`
- `docs/LOCAL-REVIEW.md`
- `handoff/LEDGER.md`
- `handoff/orders/050-operator-rate-plan-management.md`
- `scripts/seed-review.ts`
- `src/app.ts`
- `src/http/operator.ts`
- `src/http/operator/index.html`
- `src/http/operator/operator.css`
- `src/http/operator/operator.js`
- `src/server.ts`
- `tests/operator-rate-configuration.integration.test.ts`
- `tests/operator-inventory.integration.test.ts` (exact seven-scope expectation only)
- `tests/operator-restrictions.integration.test.ts` (exact seven-scope expectation only)
- `tests/review-seed.integration.test.ts` (exact seven-scope expectation only)

## Required behavior

1. Add exact coarse scopes `rates.configuration:read` and
   `rates.configuration:write`; the deterministic local review role gains both.
2. `GET /api/v1/properties/:property/rate-configuration` requires rate-read and a
   matching exact-or-ancestor property grant, then returns `RateConfigurationService`
   policies and property rate plans in their existing deterministic order.
3. `POST .../rate-configuration/policies` accepts an exact-key `kind`, `name`, `content`
   body supported by D-131. It requires rate-write, a matching property grant, and
   `Idempotency-Key`; policy remains tenant-wide but the authorized property supplies its
   audit/business-date envelope.
4. `POST .../rate-configuration/rate-plans` accepts only the existing base-plan fields.
   It requires the same write boundary and replay contract. Parent, derivation and price
   fields are impossible at this edge.
5. Both creates use `PostgresIdempotency.execute` and `RateConfigurationService` inside
   tenant middleware's transaction. Typed or unexpected command errors escape settlement
   before the outer boundary maps stable 400/404/409 or correlated generic 503.
6. Add one Rates workbench domain under the shared skins. Show policy and base-plan lists,
   a progressive validated policy form for all four supported kinds, and a base-plan form
   with currency, tax treatment, market/source codes and exact-kind policy selectors.
   Explain that prices and derived plans are separate later steps.

## Forbidden

- Migrations, `tests/run_invariants.py`, rate prices or money amounts, price
  supersession, derived/parent plans, packages, promotions, negotiated rates, quotes,
  revenue automation, occupancy, holds, OOO/OOS, restrictions, availability evaluation,
  journal, fiscal, RLS, tenant middleware, token claims, update/delete, or public hosting.
- Generic JSON editing, direct SQL, caller-supplied tenant/actor/source, browser
  persistence, AI-specific mutation, self-approval, merge, or independent-review claims.

## Pre-registered proofs

- **P0:** complete focused file fails before rate routes/service/UI exist.
- **P1:** authorized snapshot is deterministic and tenant/property isolated.
- **P2:** all four supported policy kinds create through the HTTP boundary with exact
  rows, JSON object content, facts and events.
- **P3:** a base plan with exact-kind policy references creates and rereads with
  parent/derivation null and no rate-price row.
- **P4:** exact replay is byte-equivalent with no new artifacts; changed request conflicts.
- **P5:** missing key, unknown keys, malformed policy/plan content, wrong-kind reference,
  missing scope, foreign property and foreign tenant persist no domain row or claim.
- **P6:** publisher failure rolls domain row, fact, event and claim back; same-key retry
  succeeds after the failing dependency is removed.
- **P7:** UI is same-origin, in-memory only, accessible, both-skin, progressively reveals
  exact typed fields, and contains no generic JSON or database shortcut.
- **P8:** review seed and Orders 042/048/049 remain green with exact seven-scope login;
  complete standing gate, schema drift, protected hashes and fresh 11/11 remain green.

## Standing checks

Run P1-P8 on fresh isolated databases, restart the complete standing gate after any
D-92 stop, perform rendered desktop/responsive review, refresh Graphify, commit `[codex]`,
push, and open a draft stacked PR. Do not approve or merge; preserve independent review
debt.
