# Order 604 — Browser-build output isolation

## Objective

Make the two Yellow browser proofs safe under Bun's parallel full-suite execution so
they cannot race over or restore the committed frontend artifacts.

## Scope

- `tests/yellow-ai-speech-consent.test.ts`
- `tests/yellow-departure-coordination.browser.test.ts`

No frontend source, generated committed asset, backend/API, database, migration,
configuration, dependency, product behavior, or other test is in scope.

## Required behavior

1. Each browser proof builds current frontend source into its own unique test-owned
   temporary output directory.
2. Each proof serves only its own isolated output and removes that output in `finally`.
3. Neither proof writes, deletes, replaces or reads its browser assets from committed
   `public/yellow-next` during execution.
4. Existing speech-consent, confirmation, no-write-before-confirm, queue, geometry,
   accessibility and viewport assertions remain unchanged.
5. Concurrent execution of both browser proofs must pass and leave committed frontend
   artifact hashes byte-identical.

## Acceptance evidence

- Both browser tests pass when run together.
- A before/after hash manifest for `public/yellow-next` is identical.
- The full `bun test` suite no longer changes committed frontend output and its bundle
  budget assertion observes the accepted generated entry.
- Strict TypeScript and import boundaries remain green.

## Exclusions

- No browser-proof weakening, serialization through a shared global lock, generated
  asset refresh, public deployment, Docker, database, Overwatch or local-model change.
