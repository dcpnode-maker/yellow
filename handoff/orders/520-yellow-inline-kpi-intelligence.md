# Order 520 — Yellow inline KPI intelligence

## Objective

Make governed hotel KPI requests resolve locally and render their current
actual, last-year, forecast and budget comparisons inside Yellow AI mode rather
than producing model prose or asking the operator to navigate manually.

## Scope

- `frontend/yellow/src/voice.ts`
- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/styles.css`
- `tests/yellow-voice-routing.test.ts`
- focused frontend verification and public visual smoke test
- `handoff/reviews/520-yellow-inline-kpi-intelligence.md`

## Required behaviour

1. Recognise occupancy, rooms sold/room nights, ADR, RevPAR, inventory and
   operating-performance requests before generic rate-workspace routing.
2. Use only the existing property-scoped operating-performance response; do not
   calculate or invent a second KPI source.
3. Render Today, MTD, QTD and YTD comparisons for actual, last year, forecast
   and budget directly inside Yellow.
4. KPI-ribbon selection opens the result immediately. The operator must not
   need to re-submit a pre-filled prompt.
5. Preserve the existing scenario-data disclosure and mobile accessibility.

## Exclusions

- No KPI API, data-model, forecast, budget, database or financial change.
- No write action or model call for these deterministic reads.

## Verification

- Focused routing and static integration tests.
- Strict TypeScript and production frontend build.
- Public browser proof for one KPI and full performance on desktop and phone.
