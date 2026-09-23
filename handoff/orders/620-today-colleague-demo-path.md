# Order 620 — Today colleague demo path

## Intent

Make the public demo easier for a colleague to review without needing the founder or
agent to narrate where implemented PMS workflows live.

## Scope

- Add a compact, mobile-first colleague demo path to the Today command centre.
- Link each path card to an implemented bounded workspace or assistant entry point.
- Keep Today read-only: these cards navigate only; no PMS write action runs from the
  dashboard.
- Add focused tests for the visible copy, routing contract, and mobile styling.

## Out of scope

- No database migrations.
- No new operational write command.
- No changes to governed confirmation gates.
- No external connector enablement.

## Acceptance

- `bun test tests/order620-today-colleague-demo-path.test.ts` passes.
- `bun run typecheck` passes.
- The public demo is rebuilt from the live-source branch.
