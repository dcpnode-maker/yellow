# Order 584 — Yellow route chunk budget recovery

## Objective

Restore the accepted Yellow frontend delivery budget after later operator workflows
regrew the initial application entry from the independently accepted 122,679-byte
Order532 baseline to approximately 311 kB. Preserve every current workflow while
moving route-only implementation behind lazy boundaries.

## Source authority

- Base on the independently reviewed Order583 candidate:
  `D:/Yellow/temp/order583-internal-market-ecosystem-source-v2`.
- Work in a new isolated candidate. Do not mutate the accepted serving source or
  public runtime.

## Scope

- `frontend/yellow/src/App.tsx`
- new files under `frontend/yellow/src/workspaces/` and directly required shared
  frontend-only modules
- `frontend/yellow/src/styles.css` only for loading-state containment if required
- `frontend/yellow/vite.config.ts` only if the installed Rolldown contract requires a
  source-compatible grouping correction
- `tests/yellow-frontend-bundle-splitting.test.ts`
- focused route, finance, reservation, voice and Order582/583 regression tests
- this order, its review and ledger entry

## Required behaviour

1. The production app entry is below the existing 200,000-byte gate; every JavaScript
   chunk remains below 500,000 bytes.
2. Reservation detail/board/create, finance/cashier/deposit and other heavy route-only
   surfaces are loaded only when entered. Today and the mobile shell remain usable
   without downloading every workbench.
3. Existing routes, deep links, confirmation gates, mutation locks, idempotency and
   stale-result protections remain byte-for-byte equivalent in behavior.
4. Ecosystem, Market Lab and Operations retain their separate lazy chunks. The
   internal lab flag remains exact and absent-by-default.
5. No duplicate property/global reads, new dependency, API, database, schema,
   provider, credential or public deployment is introduced.

## Exclusions

- No workflow redesign, new operational authority, backend/domain change, provider,
  migration, database, fixture, public promotion or production action.
- Do not weaken or raise the bundle limits, suppress warnings, or delete tests to
  obtain green output.

## Verification

- Intentional red captures the current 311 kB entry before extraction.
- Existing bundle-budget test passes against a fresh production build.
- Strict frontend TypeScript and focused reservation/finance/voice/Operations/
  Ecosystem regressions pass.
- Mounted 375px and 1440px smoke proves Today loads, then each lazy route loads on
  demand without overflow or console error.
- Browser resource evidence proves heavy route chunks are absent before navigation
  and fetched after the corresponding route opens.
- Independent non-implementing review inspects the final boundaries and executes the
  proof before publication is considered.
