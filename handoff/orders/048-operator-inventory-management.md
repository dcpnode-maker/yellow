# Order 048 — Operator inventory management

**Phase:** 2 · Founder-review workbench
**Branch:** `phase-2/operator-inventory-management`
**Tier:** 3 — authenticated tenant/property-scoped mutations
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Make the local workbench useful for hotel setup: an authorized operator can inspect real
unit types, spaces and sellable units, then create each aggregate through the existing
audited `InventoryService`. Every POST uses Order 047's durable idempotency primitive in
the same tenant transaction. Apple-calm and Pixel-expressive remain interchangeable token
skins over one semantic UI.

## Scope

- `DECISIONS.log`
- `docs/LOCAL-REVIEW.md`
- `handoff/LEDGER.md`
- `handoff/orders/048-operator-inventory-management.md`
- `handoff/questions/053-ARCHITECT-RESPONSE.md`
- `handoff/questions/053-order-048-rollback-and-browser-probe.md`
- `scripts/seed-review.ts`
- `src/app.ts`
- `src/http/operator.ts`
- `src/http/operator/index.html`
- `src/http/operator/operator.css`
- `src/http/operator/operator.js`
- `src/server.ts`
- `tests/operator-inventory.integration.test.ts`
- `tests/operator-workbench.integration.test.ts`
- `tests/review-seed.integration.test.ts`

## Required behavior

1. Add exact coarse scopes `inventory.configuration:read` and
   `inventory.configuration:write`; the local review role receives both plus the existing
   availability scope. Login still derives scopes from current database permissions.
2. `GET /api/v1/properties/:property/inventory` requires configuration-read plus an
   exact-or-ancestor grant carrying that permission, then returns deterministic unit
   types, spaces and sellable units from `InventoryService`.
3. Three POST routes create unit types, spaces and sellable units. Each requires
   configuration-write plus a matching property grant, strict exact-key JSON, and an
   `Idempotency-Key` header. Unknown fields, malformed values and missing keys fail closed.
4. Each mutation calls `PostgresIdempotency.execute` and the matching `InventoryService`
   command inside the transaction already opened by tenant middleware. The property is
   part of the hashed request identity. Success is 201; exact replay returns the exact
   body/status and a replay header; changed-request key reuse is 409.
5. Validation/conflict/not-found errors are stable 400/409/404 responses. Unexpected
   infrastructure errors remain generic correlated no-store 503 responses with no driver
   or credential leakage.
6. The workbench adds Inventory as a progressive-disclosure domain beside Availability,
   exposes the signed-in operator and selected property, renders real counts/lists, and
   provides accessible create forms in dependency order. It never writes tables directly,
   persists tokens/keys/themes, or invents success.

## Forbidden

- Any migration, `tests/run_invariants.py`, occupancy, holds, OOO/OOS, restrictions,
  rates, journal, fiscal, RLS, tenant middleware, token claim, or public-hosting change.
- Update/delete/bulk-import semantics, implicit room generation, client-chosen actor or
  tenant, generic JSON patching, direct SQL from HTTP/UI, or process-memory idempotency.
- Separate implementations per theme, hidden protected states, committed passwords,
  approval, merge, or claims of independent review.

## Pre-registered proofs

- **P0:** the complete new integration file fails before routes/services/scopes exist;
  preserve the red output.
- **P1:** configuration-read returns the exact deterministic seeded inventory only for a
  token with the matching property grant.
- **P2:** each POST creates one aggregate, one fact and one outbox event through the
  production service and returns 201 with no-store/correlation metadata.
- **P3:** exact sequential retry returns the byte-equivalent response and creates no
  additional aggregate/fact/event; changed request with the same key returns 409.
- **P4:** missing/malformed idempotency, unknown/body-shape input, missing scope, foreign
  property and foreign tenant all fail without domain or idempotency artifacts.
- **P5:** publisher failure rolls back both domain and idempotency records; retry succeeds.
- **P6:** assets use same-origin APIs, in-memory token/idempotency values, both token skins,
  accessible inventory controls and no direct database/persistence shortcut.
- **P7:** review seed is an exact no-op on rerun with all three scopes; legacy availability
  and disabled health-only behavior remain unchanged.
- **P8:** typecheck, boundaries, full tests, license, audit, schema drift, and fresh db-only
  referee remain green at 11/11; protected files remain byte-identical.

## Standing checks

Run P1-P7 on a fresh isolated database, then the complete standing self-check from the
top. Refresh Graphify as a derived map, commit `[codex]`, push, and open a draft stacked
PR. Do not approve or merge; record independent review debt for Claude or the next model.
Question 053 requires unexpected mutation failures to escape the transaction before the
outer generic 503 and narrows only P6's false-positive browser SQL probe; P1-P7 restart.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
