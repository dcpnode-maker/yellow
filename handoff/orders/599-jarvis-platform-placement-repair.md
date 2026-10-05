# Order 599 — Overwatch successor platform-placement repair

## Objective

Restore the fixed thirteen-context architecture by relocating the context-independent
legacy Jarvis transport/service out of `src/contexts/` under its founder-confirmed
successor identity, **Overwatch**, while preserving API compatibility, privacy guard,
multilingual navigation, rate limiting, and governed confirmation semantics.

## Scope

- `src/contexts/jarvis/index.ts`
- one explicit non-context Overwatch platform/application source location under
  `src/`
- `src/app.ts`
- `src/server.ts`
- `tests/jarvis.test.ts`
- `tests/import-boundaries.test.ts` only if needed to ensure the real tree census and
  scanned platform location remain explicit
- focused source-import tests directly broken by the relocation

## Required behavior

1. `src/contexts/` contains exactly the thirteen contexts fixed by PROJECT.md and
   D-67; neither Jarvis nor Overwatch is represented as a hotel domain context.
2. Overwatch is the current product identity. The relocated platform/application
   service uses Overwatch names internally; any retained Jarvis route or symbol is an
   explicit compatibility alias only, never a competing implementation.
3. Application and server composition import Overwatch from its new explicit
   platform location; no compatibility duplicate or second source of truth remains.
4. The placement must not turn `src/kernel/` into a dependency-bearing junk drawer:
   if Jarvis performs provider/network/application orchestration, it remains outside
   the dependency-free kernel.
5. Privacy refusal, request bounds, retry policy, navigation/focus resolution, and
   confirmation requirements retain focused executable coverage.

## Acceptance evidence

- Overwatch focused tests pass, including any deliberate legacy compatibility alias.
- `tests/import-boundaries.test.ts` and `bun run boundaries` pass and prove exactly
  thirteen canonical contexts.
- Strict TypeScript and all directly affected server/application suites pass.
- The full cumulative suite is rerun and remaining failures are reported separately.

## Exclusions

- No new model/provider, credential, prompt, external call, tool authority, mutation
  route, database, schema, migration, frontend design, or public deployment.
- No stale-oracle, Docker, bundle, temporary-fixture, or operator-interface repair.
