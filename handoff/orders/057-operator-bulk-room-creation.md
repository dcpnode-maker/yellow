# Order 057 — Operator bulk exclusive-room creation

**Phase:** 2 · Founder-review workbench
**Branch:** `phase-2/operator-bulk-room-creation`
**Tier:** 3 — authenticated tenant/property-scoped atomic mutation
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Let an authorized hotel operator create up to 200 ordinary rooms in one reviewed action.
The browser may generate a range/prefix/zero-padded list or accept pasted room codes, but
the API receives one explicit list. Each requested room becomes exactly one capacity-one
physical `space` and one exclusively mapped `sellable_unit`, using the selected existing
room type and the existing audited `InventoryService` commands in one tenant transaction.

This is deliberately the simple hotel-room path. Dorm beds, parking bays, composite
sellables and positional claims retain their existing individual configuration surfaces.

## Scope

- `DECISIONS.log`
- `docs/LOCAL-REVIEW.md`
- `handoff/LEDGER.md`
- `handoff/orders/057-operator-bulk-room-creation.md`
- `src/app.ts`
- `src/http/operator.ts`
- `src/http/operator/index.html`
- `src/http/operator/operator.css`
- `src/http/operator/operator.js`
- `tests/operator-bulk-rooms.integration.test.ts`
- `tests/operator-workbench.integration.test.ts`
- `tests/review-seed.integration.test.ts` (Question 068: exact 15-scope expectation only)

If a failed proof requires a correction, add only the next numbered question and its
temporary-architect response plus the matching append-only decision/ledger entries, then
restart the affected proof sequence from the top under D-92.

## Required behavior

1. Add `POST /api/v1/properties/:property/inventory/rooms:bulk`. It requires the existing
   exact `inventory.configuration:write` scope, an exact-or-ancestor property grant, a
   valid `Idempotency-Key`, and the already configured inventory service.
2. Accept exact JSON `{unitTypeId, rooms}`. `rooms` contains 1–200 exact objects with
   required `code` and optional `name`/`floor`; no unknown keys, duplicate codes, blank
   labels or malformed UUIDs are accepted. The service's existing validation remains the
   final authority for stable codes, names and floors.
3. Resolve `unitTypeId` through `InventoryService.getUnitType` inside the active tenant
   transaction and exact property. The selected type must have `profileKey === "hotel"`,
   which is the established profile used by the current hotel review seed and UI.
   Other profiles fail closed with a stable validation response instead of silently
   inventing bed, parking or composite semantics.
4. For each explicit room, call `InventoryService.createSpace` with the selected type's
   profile and maximum occupancy, physical capacity 1, optional floor, and no invented
   attributes. Then call `InventoryService.createSellableUnit` with the new space and
   exact `exclusive` claim mode. Use one request/correlation id but the canonical
   `space.created` and `sellable_unit.created` audit operations for their respective
   commands. Add no event type.
5. Wrap the complete batch in one existing `PostgresIdempotency.execute` call inside the
   tenant middleware transaction. Any validation, uniqueness or publisher failure rolls
   back every room, fact, event and idempotency row. Success is 201; exact replay returns
   the exact stored response and creates nothing; changed-request key reuse is 409.
6. Return a deterministic result containing every created physical space and sellable
   unit in request order. Existing stable 400/403/404/409 and generic correlated no-store
   503 behavior remains unchanged and reveals no database or credential detail.
7. Add one progressive bulk-room card to the existing Inventory view. It supports both
   range generation (prefix, start, end, zero-pad) and pasted codes, shows an explicit
   preview/count before submission, allows an optional common floor, and submits the
   explicit reviewed list only. It uses the same semantic DOM and token skins, keeps
   bearer/idempotency state in memory, and refreshes live inventory after success.

## Forbidden

- Migrations, `tests/run_invariants.py`, direct SQL from HTTP/UI, direct aggregate inserts,
  tenant middleware, RLS, token claims, permissions, public hosting or new dependencies.
- Occupancy placement/release, holds, reservations, OOO/OOS, rates, restrictions,
  availability/projection/cache reads or writes, overbooking, journal, fiscal or compliance
  behavior, new tables, new events, or new state transitions.
- Positional claims, dorm/bed/parking/composite generation, implicit server-side ranges,
  partial success, background import, CSV/file upload, update/delete semantics, generic
  JSON configuration, persisted bearer/idempotency/theme state, approval or merge.

## Pre-registered proofs

- **P0:** the complete new integration file fails before the route and API method exist;
  preserve the red output.
- **P1:** 1, 2 and 200 explicit rooms create exact space/sellable pairs in request order,
  capacity 1 and exclusive mappings, inheriting only the selected room type's profile and
  maximum occupancy, and only the established `hotel` profile is accepted.
- **P2:** every room emits exactly one `space.created` fact/event and one
  `sellable_unit.created` fact/event through production services, with one request id and
  canonical per-command operations.
- **P3:** exact replay is byte-equivalent with no new artifacts; changed payload/key reuse
  conflicts; two concurrent identical-key requests produce one batch and one replay.
- **P4:** an invalid item, duplicate/in-use code, non-room/foreign/foreign-tenant type,
  missing scope/grant/key and injected publisher failure each leave zero batch domain,
  fact, event and idempotency artifacts.
- **P5:** boundaries 0/201, malformed UUIDs, unknown keys, malformed room entries and
  oversized payloads fail closed with stable metadata and no detail leakage.
- **P6:** the browser range and pasted-list editors generate only an explicit previewed
  list; invalid/duplicate/empty previews cannot submit; both skins and narrow/wide layouts
  retain accessible labels/status and no horizontal overflow.
- **P7:** existing individual inventory routes, founder review seed, availability, holds,
  operational blocks, restrictions, rates and health-only disabled mode remain green.
- **P8:** typecheck, boundaries, full tests, license, audit, schema drift and fresh db-only
  referee pass 11/11; protected baseline/referee hashes remain byte-identical.

## Standing checks and handoff

Run P1–P7 on fresh isolated databases, then the complete standing self-check from the top.
Stop the persistent app before the final referee per D-191, restart it afterward, and prove
the feature in the browser at Pixel 375 and Apple 1280. Refresh Graphify only after final
changes; it is a derived disposable map. Commit `[codex]`, push, and open a draft stacked
PR against Order 056. Do not approve or merge. The PR must label all results as builder-
asserted and preserve independent review debt for Claude or the next advanced model.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
