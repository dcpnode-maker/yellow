# Order 036 — Property-local restriction evaluation in availability

**Phase:** 2 · Slice 2E
**Branch:** `phase-2/restriction-evaluation`
**Tier:** 3 — sellability decision adjacent to occupancy truth
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Evaluate stored restrictions in PostgreSQL-truth availability without conflating
commercial closure with physical inventory.

## Scope

- `DECISIONS.log`
- `handoff/orders/036-restriction-evaluation.md`
- `src/contexts/inventory/index.ts`
- `src/contexts/inventory/availability.ts`
- `tests/restriction-evaluation.integration.test.ts`

## Required behavior

1. Add optional rate-plan and channel search dimensions with strict validation.
2. Derive arrival, departure, and booking dates in PostgreSQL from property timezone.
3. Return every physical option with unchanged count, a `bookable` flag, and ordered
   applied restriction facts including whether each blocks.
4. Enforce D-140's closed/CTA/CTD/LOS/advance date and dimension semantics.
5. Preserve tenant/property isolation and PostgreSQL occupancy truth.

## Forbidden

- Restriction writes, OOO/OOS, overbooking, rate/quote arithmetic, policy evaluation,
  occupancy writes, holds, projections/caches, HTTP/UI, migrations, RLS, tenant
  middleware, or referee changes.
- Self-approval or merge.

## Pre-registered proofs

- **P1:** each restriction kind blocks and reports on its exact date condition while
  physical counts remain byte-equivalent to unrestricted search.
- **P2:** unit/rate-plan/channel scoping activates only exact requested dimensions.
- **P3:** a non-blocking rule is reported with blocks=false and bookable stays true.
- **P4:** non-UTC property boundaries use property-local dates, not server UTC date.
- **P5:** tenant/property isolation and malformed optional dimensions fail closed.
- **P6:** Order 031's full authoritative availability proof and 500-space budget remain
  green unchanged.
- **P7:** standing checks, schema drift, and canonical 11/11 remain green.

## Standing checks

Run Orders 031 and 036 database proofs with their required flags, typecheck,
boundaries, full tests, licence policy, audit, schema drift, and `./setup.sh --db-only`.
Commit and push only when all are green. Do not merge.
