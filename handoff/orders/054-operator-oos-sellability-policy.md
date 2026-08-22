# Order 054 — Operator OOS sellability policy

**Phase:** 2 · Founder-review workbench
**Branch:** `phase-2/operator-oos-sellability-policy`
**Tier:** 2 — audited per-property hotel configuration
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Let an authorized hotel choose whether out-of-service rooms are blocked from sale or
remain sellable with a visible warning, without making physical out-of-order removal
configurable.

## Scope

- `DECISIONS.log`
- `docs/LOCAL-REVIEW.md`
- `handoff/LEDGER.md`
- `handoff/orders/054-operator-oos-sellability-policy.md`
- `scripts/seed-review.ts`
- `src/app.ts`
- `src/server.ts`
- `src/http/operator.ts`
- `src/http/operator/index.html`
- `src/http/operator/operator.css`
- `src/http/operator/operator.js`
- `tests/operator-oos-policy.integration.test.ts`
- `tests/operator-inventory.integration.test.ts` (exact scope assertion only)
- `tests/operator-restrictions.integration.test.ts` (exact scope assertion only)
- `tests/operator-rate-configuration.integration.test.ts` (exact scope assertion only)
- `tests/operator-rate-pricing.integration.test.ts` (exact scope assertion only)
- `tests/operator-operational-blocks.integration.test.ts` (exact scope assertion only)

## Required behavior

1. `GET /api/v1/properties/:property/inventory-policy` requires
   `inventory.policy:read`, exact-or-ancestor property authorization and one
   `InventoryPolicyService.get` call. Absence returns exactly `blocked` without evidence.
2. Idempotent `POST /inventory-policy/oos-sellability` requires
   `inventory.policy:write`, a matching property grant and exact body
   `{oosSellability:'blocked'|'allowed'}`. It calls only `setOosSellability` with the
   existing `inventory.policy.changed` audit operation.
3. Stable domain or unexpected errors escape idempotency settlement so config, fact,
   event and claim roll back together before outer HTTP mapping.
4. The Operations view displays the current PostgreSQL policy, its default, and a typed
   two-choice control. Copy states allowed means sellable with warning and never affects
   OOO physical removal. Saving is audited and safe to retry.

## Forbidden

- OOO/OOS or occupancy writes, occupancy functions, operational-block lifecycle edits,
  availability/restriction/hold/reservation logic, generic config patching, extra policy
  values, migrations, RLS, tenant middleware, token shape, journal/fiscal, public
  hosting, persistence, self-approval or merge.

## Pre-registered proofs

- **P0:** the complete focused file fails before policy routes, scopes, wiring and view exist.
- **P1:** authorized read of absent policy returns exactly blocked with no evidence.
- **P2:** setting allowed preserves unrelated config including unsafe-range JSON numeric
  text and commits one exact fact/event plus durable response; replay is byte-equivalent.
- **P3:** a new-key effective no-op writes no fact/event; changed-body key reuse conflicts;
  setting blocked with a new key writes one exact reverse transition.
- **P4:** malformed/unknown/missing-key, missing-scope, foreign property/tenant and
  malformed stored config fail without config, fact, event or durable claim mutation.
- **P5:** publisher failure rolls config, fact, event and claim back; same-key retry with
  the real dependency succeeds.
- **P6:** the unchanged Order 038 concurrent opposite-write proof remains green and the
  HTTP surface introduces no alternate update path.
- **P7:** the same-origin responsive both-skin Operations UI exposes exactly two choices,
  current/default state, warning semantics and immutable OOO copy with no generic config.
- **P8:** Orders 038/040/053 and operator Orders 048-053 remain green; standing checks,
  schema drift, protected hashes and fresh 11/11 remain green.

## Standing checks

Run P1-P8 on fresh isolated databases, restart after any D-92 stop, perform rendered
desktop/responsive policy-change review, refresh Graphify, commit `[codex]`, push, and
open a draft stacked PR. Do not approve or merge; preserve independent review debt.
