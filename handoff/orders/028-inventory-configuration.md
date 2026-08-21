# Order 028 — Tenant-safe inventory configuration

**Phase:** 2 · Slice 1A
**Branch:** `phase-2/inventory-commands`
**Tier:** 3 — tenant-scoped state changes and new event catalogue entry
**Written by:** OpenAI Codex, temporary architect under D-95/D-115 and direct founder instruction

## Outcome

Provide the first truthful inventory context surface: authorized callers operating inside
an existing tenant transaction can create and read unit types, physical spaces, and
sellable configurations. Every create is audited and emits an outbox event atomically.

This is deliberately not availability or occupancy. It establishes configuration that a
later order can safely feed to the existing PostgreSQL occupancy choke point.

## Decisions

- D-116 defines create-only mutability and adds `sellable_unit.created`.
- The caller supplies an `AuditEnvelope`; its tenant/property/actor/request identity is
  authoritative. Bodies cannot override those fields.
- Codes and profile keys are trimmed stable identifiers. Names must be non-empty.
- `attrs` must be a JSON object, never an array or scalar, and is stored as a JSON object.
- Unit types and spaces must belong to the envelope property.
- A sellable unit must reference one unit type and at least one distinct space from that
  same tenant and property. Claim mode is exactly `exclusive` or `positional`.
- Create commands return the committed-shape domain record. Reads are deterministically
  ordered and constrained by transaction-local tenant context plus explicit property.

## Scope

- `DECISIONS.log`
- `docs/EVENTS.md`
- `handoff/orders/028-inventory-configuration.md`
- `src/contexts/inventory/index.ts`
- `src/contexts/inventory/inventory.ts`
- `tests/inventory.integration.test.ts`
- `handoff/questions/031-order-028-typecheck-proof-shape.md`
- `handoff/questions/031-ARCHITECT-RESPONSE.md`

## Forbidden

- Any migration or schema snapshot change.
- `migrations/0001_init.sql` and `tests/run_invariants.py`.
- Any INSERT, UPDATE, DELETE, wrapper, or behavioral change involving
  `space_occupancy`, `record_occupancy()`, or `release_occupancy()`.
- Hold, restriction, OOO/OOS, projection, rate, reservation, journal, fiscal, RLS,
  tenant middleware, HTTP/UI, or worker behavior.
- Generic CRUD, status updates, deletion, or new state transitions.
- Self-approval or merge.

## Required implementation

1. Export an inventory service and its public command/query types only through the
   inventory context `index.ts`.
2. Implement create/list/get operations for unit types and spaces.
3. Implement create/list/get for sellable units, including their ordered space claims.
4. Require explicit tenant/property existence checks in every create path.
5. Write one `fact_log` row and one outbox row in the caller transaction for each created
   aggregate. Publish only `unit_type.created`, `space.created`, and
   `sellable_unit.created` from the reviewed catalogue.
6. Return a stable not-found/domain-conflict error without leaking another tenant's row.

## Pre-registered proofs

- **P1 — Atomic happy path:** create one unit type, two spaces, and one composite sellable
  unit; returned/read shapes match, JSONB values are objects, and each aggregate has
  exactly one expected fact and event.
- **P2 — Rollback:** an injected event publisher failure after the data/fact writes leaves
  no aggregate, fact, or event committed.
- **P3 — Tenant isolation:** tenant B cannot get/list tenant A inventory and cannot create
  against tenant A's property or identifiers.
- **P4 — Property boundary:** a sellable configuration cannot combine a unit type and
  space from different properties in the same tenant.
- **P5 — Duplicate and shape rejection:** duplicate codes, duplicate space claims, empty
  mappings, invalid claim modes, scalar/array attrs, and invalid capacity/occupancy values
  fail without partial facts/events.
- **P6 — Deterministic reads:** lists are property-scoped and ordered by sort/code/name as
  specified by the service.
- **P7 — Choke point unchanged:** `migrations/0001_init.sql` and
  `tests/run_invariants.py` are byte-identical to the branch base; the referee remains
  11/11.

## Standing checks

Run from the top after dependencies and database preconditions are available:

1. `bun install --frozen-lockfile`
2. `./state.sh`
3. `bun run typecheck`
4. `bun run boundaries`
5. Order 028 integration proof with its database-required flag
6. `bun test`
7. `bun run license-check`
8. `bun audit`
9. `bun run schema:check`
10. `./setup.sh --db-only` — exactly `11 passed, 0 failed of 11`

## Done when

- P1–P7 pass against PostgreSQL 16.
- Scope and forbidden-path checks are clean.
- One `[codex]` commit is pushed on the ordered branch for deferred independent review.
- Nothing is merged.
