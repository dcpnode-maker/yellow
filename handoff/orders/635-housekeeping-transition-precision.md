# Order 635 — Housekeeping transition timestamp precision

## Purpose
Repair the governed housekeeping lifecycle so the public PMS can move an arrival room through the normal cleaning-task flow. The current API returns JavaScript ISO timestamps at millisecond precision while PostgreSQL can store `unit_condition.updated_at` with microseconds; a freshly-read task can therefore fail the exact transition guard.

## Scope
- Forward-only migration for `transition_housekeeping_task`.
- Preserve tenant/property/task/status/condition/actor guards.
- Preserve same-transaction task/condition/fact/outbox behavior.
- Add a regression proving a microsecond stored condition accepts the canonical millisecond evidence exposed to the app.
- No new table, no direct occupancy write, no finance change.

## Acceptance
- Existing housekeeping lifecycle tests pass.
- A microsecond stored `unit_condition.updated_at` can be transitioned using its canonical millisecond API timestamp.
- A genuinely stale different millisecond timestamp still conflicts.
- Colleague public demo probes remain green.
