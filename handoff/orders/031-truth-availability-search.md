# Order 031 — PostgreSQL-truth availability search

**Phase:** 2 · Slice 1C
**Branch:** `phase-2/truth-availability`
**Tier:** 3 — sellability truth and occupancy reads
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Return truthful, tenant/property-scoped availability per sellable configuration for a
bounded instant range. The query reads authoritative occupancy claims and remains correct
if every projection/cache value is wrong.

## Scope

- `DECISIONS.log`
- `handoff/orders/031-truth-availability-search.md`
- `src/contexts/inventory/index.ts`
- `src/contexts/inventory/availability.ts`
- `tests/availability.integration.test.ts`
- `handoff/questions/040-order-031-availability-performance.md`
- `handoff/questions/040-ARCHITECT-RESPONSE.md`

## Required behavior

1. Search one property and canonical `[from,to)` instants, with optional positive party
   size bounded by unit-type max occupancy.
2. Return deterministic options containing sellable/unit-type identity, name/code,
   profile, and nonnegative available count.
3. Use D-129's per-mapping capacity algorithm and the minimum for composites.
4. Exclude inactive sellable units and any configuration with no mappings, inactive
   spaces, or a cross-property mapping. Never silently use a valid subset.
5. Use transaction-local tenant context plus explicit property predicates.
6. Treat every overlapping occupancy row as truth, including due holds not yet swept.

## Forbidden

- Any write, event, fact, migration, schema/RLS/referee, occupancy-function, projection,
  cache, rate, restriction, overbooking, reservation, HTTP/UI, or option-token change.
- Availability arithmetic in TypeScript; PostgreSQL computes claim capacity.
- Claiming a rate/quote or reservation guarantee.
- Self-approval or merge.

## Pre-registered proofs

- **P1:** empty exclusive/composite options return one; positional capacity two returns
  two, deterministically ordered.
- **P2:** exclusive and positional holds reduce only overlapping periods and release
  restores capacity.
- **P3:** an exclusive claim zeros positional availability and positional claims zero an
  alternative exclusive option on the same physical space.
- **P4:** a due-but-unswept hold remains unavailable; only audited expiry restores it.
- **P5:** inactive/cross-property/incomplete mappings are excluded atomically.
- **P6:** corrupted `availability_projection` values do not alter results.
- **P7:** tenant B and another property observe no tenant-A options or claims.
- **P8:** invalid ranges/party sizes fail before SQL; a 500-space fixture stays within a
  recorded local performance budget without changing planner settings.
- **P9:** migration 0001, occupancy functions, and referee are byte-identical; schema
  drift and canonical 11/11 remain green.

## Standing checks

Run the required Order 031 database proof, typecheck, boundaries, full tests, licence
policy, dependency audit, schema drift, and `./setup.sh --db-only` from the top. Commit
and push only if all pass. Do not merge.
