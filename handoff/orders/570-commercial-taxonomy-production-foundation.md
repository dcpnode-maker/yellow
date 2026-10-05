# Order 570 — commercial taxonomy production foundation

## Objective

Introduce Yellow's first production-safe commercial-classification boundary without
publishing invented revenue KPIs: one configurable MSG→MS demand tree plus
independent source/channel, company/booker and room-class/type intersections.

## Scope

- `handoff/orders/570-commercial-taxonomy-production-foundation.md`
- `src/contexts/reporting/commercial-attribution.ts`
- `src/contexts/reporting/index.ts`
- `tests/commercial-attribution.test.ts`
- `DECISIONS.log`
- `handoff/LEDGER.md`
- `handoff/FOUNDER-JOURNEY-CAPABILITY-LEDGER.md`
- `handoff/reviews/570-commercial-taxonomy-production-foundation.md`

Anything else is out of scope.

## Required behaviour

1. Reuse the existing versioned `extension` primitive with type
   `commercial_attribution`; do not add a table or migration.
2. Demand is exactly MSG→MS. Each MS has one MSG parent in one version.
3. Source/channel, company/booker and commercial room class/type are independent
   intersections, never forced below MS.
4. Codes and mappings are unique, bounded and deterministic. Duplicate, unknown,
   ambiguous or structurally invalid mappings fail closed.
5. Unmapped input returns a stable `UNMAPPED` leaf and explicit reason rather than
   guessing from guest identity, GST data or mutable relationships.
6. Load exactly one active, property-scoped, effective configuration under
   transaction-local tenant RLS. Zero or overlapping active versions fail closed.
7. The boundary performs no ledger, reservation, occupancy, KPI, OTA or public-data
   writes. It does not call `stats_daily` or claim audited revenue attribution.

## Proof

- Strict unit tests for the accepted hierarchy, independent intersections,
  duplicate/unknown parent rejection, stable Unmapped results, property/tenant query
  binding, overlapping active-version refusal and malformed UUID refusal.
- Strict TypeScript and import-boundary checks.
- Independent non-implementing review before any public consumer or attribution
  projection is added.

## Exclusions

- No migration, projection, historical restatement, KPI publication, UI/API release,
  reservation rewrite, financial reclassification or public deployment.
- No claim that configuration alone supplies room-night, occupancy, ADR or RevPAR
  authority. That requires the separately reviewed conserved-grain projection.

## Outcome — independently accepted 2026-09-21

Implemented in the serving D: source and accepted at independent Review570 R3 after
two retained rejection rounds. Focused proof is 7/0/30; strict scoped TypeScript and
the 202-file boundary scan pass. Unknown, malformed, contradictory and reserved
classification evidence now fails closed. No migration, API/UI, KPI, database or
public deployment is included.
