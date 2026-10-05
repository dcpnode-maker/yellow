# Order 590 — shared ribbon depth system

## Objective

Apply the founder-approved ribbon language consistently to Yellow's top-level
operational tab surfaces: a restrained grey rail, one white selected capsule with a
thin neon-yellow edge, and no more than two non-interactive backing cards where the
ribbon introduces a substantial work region.

## Source authority

- Begin from the exact current public serving source at
  `D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.
- Work only in an isolated candidate directory. Public source, image, containers and
  hotel data remain unchanged until a separate release order.
- Preserve the independently approved Order 585/586 Today composition and Order
  587/588 guided checkout behavior except for the exact visual defects admitted
  below.

## Scope

- `frontend/yellow/src/ui/SegmentedRibbon.tsx`
- `frontend/yellow/src/workspaces/OperationalHub.tsx`
- `frontend/yellow/src/workspaces/EcosystemHub.tsx`
- `frontend/yellow/src/workspaces/MarketIntelligenceLab.tsx`
- `frontend/yellow/src/styles.css`
- Focused source/browser tests for ribbon depth, accessibility and responsive
  containment.
- `handoff/orders/590-shared-ribbon-depth-system.md`
- `handoff/reviews/590-shared-ribbon-depth-system.md`
- `handoff/LEDGER.md`

## Required behavior

1. The shared segmented ribbon exposes an explicit layered mode. It is not applied
   to small filters or controls by default.
2. Operations, Ecosystem and the internal Market Lab opt into that mode because each
   ribbon switches a substantial top-level work region.
3. Layered mode renders exactly two `aria-hidden`, pointer-inert backing cards behind
   the tab rail. They never receive focus, clicks or status meaning.
4. The rail remains neutral grey; exactly one selected tab is white with a thin
   yellow edge/glow. Status colours remain semantic and are not converted into LED
   bulbs.
5. Repair the accepted Today ribbon's missing yellow selected edge and the invalid
   backing-card offset declarations without changing its data, destinations or
   interaction.
6. Checkout retains its already-approved five-stage ribbon and exactly two backing
   cards unchanged.
7. At 240, 375 and 1440 CSS px the ribbon is usable, the selected tab is revealed,
   cards stay behind content, and the document has no horizontal overflow.
8. Forced-colour and reduced-transparency modes remove decorative depth; reduced
   motion removes sliding/transform animation. Keyboard tab semantics and 44 px
   touch targets remain intact.

## Required proof

- Focused source tests asserting opt-in application, exactly two decorative nodes,
  Today edge/offset repair, and accessibility fallbacks.
- Strict frontend typecheck, production build, package licence audit and import
  boundaries.
- Browser proof at 240, 375 and 1440 CSS px for Today, Operations and Ecosystem;
  Market Lab is tested only behind its existing Yellow-Devices flag.
- Image comparison against the supplied ribbon/card reference and the already
  approved checkout treatment.
- Independent non-implementing review of the frozen candidate.

## Exclusions

- No migration, schema, seed, fixture, role, grant, permission, backend, API,
  database, financial, checkout-state, OTA/provider, worker, container or public
  deployment change.
- No automatic activation of disabled ecosystem capabilities or public Market Lab.
- No cards behind every button/filter and no decorative LED bulbs.
- No completed-checkout retrieval change; that remains a separate order so visual
  work cannot accidentally widen operational authority.

## Implementation checkpoint — 2026-09-22

The isolated candidate is `D:\Yellow\temp\order590-ribbon-source`. The current
public source, app image, containers and all hotel records remain unchanged.

- `SegmentedRibbon` now has an explicit `layered` option that contributes exactly
  two `aria-hidden`, pointer-inert depth nodes. It remains off by default.
- Operations, Ecosystem and the Yellow-Devices-only Market Lab opt in. Checkout
  remains byte-unchanged because it already has its approved two-card treatment.
- Today's selected pill now has the same thin yellow edge/glow, and its invalid
  `inset-right`/`inset-left` declarations are repaired as valid offsets.
- Focused proof is 6 passed, 0 failed, 30 assertions. Strict frontend TypeScript,
  the 484-module Vite production build and the 203-file import-boundary scan pass.
  The inherited `tslib@2.8.1` 0BSD policy rejection remains unchanged; this order
  adds no dependency or lockfile change. The old boundary census unit also remains
  stale because it expects 13 contexts while the current source already contains
  `jarvis`; the actual boundary CLI passes all 203 files.
- Candidate-browser proof at 240, 375 and 1440 CSS px on Today, Operations and
  Ecosystem produced exact viewport-contained document/body widths, one selected
  tab, exactly two decorative cards and pointer-safe backing layers. The only
  automatic write was the existing synthetic `POST /api/v1/auth/demo:enter`; no
  operational or financial command was submitted. Independent review of the first
  freeze found that ArrowRight could leave the selected Operations tab clipped at
  240 CSS px. The shared ribbon now explicitly centers the newly selected tab after
  keyboard movement; rerun browser proof records `scrollLeft: 123` with the full
  selected pill inside the 196 px scroller viewport. The responsive rail also owns
  its scroll viewport without negative outer gutters.

Frozen source hashes for independent review:

| File | SHA-256 |
|---|---|
| `frontend/yellow/src/ui/SegmentedRibbon.tsx` | `28fd36b2e8860b1367be34935aecb7a552e83ffc4daf1c67915845a364781551` |
| `frontend/yellow/src/workspaces/OperationalHub.tsx` | `7ae9670667ed9470bccb70dcac4f141d46e7b05e61eb57eb4c5edf75bae25cd9` |
| `frontend/yellow/src/workspaces/EcosystemHub.tsx` | `2839758312b45d7dfd3051f5deec095d2cef2c72c90d521b880ae5e03d544105` |
| `frontend/yellow/src/workspaces/MarketIntelligenceLab.tsx` | `c0071274ca8029e435ebb45ca2d2f12be595644707bcd772bc58b2d13ef1e503` |
| `frontend/yellow/src/styles.css` | `dc0f7e95aea033c079279855c28fba3a70f993f973fcafd44a11d4741416cca4` |
| `tests/yellow-shared-ribbon-depth.test.ts` | `92034bb802dc2a32cc1b1a73b83bb0b80eb4130657d4bf59a98db9c1cc21b0f0` |
