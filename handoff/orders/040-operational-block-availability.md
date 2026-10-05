# Order 040 — Operational-block availability evidence and policy evaluation

**Phase:** 2 · Slice 2H
**Branch:** `phase-2/operational-block-availability`
**Tier:** 3 — sellability and occupancy-truth composition
**Written by:** OpenAI Codex, temporary architect under D-95/D-115

## Outcome

Make truth availability explain every overlapping OOO/OOS cause and apply the exact
property's OOS sellability policy without confusing physical capacity with commercial
bookability.

## Scope

- `DECISIONS.log`
- `handoff/orders/040-operational-block-availability.md`
- `handoff/questions/046-order-040-policy-fixture-parent.md`
- `handoff/questions/046-ARCHITECT-RESPONSE.md`
- `src/contexts/inventory/index.ts`
- `src/contexts/inventory/availability.ts`
- `tests/operational-block-availability.integration.test.ts`

## Required behavior

1. Extend each availability option with deterministic
   `operationalBlocksApplied[{id,spaceId,kind,reason,blocks}]`, ordered by kind,
   space id, then block id. Evidence is attached when an active, non-empty OOO/OOS
   period overlaps the requested instant range on any space mapped to that option.
2. Preserve `availableCount` as PostgreSQL occupancy truth. OOO continues to reduce
   physical capacity only through its existing authoritative exclusive occupancy
   claim; OOS never changes the physical count.
3. OOO evidence always has `blocks=true`. OOS has `blocks=true` when the exact
   property's effective `inventory.oos_sellability` is `blocked` or absent, and
   `blocks=false` when it is `allowed`. OOO is never made configurable.
4. An option is bookable only when physical capacity is positive and neither an
   applied restriction nor an applied operational block blocks it. Blocked options
   remain visible with all explanations; an allowed OOS remains visible as a warning.
5. Composite mappings are atomic: an applicable block on any mapped space is evidence
   for and may block the whole sellable option. Separate overlapping causes remain
   separate evidence; closing/ending one removes only that cause.
6. Tenant, property, mapping, and time boundaries are exact. Foreign-tenant/property,
   unmapped-space, empty, ended, and non-overlapping rows never affect a result.
7. Reject a malformed stored OOS policy rather than silently interpreting it as
   allowed. Absence alone has the documented conservative `blocked` default.

## Forbidden

- Any write to OOO/OOS, occupancy, holds, restrictions, inventory policy, or property
  configuration; any direct or indirect availability-projection/Valkey read.
- Any edit to migrations, occupancy functions, `tests/run_invariants.py`, RLS,
  tenant middleware, journal/fiscal logic, HTTP/UI, dependencies, or existing proof
  assertions.
- Overbooking, rate/quote calculation, stay-date conversion, new event, new state
  transition, self-approval, or merge.

## Pre-registered proofs

- **P1:** an overlapping OOO on a mapped exclusive space retains the option, returns
  exact blocking evidence, and has zero physical availability/bookability solely
  because the sanctioned occupancy claim exists.
- **P2:** with absent/default policy, overlapping OOS leaves physical count unchanged,
  returns exact blocking evidence, and makes only the mapped option unbookable.
- **P3:** changing the exact property policy to `allowed` keeps the same OOS evidence
  with `blocks=false` and restores bookability; OOO remains blocking.
- **P4:** restriction and operational evidence compose without hiding either cause;
  clearing one cause cannot clear the other.
- **P5:** a composite sellable mapping reports every applicable mapped-space cause in
  deterministic order; independent close/end removes only that evidence.
- **P6:** foreign tenant/property, unmapped space, empty/ended/non-overlapping blocks,
  malformed stored policy, and invalid search inputs fail or isolate exactly without
  cross-tenant evidence.
- **P7:** the unchanged Order 031 500-space performance proof, Order 036 restriction
  proof, Orders 037–038 proofs, full standing checks, schema drift, and canonical
  11/11 remain green.

## Standing checks

Run the Order 040 database proof and every proof named in P7 with their required flags;
then typecheck, boundaries, full tests, licence policy, audit, schema drift, and
`./setup.sh --db-only`. Commit and push only when all are green. Open a draft descendant
PR for independent review debt; do not approve or merge it.

## Execution note

The first database run was `4 pass / 2 fail`: P3 and P4 proved the policy remained at
its absent/default `blocked` value because the fixture attempted a nested `jsonb_set`
without creating the missing `inventory` parent. Question 046 / D-151 authorizes only
the fixture correction and a full restart; production behavior and expectations remain
unchanged.

---

## MERGED

Prepared for the founder-authorized cumulative integration from exact reviewed frontier `bc22a9d`. This marker becomes true when the cumulative integration PR lands in `main`; review provenance remains in `handoff/reviews/` and `handoff/LEDGER.md`.
