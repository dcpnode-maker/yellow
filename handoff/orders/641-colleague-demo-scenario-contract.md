# Order 641 — Colleague demo scenario contract

## Scope

- Add a single scenario route that tells a colleague exactly what to review in the demo.
- Stitch together Today board, performance, arrival, cashier, group block, checkout and Overwatch proof points.
- Keep the scenario honest about disabled real execution and the remaining readiness gap.

## Out of scope

- Marking the demo ready.
- Enabling real PMS mutations.
- Creating external public tunnels or notifications.

## Acceptance

- `/api/v1/demo/colleague-scenario` returns an ordered demo script with route links, expected proof, and safety gates.
- The mobile shell links to the scenario.
- Tests prove all scenario steps point at implemented routes and no step claims real PMS execution.
