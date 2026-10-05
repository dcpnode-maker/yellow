# Order 532 — Yellow frontend bundle splitting review

## Verdict

**ACCEPT — published performance refinement.** This review covers frontend
packaging and public asset delivery only. It is not acceptance of complete PMS
scope or colleague-share readiness.

## Implemented

- Replaced the single production bundle with Vite 8 / Rolldown native
  `build.rolldownOptions.output.codeSplitting` groups.
- Isolated the React runtime from other third-party dependencies, leaving a
  materially smaller application entry.
- Added executable contracts that reject warning-limit suppression, deprecated
  manual chunking, JavaScript chunks at or above 500 kB, or an application entry
  at or above 200 kB.
- Added no package and changed no PMS behaviour, data, API, voice, styling,
  authentication or operational state.

## Executed proof

- Intentional red: focused test failed against the previous one-line Vite
  configuration because `rolldownOptions` was absent.
- Green: `bun test tests/yellow-frontend-bundle-splitting.test.ts` — **2 passed,
  0 failed, 14 assertions**.
- `bun run typecheck` — passed.
- `bunx vite build --config frontend/yellow/vite.config.ts` — passed; **469
  modules transformed in 402 ms** with no oversized-chunk warning.
- Emitted uncompressed JavaScript:
  - app entry `index-B5utBozz.js`: **122,679 bytes** (30.38 kB gzip);
  - vendor `vendor-DDypS5ff.js`: **160,051 bytes** (50.86 kB gzip);
  - React runtime `react-runtime-Dy-GIXkn.js`: **218,833 bytes** (68.25 kB gzip);
  - Rolldown runtime `rolldown-runtime-CbXtAM7H.js`: **589 bytes**.
- Docker image rebuilt from the canonical runtime source; container reported
  healthy, loopback `127.0.0.1:3010/health` returned HTTP 200 and the loopback
  property route returned HTTP 200.
- The public property deep link returned HTTP 200. Every CSS/JavaScript asset
  referenced by the generated entry returned HTTP 200 through the Cloudflare
  tunnel with byte lengths matching the production output.
- Public 375×812 browser smoke rendered Locanda's current Today metrics, five
  mobile navigation controls and the Yellow launcher after deployment.

## Limits

- This improves cacheability and removes the oversized initial file; it is not a
  claim that all runtime performance budgets or Lighthouse gates are complete.
- The public URL remains a temporary laptop-hosted Cloudflare quick tunnel.

