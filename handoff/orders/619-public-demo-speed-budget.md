# Order 619 — Public demo speed budget and probe

## Intent

Make Yellow's "instant-feeling" public demo speed claim measurable before sharing the
demo with colleagues.

## Scope

- Add a lightweight public-demo performance probe that can run against the current
  local/public app without mutating hotel data.
- Check public shell latency, API health latency, and bundled asset size ceilings.
- Add focused tests proving the probe encodes concrete speed budgets and remains
  read-only.
- Record the measured evidence in a review note.

## Out of scope

- No database migrations.
- No PMS workflow state changes.
- No Docker cleanup, permanent tunnel creation, or production cutover.
- No rewrite of frontend architecture or backend language.

## Acceptance

- `bun test tests/order619-public-demo-speed-budget.test.ts` passes.
- The probe runs successfully against the current public demo.
- Evidence is recorded in `handoff/reviews/619-public-demo-speed-budget.md`.
