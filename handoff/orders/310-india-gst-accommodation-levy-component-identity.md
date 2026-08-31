# Order 310 — India GST accommodation levy-component identity

**Status:** READY-D858
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-gst-accommodation-levy-component-identity`
**Base:** `dc52855` (independently approved Order309 governance head)
**Risk tier:** 3 — statutory levy-identity composition; fresh independent executable review mandatory

## Outcome

Revalidate one complete approved Order309 levy-input bundle and derive only its ordered
GST levy-component identities. Preserve the approved aggregate GST_ROOM schedule once,
without copying an aggregate rate onto either member of a dual-component family.

## Exact contract

- Accept exactly `{tenantId,historicalResolution,supplyNature,componentFamily,levyInputBundle}`.
- Re-run the approved Order309 builder from the complete predecessor inputs and require
  byte-exact equality with the supplied bundle; its public evidence hash alone is not provenance.
- Derive ordered component identities only: `[igst]`, `[cgst,sgst]`, or `[cgst,utgst]`.
- Preserve the aggregate GST_ROOM schedule once at envelope level.
- Emit `sole_component_aggregate_schedule` only for IGST; emit
  `numeric_component_split_authority_required` for both dual-component families.
- Return recursively frozen, tenant-hidden, deterministic evidence bound to the complete
  Order309 result and predecessor hashes.

## Scope

- this order, `DECISIONS.log`, `handoff/LEDGER.md`, bounded Phase-7 plan/roadmap;
- one pure tax-fiscal module and context exports;
- intentional-red and permanent hostile/mutation-sensitive unit proof;
- bounded contract/domain/security/QA documentation;
- fresh non-implementing Tier-3 review evidence.

## Forbidden boundary

No SQL/database/migration/schema/RLS/grant/seed/writer; no taxable value or slab
selection; no component percentage, basis points, value, tax amount, rate duplication,
rounding or residual allocation; no Section14/calendar, zero-rating/authorized operations,
reverse charge/payer, account/posting/correction, `SupTyp`, `IgstOnIntra`, item/document/
IRP/API/UI/local/merge/deploy or Phase/application-complete authority.

## Pre-registered proof

- **P0 red:** the component-identity builder/export is absent.
- **P1 derivation:** each approved family maps to one exact ordered identity tuple and
  only IGST may carry the sole-component readiness marker.
- **P2 ancestry:** complete Order309 inputs are revalidated and byte-matched; coherent
  family, selected-version, schedule, legal-source, predecessor and hash mutations fail.
- **P3 hostility:** tenant mismatch, thawed/proxy/accessor/symbol/sparse/surplus graphs and
  caller-supplied component rate/value/amount/rounding fields fail closed.
- **P4 containment:** output is frozen, byte-stable and contains no numeric split or
  downstream fiscal authority; standing/static and unchanged schema/referee stay green.

## Definition of done

- [ ] Intentional red precedes production.
- [ ] Focused mutation-sensitive proof is green.
- [ ] Standing/static/setup/schema/referee preservation gates are green.
- [ ] Fresh non-implementing Tier-3 reviewer personally executes proof and approves.
