# Order 625 — Reproducible public group-block fixture

## Intent

Make the public-demo Opera-style group-block data reproducible and fail-fast in the
colleague readiness probe. Order 623 added the workbench and the initial live fixture;
this order prevents the demo from depending on manual SQL memory after rebuilds,
database cutovers or fixture refreshes.

## Scope

- `tools/provision-public-group-blocks.ps1`
- `tools/probe-colleague-demo-readiness.ts`
- `tests/order625-group-block-provisioning.test.ts`
- `handoff/LEDGER.md`

## Invariants

- No schema migration.
- No change to occupancy authority, posting, journals, tenancy, or money logic.
- Synthetic public-demo data only.
- Group-block math stays intentionally simple:
  - block allotment rows define blocked rooms;
  - linked reservations define picked-up rooms;
  - remaining = blocked - picked-up.

## Acceptance proof

- `bun test tests/order625-group-block-provisioning.test.ts`
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\provision-public-group-blocks.ps1`
- `bun tools/probe-colleague-demo-readiness.ts`
- `bun run typecheck`

