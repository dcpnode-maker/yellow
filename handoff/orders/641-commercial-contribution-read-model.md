# Order 641 — Commercial contribution read model

## Scope

- `src/contexts/reporting/commercial-contribution.ts`
- `src/contexts/reporting/index.ts`
- `src/http/operator.ts`
- `src/app.ts`
- `tools/provision-public-commercial-taxonomy.ps1`
- `tools/probe-colleague-demo-readiness.ts`
- `tests/order641-commercial-contribution-read-model.test.ts`
- `handoff/LEDGER.md`

## Problem

The founder clarified the hotel math should stay simple and operational: room nights
and revenue roll up from sources into market segments and market segment groups,
then into property-level occupancy, ADR and RevPAR. The public demo currently shows
some business mix in the UI from reservation movement rows, but the fast dashboard
needs server-owned contribution math from the existing `stats_daily` projection and
the configured commercial taxonomy.

## Acceptance

- Add a read-only API that returns MSG → MS → source/channel contribution rows for
  the property-local business date.
- Use only existing authoritative reads: `stats_daily`, `org_node` and the active
  commercial attribution extension.
- Add a reproducible synthetic public-demo fixture for the active commercial
  attribution extension if the live demo database lacks one.
- Return rooms available, room nights, revenue, occupancy contribution, ADR and
  RevPAR using integer minor-unit math.
- Do not add tables, migrations, write commands, occupancy writes, journal writes or
  external provider calls.
- Extend the public colleague-readiness probe so the demo fails if the contribution
  hierarchy disappears.
