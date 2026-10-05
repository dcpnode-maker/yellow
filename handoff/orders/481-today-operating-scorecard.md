# Order 481 — Today operating scorecard

## Objective

Make Yellow's Today landing screen a drill-down operating scorecard before the
arrivals/departures lanes, with current property occupancy visibility and honest
ADR/RevPAR data availability.

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/styles.css`
- focused Yellow mobile/public-surface tests where needed

## Required behaviour

- Use already authorised, tenant-scoped Today lanes and inventory configuration
  only. Do not add a database query, service, endpoint, external provider or
  financial calculation.
- Display current in-house count, arrivals, departures, configured rooms, and
  an occupancy indicator only when the configured room denominator is present.
- ADR and RevPAR must not be fabricated. Until an approved revenue feed exists,
  label them unavailable and explain that Overwatch can drill into operational
  evidence currently available.
- Each metric has accessible drill-down language and delegates only to existing
  read-only routes/Overwatch prompts. No metric action writes data.

## Exclusions

- No real-data import, PII, synthetic seed change, rate/revenue write, database
  schema/API change, external market data, or release/promotion.
