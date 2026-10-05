# Order 585 — Minimal liquid-glass Today command surface

## Objective

Replace the current stacked Today ribbons with one restrained, premium first-screen
command surface inspired by the founder's accepted liquid-glass/glassmorphism
references. Use only Yellow's existing server-returned hotel metrics and preserve
normal operational screens as the drill-down destinations.

## Source authority

- Base on the independently reviewed Order584 candidate:
  `D:/Yellow/temp/order584-yellow-route-chunk-source`.
- Work in a new isolated candidate:
  `D:/Yellow/temp/order585-minimal-liquid-glass-today-source`.
- Do not mutate the accepted serving source or public runtime.

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/styles.css`
- one new frontend-only Today presentation module under
  `frontend/yellow/src/workspaces/` if it reduces the initial entry without changing
  data ownership
- focused Today presentation, navigation, accessibility, responsive and bundle tests
- `tests/yellow-voice-routing.test.ts` only to replace its obsolete assertion that
  the first fold must retain the removed Inventory KPI tile; all voice-routing
  assertions and deterministic KPI behavior remain unchanged
- this order, its review and ledger entry

## Required behaviour

1. The initial Today view presents one calm glass command surface, not a repeated
   dashboard-card wall. It contains at most five primary hotel signals above the
   fold at 375px and keeps the property-local greeting secondary.
2. Values come only from the existing Today lanes and operating-performance response:
   occupancy, arrivals, departures, in-house, rooms sold/available and room revenue.
   Missing or failed data renders an explicit unavailable/loading state; no sample,
   inferred trend, fabricated alert or reference-image value may appear.
3. Occupancy is the visual anchor, with rooms sold/available as its factual caption
   and room revenue as the sole commercial companion. Guest movement is one compact
   segmented ribbon. ADR, RevPAR, forecast and budget remain in the existing detailed
   performance view. Each interactive surface is a semantic button with an accessible
   destination label.
   The ribbon reuses the founder-approved pattern: one continuous rounded track,
   concise icon-and-label options and one white/glass active pill that translates
   smoothly between selections. It must not become a row of separately bordered
   tabs.
4. Tapping Arrivals, Departures or In house opens the existing complete movement
   table. Tapping Occupancy or Room revenue opens the existing accessible performance
   detail without invoking the AI or inventing a report route. No new navigation or
   business authority is created.
5. The material reads as high-end clear glass: thin refractive border, restrained
   specular highlight, soft depth, excellent type contrast and Yellow's selected
   neon-yellow accent. Status remains text-backed and never depends on colour alone.
   Do not use profile images, stock art, external assets, canvas or a chart library.
   One or two low-contrast offset preview cards may sit behind the active tab where
   they convey real supporting context. They are decorative depth layers, never
   duplicated behind every option, and may not obscure copy, focus, or pointer input.
6. At 375px there is no horizontal page overflow, primary touch targets are at least
   44px, values do not truncate ambiguously, and the visual hierarchy survives 200%
   zoom. Desktop uses the same information architecture without turning into a card
   grid.
7. Reduced-motion removes decorative movement; forced-colours preserves boundaries,
   labels and focus. Glass blur has a legible opaque fallback.
8. Today remains usable before lazy reservation and finance chunks download. The
   production app entry remains below 200,000 bytes and every JavaScript chunk below
   500,000 bytes.

## Exclusions

- No copied Dribbble branding, people, values, measures, imagery or text.
- No new API, query, metric definition, reporting inference, backend/domain change,
  dependency, migration, database, fixture, permission, provider or credential.
- No redesign of drill-down operational workspaces, AI behaviour or mobile nav.
- No public promotion or production action.

## Verification

- Focused static/component tests prove the source-backed metric set and exact existing
  drill-down handlers.
- Strict frontend TypeScript, fresh Vite build and bundle-budget test pass.
- Mounted 375px and 1440px browser proof covers loading, complete and unavailable
  states with no page overflow or console error.
- Keyboard-only, accessible-name, 200%-zoom, reduced-motion and forced-colours checks
  pass.
- Before/after screenshots are inspected against the accepted references for visual
  hierarchy while proving Yellow values and destinations are unchanged.
- An independent non-implementing reviewer inspects and executes the final proof.
