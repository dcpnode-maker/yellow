# Order 058 — Truth-derived availability projection rebuild

**Phase:** 2 · Inventory and occupancy completion
**Branch:** `phase-2/availability-projection-rebuild`
**Tier:** 3 — occupancy-derived cache plus a migration privilege change
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Rebuild a bounded property-local date range of `availability_projection` from canonical
PostgreSQL configuration, occupancy and OOO/OOS state. The projection is replaceable and
never authorizes a booking. It contains rows only for unit types whose active sellable
configuration can be aggregated without guessing; unsupported composite/alternative
graphs are removed from the rebuilt range and remain available through truth search.

This order establishes the deterministic rebuild command and the Phase-2 from-zero proof.
Outbox-driven scheduling, Valkey mirroring/A-B evidence, operator diagnostics, offline
leases, overbooking behavior and reservations remain later orders.

## Scope

- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/orders/058-availability-projection-rebuild.md`
- `migrations/0005_projection_replace_privilege.sql`
- `src/contexts/inventory/availability-projection.ts`
- `src/contexts/inventory/index.ts`
- `tests/availability-projection.integration.test.ts`
- `tests/database-acceptance.integration.test.ts`
- `tests/schema/expected.sql`

If a failed proof requires a correction, add only the next numbered question and its
temporary-architect response plus matching append-only decision/ledger entries, then
restart the affected sequence from the top under D-92.

## Required behavior

1. Migration 0005 grants `DELETE` on `availability_projection` to `app_role` and nothing
   else. The table already has tenant RLS; PUBLIC retains no privilege. Do not alter its
   columns, generated expression, policy, ownership or canonical-source permissions.
2. Add `AvailabilityProjectionService.rebuild(tx,input)`. Input is exact
   `{propertyNode,fromDate,toDate}` with UUID plus strict `YYYY-MM-DD` half-open local
   dates. The range contains 1–400 nights. The active transaction-local tenant and exact
   property row supply timezone and typed OOS policy; foreign/malformed/missing properties
   fail closed.
3. Replace, in one tenant transaction, only that property and `[fromDate,toDate)` range:
   delete its prior rows, derive the complete replacement, and insert/upsert rows. A
   failure rolls the delete and inserts back together. Do not write facts/events for a
   disposable derived model.
4. A unit type is projection-safe only when every active sellable unit has exactly one
   active mapped same-property space and no mapped space occurs in more than one active
   sellable unit of that type. An exclusive mapping contributes physical capacity 1; a
   positional mapping contributes the space's positive capacity. If the type has no
   active sellables or any active sellable violates this shape, insert no rows for that
   type. Never project a partial subset.
5. Convert each property-local stay date to its exact UTC `[midnight,next midnight)` using
   PostgreSQL timezone rules. Overlapping canonical `space_occupancy` rows consume the
   mapped space: `segment` becomes sold, `hold` becomes held, and `ooo` becomes OOO.
   Exclusive claims consume the mapping's complete physical contribution; positional
   claims consume their exact count. Keep expired-but-unreleased hold claims conservative,
   matching truth.
6. Active overlapping OOS rows do not change physical inventory. With the property's
   absent/`blocked` policy they set `blocked` to the mapped space's capacity remaining
   after sold/held/OOO, so generated available reaches zero without double subtraction.
   With `allowed`, blocked remains zero. Multiple causes do not multiply loss. Restrictions,
   rates, channels, overbooking and policy prices do not enter this rate/channel-blind row.
7. Return deterministic rebuild evidence `{propertyNode,fromDate,toDate,rows,unitTypes}`.
   Every stored component is a non-negative integer and generated `available` exactly
   equals `physical-sold-held-blocked-ooo` without becoming negative.

## Forbidden

- Editing `migrations/0001_init.sql` or `tests/run_invariants.py`; altering occupancy
  functions, exclusion constraints, RLS policies, tenant middleware, canonical table
  privileges, or any non-projection DELETE privilege.
- Reading the projection from `AvailabilityService`; treating it as a booking promise;
  Valkey/NATS/cache runtime, outbox consumer/worker, HTTP/UI, public hosting, new dependency,
  new table, new event, fact/audit write, or canonical configuration/occupancy mutation.
- Projecting composite, multi-space, shared-within-type, inactive, cross-property or
  otherwise unsafe configurations; partial rows for an unsafe unit type; restriction,
  rate, channel, quote, reservation, offline-lease or overbooking behavior.
- Approval, merge, or representing builder execution as independent review.

## Pre-registered proofs

- **P0:** on a fresh migrated database before implementation, the complete new integration
  file fails because migration 0005/service exports do not exist; preserve the red output.
- **P1:** from an empty projection, ordinary exclusive hotel rooms and a unique positional
  dorm produce exact physical rows for three property-local dates; generated availability
  equals an independent truth calculation.
- **P2:** segment, hold and OOO occupancy plus blocked/allowed OOS produce exact sold/held/
  ooo/blocked components without double subtraction; release/removal followed by a rebuild
  restores exact rows. Seed occupancy only through `record_occupancy`/`release_occupancy`.
- **P3:** an unsafe multi-space composite and a same-type shared-space alternative produce
  no rows, including after replacing deliberately stale projection fixtures. Safe sibling
  types remain complete; no partial unsafe type is inserted.
- **P4:** timezone/DST boundaries use exact property-local days; malformed, empty, reversed,
  over-400-day and missing/foreign property requests fail closed and roll back replacement.
- **P5:** app_role can delete only its own tenant's projection range, cannot see/delete the
  other tenant, retains no DELETE on canonical inventory/occupancy tables, and PUBLIC has
  no projection privilege. Migration ledger/checksum and generated schema snapshot are exact.
- **P6:** injected insertion failure after range deletion leaves the previous projection
  byte-equivalent, proving atomic replacement; two serialized rebuilds converge identically.
- **P7:** inherited truth availability, holds, operational blocks/policy, migration acceptance,
  typecheck, boundaries, full tests, licence, audit, schema drift and referee 11/11 remain green;
  protected baseline/referee hashes stay byte-identical.

## Standing checks and handoff

Run P0 before production code. Run P1–P6 on fresh isolated databases, then restart the
complete standing self-check from the top. Stop the persistent app before the referee per
D-191 and restore it afterward. Refresh Graphify after final source changes. Commit
`[codex]`, push, and open a draft stacked PR against Order 057. Do not approve or merge.
The handoff must label all evidence builder-asserted and call out that an event consumer
and cache decision are still pending Phase-2 work.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
