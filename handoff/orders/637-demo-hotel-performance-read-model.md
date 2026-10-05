# Order 637 — Demo hotel performance read model

## Scope

- Add a fast, deterministic public-demo read model for simple PMS hotel math.
- Expose hotel-level, MSG, MS/source and room-type performance using server-owned numerators and denominators.
- Keep formulas simple and auditable: room nights, rooms available, room revenue, occupancy, ADR and RevPAR.
- Render the top mobile shell stats from this read model instead of decorative counters where appropriate.

## Out of scope

- Editing migrations or `migrations/0001_init.sql`.
- Creating durable reporting tables or materialized views.
- Changing operational workflow mutations.
- Writing occupancy, folio, journal, payment, fiscal, statutory or outbox records.

## Acceptance

- `/api/v1/demo/performance` returns hotel, business-mix and room-type rollups.
- Tests prove ratios are recomputed from aggregated compatible numerators/denominators and not averaged from child ratios.
- Mobile shell links to the performance read model and displays its headline KPIs.
