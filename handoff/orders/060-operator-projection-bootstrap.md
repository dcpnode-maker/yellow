# Order 060 — Operator-controlled availability-projection bootstrap

**Phase:** 2 · Inventory and occupancy completion
**Branch:** `phase-2/operator-projection-bootstrap`
**Tier:** 3 — authenticated command over occupancy-derived state
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Let an authenticated hotel operator explicitly choose the local-date horizon to build or
rebuild Order 058's disposable PostgreSQL availability projection for one property they are
granted. Expose the current derived horizon and its freshness in the real local workbench.
The command uses the existing projection service and transaction boundary; it does not invent
a global booking horizon, persist hotel policy, or make the projection booking authority.

This order closes only the initial-horizon gap deliberately left by Orders 058 and 059.
Valkey/NATS selection, cache invalidation, offline leases, overbooking and reservations remain
separate Phase-2 decisions.

## Scope

- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/orders/060-operator-projection-bootstrap.md`
- `src/contexts/inventory/availability-projection.ts`
- `src/contexts/inventory/index.ts`
- `src/http/operator.ts`
- `src/app.ts`
- `src/server.ts`
- `src/http/operator/index.html`
- `src/http/operator/operator.css`
- `src/http/operator/operator.js`
- `tests/operator-projection-bootstrap.integration.test.ts`

If an implemented proof fails, add only the next numbered question and temporary-architect
response plus append-only decision/ledger entries, then recreate and restart under D-92.

## Required behavior

1. Add authenticated operator endpoints for one exact granted property:
   `GET /api/v1/properties/:property/availability-projection` returns its current projection
   status; `POST /api/v1/properties/:property/availability-projection:rebuild` accepts exact
   `{fromDate,toDate}` ISO local dates and runs the existing `AvailabilityProjectionService`
   inside the transaction already supplied by tenant middleware.
2. The status is derived under tenant RLS from `availability_projection` and returns row count,
   distinct unit-type count, latest update time, and the half-open horizon `[minimum stay_date,
   maximum stay_date + 1 day)`. An absent projection returns zero counts and null horizon/time.
   It is observational only and must not repair, seed or infer anything.
3. Rebuild retains Order 058's exact validation: real dates only, `fromDate < toDate`, and 1–400
   nights. It must call that service rather than duplicate projection arithmetic. The response
   returns the requested half-open horizon plus the resulting status.
4. GET requires the existing inventory read scope; POST requires the existing inventory write
   scope. Both require the exact property's current org grant. Tenant slug/ID, actor, scopes and
   grants come only from the authenticated server context, never the request body.
5. POST uses the existing `PostgresIdempotency` boundary. Same actor/route/key and canonical
   request replay byte-equivalent success; the same key with a changed request returns conflict.
   A projection or response failure rolls back both derived rows and idempotency claim so the
   same key is retryable after repair. No domain fact/event is added because this command changes
   disposable derived state only; the idempotency record remains transport evidence, not a
   business audit substitute.
6. Add a real Inventory-view workbench panel that shows projection status and has explicit start
   and end date controls plus a Rebuild action. Loading may issue GET; POST happens only after the
   operator submits. The panel must state that the projection accelerates reads and never
   authorizes holds or bookings. Reuse the existing Apple-calm/Pixel token system and accessible
   status/error patterns; do not create a second feature implementation per skin.
7. Runtime injects one shared `AvailabilityProjectionService` into the operator API and the
   Order 059 consumer. Health-only mode remains database-free and existing worker opt-ins remain
   unchanged.

## Forbidden

- Editing migrations, `tests/run_invariants.py`, occupancy functions/constraints/direct DML,
  RLS, tenant middleware, EventBus/outbox/catalogue, or canonical inventory arithmetic.
- A new table, event, fact, privilege, dependency, state transition, persisted horizon policy,
  scheduler or automatic POST; browser-supplied tenant/actor/scopes/grants; projection-backed
  booking or hold authorization.
- Valkey/NATS/cache work or benchmark, offline leases, overbooking, reservations, rates,
  restrictions, public hosting, approval, merge, or representing builder execution as
  independent review.

## Pre-registered proofs

- **P0:** on a fresh 0001–0005 database before implementation, the complete new focused test
  fails because the operator projection API/service status surface is absent; preserve the red.
- **P1:** an authorized GET on an empty projection returns exact zero/null status; an explicit
  three-night POST builds only that half-open horizon and GET returns exact rows, unit types and
  latest update time from PostgreSQL truth.
- **P2:** exact POST replay is byte-equivalent and creates one idempotency claim; changing either
  date with the same key returns 409 without changing projection or claim bytes.
- **P3:** malformed/impossible dates, zero/negative or 401-night spans, invalid property UUID,
  missing read/write scope, missing grant and foreign tenant/property fail 400/401/403/404 as
  appropriate with projection and idempotency byte-equivalent.
- **P4:** an injected projection failure rolls back replacement and claim; retrying the same key
  after repair succeeds. Status-query failure is sanitized by the existing operator edge.
- **P5:** corrupt or absent projection never changes truth availability or hold acceptance; the
  endpoint contains no direct canonical occupancy DML and invokes Order 058's service.
- **P6:** the browser has accessible exact-date controls, explicit-only submit, honest status and
  non-authority copy under both existing themes; source/runtime proof shows no automatic POST.
- **P7:** after bootstrap, canonical hold placement plus one Order 059 drain updates the exact
  projected night inside the existing horizon without widening it.
- **P8:** inherited Orders 058/059, typecheck, boundaries, full tests, licence, audit, schema drift,
  fresh isolated referee 11/11, deployed health/login/browser smoke and protected hashes remain
  green.

## Standing checks and handoff

Run P0 before production code and P1–P7 on fresh isolated databases. Restart the complete
standing self-check from the frozen lockfile. Stop the persistent app before the referee per
D-191, restore it with both workers enabled, refresh Graphify as an ignored derived map, commit
`[codex]`, push and open a draft stacked PR against Order 059. Do not approve or merge. Label
all results builder-asserted and preserve independent-review debt.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
