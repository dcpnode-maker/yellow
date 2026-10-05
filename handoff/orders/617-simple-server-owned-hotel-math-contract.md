# Order 617 — Simple server-owned hotel math contract

## Scope

- Record the production contract for Yellow's hotel KPI and business-mix math.
- Keep the existing Ten Invariants unchanged.
- Make the contract executable with a fast repository test so future UI/API work cannot reintroduce frontend-inferred hierarchy or duplicated KPI calculations.
- Reuse the accepted commercial-attribution prototype as supporting evidence, without promoting prototype SQL to production schema in this order.

## Out of scope

- Editing migrations or `migrations/0001_init.sql`.
- Creating durable production reporting tables/views.
- Changing public demo runtime data.
- Changing frontend screens in this checkout, which does not contain the current live React `frontend/` tree.

## Acceptance

- A concise PMS math contract exists in `docs/`.
- A fast Bun test proves the contract preserves these rules:
  - PostgreSQL/server read models are authoritative.
  - MSG → MS is the only parent-child demand hierarchy.
  - source/channel, company/booker, room class/type and organization are independent intersections.
  - occupancy, ADR and RevPAR are recomputed after aggregation from compatible numerators/denominators.
  - UI must consume server read models and must not invent hotel hierarchy or KPI math.
- The test also anchors the contract to the existing commercial-attribution prototype README.
