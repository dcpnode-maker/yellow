# Order 309 — India GST accommodation levy-input bundle

**Status:** READY-D852
**Phase:** 7 — Tax engine and India IRP
**Branch:** `phase-7/india-gst-accommodation-levy-input-bundle`
**Base:** `4e1b109` (independently approved Order308 governance head)
**Risk tier:** 3 — statutory rate/family lineage composition; fresh independent executable review mandatory

## Outcome

Bind one complete approved historical accommodation-rate resolution to one complete
approved GST component-family result for the same tenant, property, civil supply day
and jurisdiction. Return frozen tenant-hidden evidence carrying the selected aggregate
GST_ROOM schedule and component family together, without splitting rates or calculating money.

## Exact contract

- Accept exactly `{tenantId,historicalResolution,componentFamily}`.
- Recompute the tenant-bound Order306 resolution evidence hash and Order308 family
  evidence hash; revalidate the exact Order304 rate-version pair and selected member.
- Require exact property and civil date agreement, and exact selected-extension
  jurisdiction id/key/version/content-hash agreement with the component-family result.
- Return only property/reservation/folio/date, exact selected version identity and
  aggregate GST_ROOM slabs, component family/statutory source, predecessor hashes and
  one deterministic evidence hash.

## Scope

- this order, `DECISIONS.log`, `handoff/LEDGER.md`, bounded Phase-7 plan/roadmap;
- one pure tax-fiscal module and context exports;
- intentional-red and permanent hostile/mutation-sensitive unit proof;
- bounded contract/domain/security/QA documentation;
- fresh non-implementing Tier-3 review evidence.

## Forbidden boundary

No SQL/database/migration/schema/RLS/grant/seed/writer; no rate derivation or component
rate split, taxable value, amount, rounding, residual allocation, account route,
posting/correction, Section14/calendar, zero-rating/authorized-operations, reverse
charge, payer, `SupTyp`, `IgstOnIntra`, item/document/IRP/API/UI/local/merge/deploy or
Phase/application-complete authority.

## Pre-registered proof

- **P0 red:** the pure bundle builder/export is absent.
- **P1 join:** predecessor/successor days and every approved component family bind only
  when property, date and jurisdiction identity agree.
- **P2 hostility:** cross-tenant/property/date/jurisdiction/version/content/family,
  selected-member, pair/evidence hash, thawed/proxy/accessor/symbol and surplus caller
  rate/value/amount/calendar fields fail closed, including fully recomputed mutants.
- **P3 evidence:** exact aggregate slabs/threshold/ITC/nil/source lineage is preserved;
  output is recursively frozen, byte-stable, tenant-hidden and hash-bound.
- **P4 preservation:** no SQL/write/amount/split/rounding/downstream vocabulary;
  standing/static and unchanged schema/referee evidence remain green.

## Definition of done

- [ ] Intentional red precedes production.
- [ ] Focused mutation-sensitive proof is green.
- [ ] Standing/static/setup/schema/referee preservation gates are green.
- [ ] Fresh non-implementing Tier-3 reviewer personally executes proof and approves.
