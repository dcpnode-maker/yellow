# Order 035 — Atomic property restriction configuration

**Phase:** 2 · Slice 2D
**Branch:** `phase-2/inventory-controls`
**Tier:** 2 — audited sellability configuration, evaluation deferred
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Create and read strict, property-scoped manual restriction batches without yet changing
availability or quote evaluation.

## Scope

- `DECISIONS.log`
- `handoff/orders/035-restriction-configuration.md`
- `src/contexts/inventory/index.ts`
- `src/contexts/inventory/restrictions.ts`
- `tests/restrictions.integration.test.ts`

## Required behavior

1. Insert 1..100 restrictions atomically for the authenticated audit property.
2. Closed/CTA/CTD carry no value; min/max LOS/advance carry a positive integer.
3. Stay dates are real, non-empty, half-open ranges; channel is null or stable code.
4. Optional unit type and rate plan must belong to the active tenant property.
5. Source is always `manual`; each row gets one fact and one `restriction.changed`
   event with action `created` in the same transaction.
6. Reads are deterministic and property scoped.

## Forbidden

- Restriction evaluation, updates/deletion, automation/RMS source, ancestor scope,
  availability, rates mutation, overbooking, OOO/OOS, occupancy, holds, HTTP/UI,
  migrations, RLS, tenant middleware, or referee changes.
- Self-approval or merge.

## Pre-registered proofs

- **P1:** a mixed batch commits exact rows, facts, events, ranges, and source atomically.
- **P2:** unit type/rate plan filters and ordering read deterministically.
- **P3:** wrong tenant/property references and malformed kinds/values/ranges/channels fail
  without partial rows or evidence.
- **P4:** publisher failure in a later batch row rolls back the entire batch.
- **P5:** tenant B and another property see no tenant-A property restrictions.
- **P6:** no existing restriction is updated or deleted.
- **P7:** standing checks, schema drift, and canonical 11/11 remain green.

## Standing checks

Run the Order 035 database proof with its required flag, typecheck, boundaries, full
tests, licence policy, audit, schema drift, and `./setup.sh --db-only`. Commit and push
only when all are green. Do not merge.
