# Order 622 — Mobile-first public demo probe

## Intent

Make the mobile-first public demo requirement repeatably verifiable from the built
assets and live public shell.

## Scope

- Add a lightweight probe that fetches the public app shell, its built CSS and main
  JavaScript bundles, then verifies mobile navigation, safe-area padding, horizontal
  containment, Today colleague demo path, and Overwatch launch/assistant text.
- Keep the probe read-only.
- Add focused tests proving the probe checks the intended mobile contracts.

## Out of scope

- No new PMS write command.
- No database migration.
- No visual screenshot comparison; this is an asset/runtime contract gate.

## Acceptance

- `bun test tests/order622-mobile-first-public-demo-probe.test.ts` passes.
- `bun tools/probe-mobile-public-demo.ts` passes against the public app.
- Evidence is recorded in `handoff/reviews/622-mobile-first-public-demo-probe.md`.
