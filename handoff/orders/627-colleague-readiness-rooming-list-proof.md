# Order 627 — Colleague readiness rooming-list proof

## Intent

Ensure the public colleague-readiness gate proves the new group-block rooming-list
drilldown, not only the group-block totals.

## Scope

- `tools/probe-colleague-demo-readiness.ts`
- `tests/order625-group-block-provisioning.test.ts`
- `handoff/LEDGER.md`

## Boundaries

- No runtime behavior change.
- No schema/data change.
- No public asset rebuild required unless the probe/test files force one later.

## Acceptance proof

- `bun test tests/order625-group-block-provisioning.test.ts`
- `bun tools/probe-colleague-demo-readiness.ts`

