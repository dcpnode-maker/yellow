# Order 583 — Internal market lab and complete ecosystem shell

## Objective

Extend the accepted Order582 operational shell so the Yellow application presents
the complete product ecosystem with honest capability states, while adding a
zero-network internal market-intelligence laboratory for the Yellow Devices team.
The laboratory proves source contracts, zero-cost dispatch policy, normalization,
property-shell drift and offer semantics without contacting an OTA or exposing the
surface to hotel users.

## Source authority

- Base only on the exact independently accepted Order582 serving-source freeze:
  `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.
- Work in a separate candidate copy. Do not mutate the serving source or public
  runtime.

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/styles.css`
- `frontend/yellow/src/ecosystem/capability-registry.ts`
- `frontend/yellow/src/market-intelligence/contracts.ts`
- `frontend/yellow/src/market-intelligence/synthetic-adapter.ts`
- `frontend/yellow/src/market-intelligence/scheduler.ts`
- `frontend/yellow/src/workspaces/EcosystemHub.tsx`
- `frontend/yellow/src/workspaces/MarketIntelligenceLab.tsx`
- `tests/yellow-ecosystem-capability-registry.test.ts`
- `tests/yellow-market-intelligence-lab.test.ts`
- `tests/yellow-ecosystem-shell.test.ts`
- this order, its review, and the ledger entry

## Required behaviour

1. Add a registry-backed Ecosystem workspace covering Today/Overwatch,
   reservations/CRS, front desk, rooms, housekeeping, guest services, cashiering,
   finance, revenue, distribution, CRM, groups/events, maintenance/assets, F&B and
   ancillaries, purchasing/inventory, analytics, compliance, property setup,
   integrations and the Yellow guest/mobile ecosystem.
2. Every capability has a stable key, module, status (`live`, `beta`, `preview`,
   `blocked`, `planned`), audience, device support, prerequisite and route. Existing
   live workspaces keep working. Unbuilt items remain visibly grey, non-operational
   and explain why; preview details use fictional copy and never simulate success.
3. Preserve the accepted segmented-ribbon interaction, exact thin border language,
   neon-yellow selected edge, restrained semantic neon statuses, reduced motion,
   focus handling, 44px targets and mobile containment.
4. Add an Internal market lab that renders only when the deployment-owned frontend
   flag `VITE_YELLOW_INTERNAL_MARKET_LAB=1` is present. It must also visibly identify
   itself as Yellow Devices-only and synthetic. It exposes no client provider data,
   credential entry or network control.
5. Define strict frozen contracts for property-shell snapshots, observation requests,
   offer observations, availability signals, source policies, estimates and adapter
   results. Money remains bigint minor units plus currency.
6. Add a deterministic synthetic adapter and scheduler proving canonical cache keys,
   in-flight request coalescing, TTL, zero-cost hard stop, allowed-host refusal,
   bounded concurrency, typed partial/unavailable results and the rule that absence
   means `not_observed`, never inferred sold out.
7. The lab supports deterministic, AI-drift and manual analysis modes as presentation
   states only. No LLM, provider, browser, scraper, proxy, credential or external
   request is introduced.
8. Lazy-load the Ecosystem and internal Market Lab workspaces; do not grow the initial
   shell with their implementation. Avoid dependencies and duplicate global reads.

## Exclusions

- No schema, migration, database, API route, provider account, external request,
  credential, client-facing market data, paid call, scraper, fingerprint/proxy/Tor
  technique, CAPTCHA handling, private endpoint, inventory probe or deployment.
- No mutation of reservations, occupancy, rates, folios, journals, payments,
  documents, tax/fiscal state or existing capability authority.
- The internal frontend flag is discovery containment, not backend authorization and
  must not be described as sufficient for a future real-data release.

## Verification

- Focused contract, scheduler, registry, lazy-loading and honest-state tests.
- Existing Order582 responsive/performance/finance/deposit regression suite.
- Strict frontend TypeScript and production build with separate workspace chunks.
- Mounted browser proof at 375px and 1440px: no document overflow; keyboard ribbon,
  disabled capability, preview drawer, internal-flag absence/presence, reduced motion
  and no unintended network requests.
- Compare the rendered shell to the founder-approved ribbon/neon references and the
  accepted Order582 screenshots with a five-point fidelity ledger.

