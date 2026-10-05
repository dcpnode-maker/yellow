# Review 583 — internal market lab and complete ecosystem shell

## Decision

**ACCEPTED AS AN ISOLATED CANDIDATE; PUBLICATION WITHHELD.**

The candidate is based on the accepted Order582 serving-source freeze and remains at
`D:/Yellow/temp/order583-internal-market-ecosystem-source-v2`. The serving source,
database, APIs, providers and public runtime were not changed.

## Delivered boundary

- Registry-backed ecosystem workspace with 20 modules and every founder-approved
  operational mock surface represented as `live`, `beta`, `preview`, `blocked` or
  `planned`.
- Existing live/beta surfaces route to existing workspaces. Unbuilt surfaces are
  grey, disabled for operations and expose a factual prerequisite/boundary drawer.
- Yellow Devices-only synthetic market laboratory behind the exact build flag
  `VITE_YELLOW_INTERNAL_MARKET_LAB=1`.
- Frozen bigint-money contracts, deterministic synthetic adapter and zero-network
  scheduler with canonical keys, coalescing, TTL, zero-cost/allowed-host refusal,
  bounded concurrency and `not_observed` absence semantics.
- Separate lazy chunks for Operations, Ecosystem and Market Lab. No new dependency.

## Independent review

Reviewer: `/root/order583_integration_audit` (did not implement the change).

The reviewer personally inspected the final candidate, verified all fourteen named
founder-approved additions remain `preview`/`planned` with `existing: false`, and ran:

```text
bun test tests/yellow-ecosystem-capability-registry.test.ts tests/yellow-market-intelligence-lab.test.ts tests/yellow-ecosystem-shell.test.ts
bunx tsc -p frontend/yellow/tsconfig.json --noEmit
bunx vite build
```

Focused proof and frontend strict TypeScript passed. The build emitted distinct
`EcosystemHub-*`, `MarketIntelligenceLab-*` and `OperationalHub-*` chunks. Static
inspection found no fetch/XHR/WebSocket/EventSource, credential input, provider,
proxy or scraper implementation in the lab boundary.

Root's final combined scoped proof after the named-screen additions:

```text
30 passed, 2 pre-existing reviewer-owned skips, 0 failed, 1165 assertions
frontend strict TypeScript: passed
Vite production build: passed (480 modules)
EcosystemHub: 43.03 kB / 10.49 kB gzip
MarketIntelligenceLab: 9.88 kB / 3.44 kB gzip
```

Mounted browser proof:

- 375×812 ecosystem: `scrollWidth 360 <= innerWidth 375`, 37 disabled preview
  actions, selected neon-yellow ribbon edge, seven contained mobile actions.
- 1440×1000 lab: `scrollWidth 1425 <= innerWidth 1440`; deterministic synthetic
  run produced itemized fictional offers and a repeat run reported TTL cache.
- Flag absent: ecosystem contains no internal-lab CTA and direct
  `?workspace=market-lab` falls back to Today.
- Flag present: lab is visibly labelled `Yellow Devices only · synthetic · zero
  network`.

## Fidelity ledger

1. Founder ribbon: retained the pill track, white sliding selection, exact thin edge
   and neon-yellow selected glow.
2. Order582 border language: one-pixel grey border plus subtle white inner edge,
   rounded cards and restrained depth.
3. Status colour: verified alone receives a neon-green light bloom; warning and
   urgent remain semantic, and no LED-bulb decoration was introduced.
4. Density: module cards progressively disclose details in the contextual drawer;
   the primary screen stays scannable despite the full catalogue.
5. Mobile: the same DOM and registry render at phone width with horizontal ribbon
   containment, 44px controls and no document overflow.

## Inherited repository gates

The reviewer also ran broader historical gates and retained three pre-existing
repository findings rather than misattributing them to Order583:

- the current accepted Order582 baseline app entry is 307.91 kB while an old test
  requires `<200 kB`; Order583 is 311.43 kB and moves its two workspaces into separate
  chunks;
- root `bun run typecheck` includes two existing JSX-import test configuration
  failures, while the scoped frontend strict check passes;
- the existing `/invoices` gallery-close browser test times out outside this route.

These prevent claiming repository-wide green or public release. They do not alter
the bounded candidate result and require separately scoped remediation.

## Frozen source hashes

```text
ecfc8196b1adbc39283d733d506db2deb7a5effce301c37ebc9db662822ecc85  frontend/yellow/src/App.tsx
849a532a04c15640df97ecef422589e9efd29b8201e97167f2d20f1c01427842  frontend/yellow/src/styles.css
b267c03ae5d1f724d326c9fcf706a84c9a9ab54c60c6df8ebe9cf70391c60fc0  frontend/yellow/src/ecosystem/capability-registry.ts
2cdf8aa73d9a66b88d528ad4316d64ceafc89234ea2e53ec0768691bb220a3e3  frontend/yellow/src/market-intelligence/contracts.ts
d4dcfd83868008cf5395add07d1d328f434f762f91045e8e695281856d652f3b  frontend/yellow/src/market-intelligence/synthetic-adapter.ts
a2997b9056bae177793ff5f15b291ac1d4ed412926a1972a7cc96a0ecbfdef5c  frontend/yellow/src/market-intelligence/scheduler.ts
1d081c1abd468e37df126bbea5d7d6d2fe528d206b6c04f9c7bbd88846178f5f  frontend/yellow/src/workspaces/EcosystemHub.tsx
edfeabe7acee55e05470092e98a0be03671031acebd52e8888c5b2e79a3f5138  frontend/yellow/src/workspaces/MarketIntelligenceLab.tsx
48a4f8b9c63a0dfcab3562e2f552d8891d57fbb6e5f4ce5867ef306d9650f1ab  tests/yellow-ecosystem-capability-registry.test.ts
07f2b38e3ccf3c7f657bbddda3dbf920e12dc06c8b56487813a1cee8f4534d38  tests/yellow-market-intelligence-lab.test.ts
dda990cda7f72ab25225a8962aee1cb3f9383f1e6bc30bab18cd2fd4dfaee3b2  tests/yellow-ecosystem-shell.test.ts
```
