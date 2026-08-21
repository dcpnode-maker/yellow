# Order 030 — Audited cart-hold lifecycle

**Phase:** 2 · Slice 1B
**Branch:** `phase-2/audited-holds`
**Tier:** 3 — occupancy and tenant-scoped state transitions
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Allow a tenant-scoped command caller to place, read, release, and expire short cart holds.
PostgreSQL remains the sole arbiter. Every successful state change, audit fact, hold event,
and occupancy event commits or rolls back together.

## Scope

- `DECISIONS.log`
- `docs/EVENTS.md`
- `handoff/orders/030-audited-cart-holds.md`
- `src/contexts/inventory/index.ts`
- `src/contexts/inventory/holds.ts`
- `tests/holds.integration.test.ts`
- `handoff/questions/034-order-030-function-snapshot.md`
- `handoff/questions/034-ARCHITECT-RESPONSE.md`
- `handoff/questions/035-order-030-proof-fixtures.md`
- `handoff/questions/035-ARCHITECT-RESPONSE.md`
- `handoff/questions/036-order-030-deterministic-fixtures.md`
- `handoff/questions/036-ARCHITECT-RESPONSE.md`
- `handoff/questions/037-order-030-count-row-type.md`
- `handoff/questions/037-ARCHITECT-RESPONSE.md`
- `handoff/questions/038-order-030-race-error-provenance.md`
- `handoff/questions/038-ARCHITECT-RESPONSE.md`
- `handoff/questions/039-order-030-server-clock-ttl.md`
- `handoff/questions/039-ARCHITECT-RESPONSE.md`

## Required behavior

1. Place a cart hold for one active sellable unit using all its ordered space mappings.
2. TTL is an integer 1..900 seconds and `expires_at` is computed by PostgreSQL.
3. Stay instants are finite, ordered, and stored as canonical `[)`.
4. Occupancy writes call `record_occupancy()` only. Exclusive and capacity conflicts map
   to a stable hold conflict without partial rows.
5. Release and expiry lock active holds, capture claims, call `release_occupancy()` only,
   require the returned count to equal captured claims, then update status.
6. Release rejects a due hold; expiry processes only due holds for the active tenant and
   envelope property, with a bounded batch and `FOR UPDATE SKIP LOCKED`.
7. Reads never reveal another tenant or property.
8. Facts and catalogue events are written through existing kernel primitives.

## Forbidden

- Any migration, schema snapshot, RLS, tenant middleware, or referee change.
- Editing or bypassing either occupancy function; any direct occupancy INSERT/UPDATE/DELETE.
- Availability projections/search, rates, reservations, hold consumption, offline leases,
  manual blocks, workers/schedulers, HTTP/UI, idempotency storage, or new tables.
- Calling `expire_holds()`.
- Self-approval or merge.

## Pre-registered proofs

- **P1 atomic placement:** hold + configured occupancy claims + one fact + exact hold and
  per-claim events commit together; period is `[)` and expiry is server bounded.
- **P2 exclusive race:** twenty concurrent holds for one exclusive space produce exactly
  one winner and no loser artifacts.
- **P3 positional capacity:** three concurrent holds against capacity two produce exactly
  two winners with distinct claims.
- **P4 rollback:** injected event failure leaves no hold, occupancy, fact, or outbox row.
- **P5 release:** active to released removes every claim, writes the second fact and exact
  release events; repeat release conflicts without new evidence.
- **P6 expiry:** due active holds expire in a bounded tenant/property batch; future and
  other-property holds stay active; exact facts/events are emitted.
- **P7 isolation:** tenant B cannot read, release, expire, or place against tenant A data.
- **P8 invariant surface:** migration 0001, occupancy functions, and referee are byte-
  identical; direct DML denial and canonical 11/11 remain green.

## Standing checks

Run the Order 030 database suite with its required flag, typecheck, boundaries, full
tests, licence policy, dependency audit, schema drift, and `./setup.sh --db-only` from
the top. Commit and push only when all are green. Do not merge.
