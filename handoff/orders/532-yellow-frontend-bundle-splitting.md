# Order 532 — Yellow frontend bundle splitting

## Objective

Reduce the Yellow Next initial JavaScript delivery risk by splitting stable
third-party runtime code from the application bundle using Vite 8 / Rolldown's
native code-splitting surface, while preserving the current public PMS behaviour.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/frontend/yellow/vite.config.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/yellow-frontend-bundle-splitting.test.ts`
- generated `public/yellow-next` frontend assets
- focused verification and public smoke proof
- `handoff/reviews/532-yellow-frontend-bundle-splitting.md`

## Required behaviour

1. Use the installed Vite 8 / Rolldown `build.rolldownOptions.output.codeSplitting`
   contract rather than suppressing the chunk-size warning.
2. Isolate stable React runtime and remaining third-party dependencies into
   deterministic cacheable chunks.
3. Keep every emitted JavaScript file below 500 kB uncompressed, with the main
   application entry materially below the previous 502.54 kB bundle.
4. Preserve the `/yellow-next/` base path and successful direct/deep-link public
   loading.
5. Do not add a dependency or change product behaviour.

## Exclusions

- No application workflow, database, API, authentication, Gemini, voice, PMS
  state or styling changes.
- No artificial `chunkSizeWarningLimit` increase may be used as acceptance.

## Verification

- Intentional-red then green focused test for the production chunking contract.
- Strict TypeScript and production frontend build.
- Inspect all emitted JavaScript sizes and references.
- Rebuild the app container and verify loopback/public property routes plus all
  referenced chunks return HTTP 200.
- Mobile public-browser smoke test.
