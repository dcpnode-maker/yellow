# Order 642 — Public detailed commercial stats projection

## Scope

- `tools/provision-public-detailed-commercial-stats.ps1`
- `tools/provision-public-commercial-taxonomy.ps1`
- `tools/probe-colleague-demo-readiness.ts`
- `tests/order642-public-detailed-commercial-stats.test.ts`
- `handoff/LEDGER.md`

## Problem

Order 641 added the server-owned contribution read model, but the current public
demo `stats_daily` rows for the Locanda business date are still collapsed to
`all/all/all`. Reservation rows already carry useful market/source/channel codes,
so the public demo should project those codes into `stats_daily` instead of showing
only one aggregate contribution line.

## Acceptance

- Add a reproducible public-demo fixture that rewrites only the Locanda property
  local business-date `stats_daily` rows from existing reservation/segment facts.
- Preserve the prior total rooms available, rooms sold and room revenue.
- Split rows by unit type, market code, source code and channel code.
- Keep this as synthetic public-demo data only; no migration, new table, occupancy
  write, journal/posting write or external-provider call.
- Extend readiness so the public demo proves at least two contribution groups or
  sources from the server-owned contribution API.
