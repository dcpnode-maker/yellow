# Order 038 — Audited per-property OOS sellability policy

**Phase:** 2 · Slice 2G
**Branch:** `phase-2/oos-sellability-policy`
**Tier:** 2 — audited inventory configuration
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Let each hotel/property choose whether OOS inventory is blocked from sale or allowed
with warning, without making physical OOO removal configurable.

## Scope

- `DECISIONS.log`
- `handoff/orders/038-oos-sellability-policy.md`
- `docs/EVENTS.md`
- `docs/EXTENSIONS.md`
- `src/contexts/inventory/index.ts`
- `src/contexts/inventory/inventory-policy.ts`
- `tests/inventory-policy.integration.test.ts`

## Required behavior

1. Expose typed `OosSellability = 'blocked' | 'allowed'` and read/set commands for one
   exact tenant/property through the inventory public index.
2. Store only `org_node.config.inventory.oos_sellability`; absence reads as `blocked`.
   Preserve every unrelated config key and reject non-object config/inventory shapes.
3. A set locks the exact property, accepts only the typed value and exact audit operation,
   and performs no write/evidence when the effective value is unchanged.
4. A real change updates the property head, appends one fact with previous/new values,
   and publishes one `inventory.policy.changed` event in the same transaction.
5. Foreign tenant/property references, malformed values, and publisher failure fail
   closed without config, fact, or outbox residue.
6. Document the property-config key/default and add only the required existing-context
   event. Availability consumption is deferred to Order 039.

## Forbidden

- Any OOO/OOS row or occupancy write; any edit to occupancy functions.
- Availability/restriction/hold/reservation logic, projection/cache, overbooking,
  generic config patching, HTTP/UI, migration, RLS, tenant middleware, journal/fiscal,
  referee, or dependency change.
- Self-approval or merge.

## Pre-registered proofs

- **P1:** absent policy reads exactly `blocked` and creates no evidence.
- **P2:** setting `allowed` preserves unrelated nested/top-level config, including an
  arbitrary-precision JSON number, and atomically writes the exact property value,
  fact, and event.
- **P3:** repeating `allowed` is a no-op with byte-identical config and no new evidence;
  changing back to `blocked` writes one exact previous/new fact and event.
- **P4:** a publisher failure rolls back the config update and fact.
- **P5:** foreign tenant/property ids plus malformed value, property id, operation, and
  non-object stored config fail without artifacts.
- **P6:** concurrent opposite writes serialize on the property row; every committed
  effective transition has exactly one fact/event and the returned values form a legal
  sequential history.
- **P7:** Orders 037 and standing checks, schema drift, and canonical 11/11 remain green.

## Standing checks

Run the Order 038 database proof plus Order 037 with their required flags; typecheck,
boundaries, full tests, licence policy, audit, schema drift, and `./setup.sh --db-only`.
Commit and push only when all are green. Do not merge.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
