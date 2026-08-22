# Order 062 — Operator-managed offline capacity lease pool

**Phase:** 2 · Inventory and occupancy completion  
**Branch:** `phase-2/operator-offline-lease-pool`  
**Tier:** 3 — authenticated mutation of occupancy-backed inventory  
**Written by:** OpenAI Codex, temporary architect under D-95/D-115/D-221

## Outcome

Let an authenticated hotel operator deliberately pre-lease exact currently bookable capacity
to a named device before a possible network outage. The lease is a first-class existing
`hold.kind = offline_lease`, uses the same PostgreSQL occupancy choke point, fact log, outbox,
expiry worker and truth availability as cart holds, and is visible/releasable in the local
workbench. This order prepares capacity only: it does not create an offline reservation,
consume a lease, accept guest data, or claim that disconnected synchronization exists.

The operator chooses the exact stay instants, exact sellable configuration, stable device id,
optional non-guest device label, and an integer lease duration of 1–168 hours. PostgreSQL
computes `expires_at` from its transaction clock. The upper bound is a safety ceiling against
indefinite inventory starvation, not a hotel policy default; every issuance is explicit.

## Scope

- `src/contexts/inventory/holds.ts`
- `src/contexts/inventory/index.ts`
- `src/http/operator.ts`
- `src/app.ts`
- `src/http/operator/index.html`
- `src/http/operator/operator.js`
- `src/http/operator/operator.css`
- `scripts/seed-review.ts`
- `docs/CONTRACTS.md`
- `tests/offline-leases.integration.test.ts`
- `tests/operator-holds.integration.test.ts`
- `tests/review-seed.integration.test.ts`
- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/GATE-3-MANIFEST.md`
- this order and any numbered question/response files required by D-92

## Required implementation

1. Generalize the hold read model with its stored kind, while retaining the current public cart
   command names. `place` and `listActive` remain cart-only; `release` must reject a non-cart
   id. Add explicit offline-lease place/list/release methods and one private shared placement
   path so occupancy arbitration is not duplicated.
2. Offline placement accepts only an exact sellable id, finite ordered UTC instants, integer
   `ttlSeconds` equivalent to 1–168 whole hours, a bounded stable device id, and an optional
   bounded printable device label. Insert `kind = offline_lease`; derive expiry using
   `transaction_timestamp()`; call only `record_occupancy()` for claims. No arbitrary holder
   JSON crosses the HTTP edge.
3. Cart and offline listings must be disjoint by stored kind. Explicit release endpoints must
   enforce their expected kind before calling only `release_occupancy()`. Existing due expiry
   continues to expire every supported active kind through the audited transition.
4. Existing `hold.created`, `hold.released`, `hold.expired`, `occupancy.recorded`, and
   `occupancy.released` facts/events remain the catalogue. Add the hold kind to evidence and
   include the stable device id for an offline creation; add no event or state transition.
5. Add separate `inventory.offline_leases:read/write` permissions and property-grant checks.
   Expose exact authenticated idempotent list/place/release routes under
   `/api/v1/properties/{property}/offline-leases`. Replays are byte-equivalent; changed replays,
   cross-kind ids, malformed bodies, missing scopes, and foreign properties fail without
   business or idempotency artifacts.
6. Add an accessible workbench panel that uses the current truth-search dates/options, requires
   an explicit device and duration, lists active leases with exact stay/expiry evidence, and
   releases them. Copy must say that capacity is reserved for later offline use but reservation
   creation/consumption is not implemented yet. No automatic issuance, browser persistence,
   hidden default, or direct SQL.
7. Extend `docs/CONTRACTS.md` with the implemented transitional operator contract and its
   honest non-consumption boundary. Preserve the future canonical reservation contract.

## Forbidden

- Any file under `migrations/`, especially `migrations/0001_init.sql`
- `tests/run_invariants.py`, occupancy functions/grants/RLS/tenant middleware
- Direct `space_occupancy` DML or a second availability/occupancy implementation
- A new table, migration, dependency, event, hold kind, status, or state transition
- Offline reservation creation, lease consumption/transfer, synchronization, guest/party/PII
  capture, conflict resolution, service worker, IndexedDB/localStorage/sessionStorage
- Client-supplied tenant, property, holder JSON, `expires_at`, arbitrary seconds, or server-selected
  room/capacity
- Overbooking semantics, `overbooking_limit`, projection/cache authority, Valkey/NATS selection,
  reservation commit, rates, fiscal, journal, payment, or compliance behavior
- Editing or weakening inherited proofs, the `<1000 ms` catastrophic guard, or the 11/11 referee
- Approval or merge by Codex

## Pre-registered proof

- **P0 (must be red first):** on a fresh 0001–0005 database, the new focused file fails because
  the offline-lease domain/API surface and workbench contract do not exist. Record exact red
  assertions before production edits.
- **P1:** explicit one-hour placement stores `kind=offline_lease`, PostgreSQL-derived expiry,
  exact bounded device metadata, one hold/fact/hold event and the configured occupancy plus
  occupancy event; truth availability decreases. Release removes only those claims, records
  exact evidence, restores truth, and exact retries replay.
- **P2:** active cart and offline lists are disjoint; neither release surface can transition the
  other kind; a due offline lease is expired by the existing worker path with claims/facts/events
  exact and becomes available again.
- **P3:** 20 concurrent offline placements for the last exact unit yield one 201 and nineteen
  409 responses with exactly one hold/claim/fact/event set and one completed idempotency claim.
- **P4:** missing read/write scope, foreign property, unknown fields, invalid instants/device/
  label/duration, missing key, changed replay, repeated release, and guessed cross-kind id persist
  nothing. Tenant B cannot list or mutate tenant A leases.
- **P5:** injected fact/event failure rolls placement and release plus idempotency claim back;
  same-key retry after repair succeeds. No partial occupancy or evidence survives.
- **P6:** local-review seed grants exactly the two new permissions; the browser renders explicit
  device/duration controls, live list/release and honest incomplete-consumption copy under both
  themes, never auto-POSTs and contains none of the Forbidden storage/SQL/consumption shortcuts.
- **P7:** inherited cart-hold, hold-expiry, truth-availability and operator-login proofs remain
  green and demonstrate cart behavior did not widen to offline leases.
- **P8:** frozen install, typecheck, import boundaries, full default tests, licence, audit, schema
  drift, protected hashes, fresh isolated db-only referee 11/11 with app never created, and
  restored localhost health/login/browser smoke remain green.

## Standing checks and handoff

Run P0 before production code and P1–P6 on a fresh isolated database. Restart the complete
standing self-check from the frozen lockfile. Stop the persistent app only for the isolated
referee when required, restore it with both existing workers enabled, refresh Graphify as an
ignored derived map, commit `[codex]`, push, and open a draft stacked PR against Order 061.
Append one UNVERIFIED Gate-3 manifest row with protected hashes. Do not approve or merge.
