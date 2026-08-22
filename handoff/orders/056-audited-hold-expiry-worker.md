# Order 056 — Audited hold-expiry worker

**Phase:** 2 · Inventory and occupancy completion
**Branch:** `phase-2/audited-hold-expiry-worker`
**Tier:** 3 — timed occupancy release through the existing choke point
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Make the existing server-computed cart-hold TTL operational: a supervised, bounded worker
discovers tenant/property scopes with due active holds and expires them only through the
existing audited `HoldService.expireDue` command inside a transaction-local tenant context.

## Scope

- `DECISIONS.log`
- `docs/LOCAL-REVIEW.md`
- `handoff/LEDGER.md`
- `handoff/orders/056-audited-hold-expiry-worker.md`
- `docker-compose.yml`
- `src/server.ts`
- `src/contexts/inventory/index.ts`
- `src/contexts/inventory/hold-expiry-worker.ts`
- `src/workers/postgres-due-hold-scopes.ts`
- `tests/hold-expiry-worker.integration.test.ts`

## Required behavior

1. A deploy-side discovery adapter performs a read-only, bounded, deterministic query for
   distinct `(tenant_id, property_node)` scopes that contain `status='active'` holds whose
   PostgreSQL `expires_at <= transaction_timestamp()`. It returns no hold id, holder,
   stay, occupancy or guest payload.
2. For each discovered scope, the worker establishes `Database.withTenantTransaction`,
   creates an exact `hold.expired` service audit envelope, and calls only
   `HoldService.expireDue` with a bounded per-property limit. Mutation therefore runs as
   `app_role` with RLS and uses the existing audited occupancy release choke point.
3. A failed scope is reported and does not block a later scope; discovery failure is
   reported and the supervised loop polls again. Abort stops promptly. Poll interval,
   scope batch and hold batch are bounded safe integers with conservative defaults.
4. Runtime starts the worker only when both the operator workbench and explicit
   `YELLOW_HOLD_EXPIRY_WORKER=1` are enabled. Local Compose supplies the explicit worker
   opt-in so founder-review holds really expire; ordinary health-only startup remains
   database-free.
5. Two concurrent workers may discover the same due scope but the existing row locks and
   `SKIP LOCKED` semantics produce one exact expiry transition per hold, without duplicate
   fact/event/occupancy-release evidence. A crash or retry requires no cursor because due
   canonical state remains discoverable until the atomic transition commits.

## Forbidden

- Any direct `INSERT`, `UPDATE` or `DELETE` of `hold` or `space_occupancy`; any call to
  `record_occupancy`, `release_occupancy` or legacy `expire_holds()` outside the existing
  `HoldService`; changing `HoldService`, occupancy algorithms, TTL authority, hold states
  or transitions; client/browser/API-triggered expiry; a tenant/property supplied by a
  user; holder or guest data in discovery; silent worker death; unbounded scans/batches;
  migrations, RLS/grants, tenant middleware, token shape, referee, journal/fiscal,
  dependencies, public exposure, self-approval or merge.

## Pre-registered proofs

- **P0:** the complete focused file fails before the worker, discovery adapter, runtime
  wiring and explicit Compose opt-in exist.
- **P1:** one due hold and one future hold in one property produce exactly one expired
  hold, released canonical occupancy, one expiry fact, exact hold/occupancy events, and
  unchanged future artifacts.
- **P2:** due scopes across two tenants/properties expire under their own transaction-local
  context; app-role discovery without a tenant sees no rows; the deploy adapter returns
  only deterministic scope identifiers.
- **P3:** two simultaneous workers against one due hold yield one transition and one exact
  evidence set; a publisher failure rolls hold, occupancy and evidence back so a later
  poll succeeds.
- **P4:** a failing/invalid first scope is reported while a later valid scope expires; no
  cross-tenant or cross-property artifact is changed.
- **P5:** transient discovery failure is reported, the supervised loop polls again and
  succeeds, while abort ends within one poll interval without an unhandled rejection.
- **P6:** invalid options fail fast; health-only runtime remains database-free; static
  wiring proves the worker is doubly opt-in and Compose enables it only for local review.
- **P7:** unchanged Order 030 hold lifecycle, Order 031 availability and Order 055 operator
  cart-hold proofs remain green; no protected or Forbidden surface changes.

## Standing checks

Run P1-P7 on fresh isolated databases and preserve every D-92 stop. Then run the standing
self-check, final `./setup.sh --db-only` at 11/11 with the persistent app stopped per
D-191, a rendered accelerated-expiry localhost proof, refresh Graphify, commit `[codex]`,
push, and open a draft stacked PR. Do not approve or merge; preserve independent review debt.
