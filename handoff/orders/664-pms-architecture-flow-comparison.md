# Order 664 - PMS architecture and operating-flow comparison

Date: 2026-09-23
Owner: Codex
Phase: 0 cumulative review; research only
Branch: existing `phase-0/founder-context-demo-readiness`
Status: COMPLETE - public-documentation comparison only

## Goal

Answer the founder's request to compare PMS architectures and operating flows,
building on the five-stage guest/staff journey from Order 663.

## Scope

- `handoff/orders/664-pms-architecture-flow-comparison.md`
- `docs/PMS-ARCHITECTURE-FLOW-COMPARISON.md`

## Method

- Sample OPERA Cloud, Mews, Cloudbeds, apaleo, Stayntouch, RMS, Guesty, Hostaway,
  eZee Absolute/Yanolja Cloud Solution and Hotelogix using official product/help/API
  documentation. The final two add relevant independent-hotel comparison points.
- Separate documented integration/domain architecture from inferred UX patterns
  and undisclosed internal infrastructure.
- Compare guest flow, staff flow, service/finance handoffs and fit to Yellow.
- Describe breadth honestly: representative systems, not every PMS worldwide.
- Read-only assistants return evidence; root writes the comparison.

## Acceptance

- [x] Each system has primary-source support and a concrete workflow summary.
- [x] Shared journey and meaningful differences are explained.
- [x] Yellow recommendation fits the existing modular-monolith constitution.
- [x] Limitations and open architecture questions remain explicit.

Result: `docs/PMS-ARCHITECTURE-FLOW-COMPARISON.md`, ten representative systems.
Root checked primary sources and integrated a bounded GPT-6 Luna read-only review
of Guesty, Hostaway and RMS. Local Markdown links: 4 checked, 0 missing. Companion
journey map: 10 checked, 0 missing. No implementation or performance result claimed.

No code, database, infrastructure, migration, deployment, credential or hotel/vendor
API-key usage. No application tests needed for this documentation-only order.
