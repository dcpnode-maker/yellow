# RMS-PLACES-001 — navigation regression proof

## RESOLVED

Root's adjacent proof reproduced an existing exact-15-destinations assertion
failing after adding the admitted sixteenth Market map workspace. Admit only
`tests/operator-layout-composition.test.ts`,
`tests/operator-flagship-motion.test.ts` and
`tests/operator-workspace-layout.browser.test.ts` to describe the actual new
sixteenth destination and Rates & inventory count4. Preserve all original15
destinations, their exact pinned symbols, focus/contrast/geometry/reduced-motion
and all API/authority assertions. Market map reuses the existing chart-bar symbol;
the original15 symbols and their vendor bytes remain unchanged. Assert the
original15 distinct bindings and the explicitly labelled new binding separately.
Serve the new same-origin JS/CSS in the existing synthetic browser fixture rather
than letting its asset requests404. This is a necessary regression-proof update
within Ankit's admitted new workspace, not permission to weaken unrelated gates.

The first exact CI34726099936 identified additional fixed route/dependency-list
expectations. Before changing them, extend this clarification to
`tests/operator-management-demo-navigation-finetune.intentional-red.test.ts`,
`tests/operator-workspace-skins.test.ts`,
`tests/operator-reservation-workspace.integration.test.ts` and
`tests/operator-adaptive-experience.test.ts`. Retain exact dependency allowlisting
with only the admitted MapLibre6.9.0 pin added. Other same-origin test failures
come from the literal URL in the search placeholder; simplify that example text
instead of relaxing those tests. Keep the failed run as evidence.
