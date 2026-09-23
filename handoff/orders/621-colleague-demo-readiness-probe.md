# Order 621 — Colleague demo readiness probe

## Intent

Add a repeatable, read-only probe that verifies the public demo has live evidence
behind the main PMS colleague-review path.

## Scope

- Log in through the public synthetic-demo route.
- Verify property selection, Today performance, arrival/departure/in-house movement
  lanes, reservation detail, arrival readiness, checkout readiness, housekeeping,
  cashier, folio statement, and Overwatch confirmation-gated routing.
- Keep the probe read-only after authentication. It must not commit check-in,
  checkout, folio charge, folio transfer, housekeeping transition, profile edit, or
  any other state mutation.
- Add focused tests that enforce the probe coverage and read-only boundary.

## Out of scope

- No new PMS write workflows.
- No database migration.
- No Gemini key rotation or provider configuration changes.
- No permanent tunnel work.

## Acceptance

- `bun test tests/order621-colleague-demo-readiness-probe.test.ts` passes.
- `bun tools/probe-colleague-demo-readiness.ts` passes against the live public demo.
- Evidence is recorded in `handoff/reviews/621-colleague-demo-readiness-probe.md`.
