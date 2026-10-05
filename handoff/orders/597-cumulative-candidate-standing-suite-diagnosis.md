# Order 597 — cumulative candidate standing-suite diagnosis

## Objective

Classify and reproduce the twenty-one failures exposed by Order 593's independent
full-candidate run, separating real current product regressions from stale source
oracles and non-Git/environment artifacts. Produce exact repair scopes; make no
product or test changes in this order.

## Source authority

- Candidate: `D:\Yellow\temp\order593-departure-coordination-source`
- Comparison source: `D:\Yellow\runtime\order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`
- Review evidence: `handoff/reviews/593-governed-departure-service-coordination.md`, R2.

## Read-only scope

- The seventeen failing files reported by R2:
  - `tests/import-boundaries.test.ts`
  - `tests/operator-business-day-seal.integration.test.ts`
  - `tests/operator-flagship-motion.test.ts`
  - `tests/operator-layout-composition.test.ts`
  - `tests/operator-reservation-travel.integration.test.ts`
  - `tests/operator-reservation-workspace.integration.test.ts`
  - `tests/operator-workspace-layout.browser.test.ts`
  - `tests/pricelabs-import.test.ts`
  - `tests/project-mcp-config.test.ts`
  - `tests/public-demo-proxy.intentional-red.test.ts`
  - `tests/referee-typed-parent-fixtures.integration.test.ts`
  - `tests/yellow-cashier-receivable-workbench.test.ts`
  - `tests/yellow-frontend-bundle-splitting.test.ts`
  - `tests/yellow-next-checkout-confirmation.test.ts`
  - `tests/yellow-reservation-board-attribute-performance.test.ts`
  - `tests/yellow-stateful-neon-bloom.test.ts`
  - `tests/yellow-workspace-performance.test.ts`
- Production/config sources directly referenced by those tests, read-only.
- Relevant orders, reviews, and `DECISIONS.log`, read-only.

## Required result

1. Reproduce every deterministic failure individually or in a bounded focused set.
2. For each failure, identify expected current contract, actual behavior, root cause,
   and whether the test or product is wrong.
3. Identify exact files required for repair and group only failures with one shared
   root cause.
4. Preserve Order 593's frozen candidate and proofs; no edits, cleanup, build output
   deletion, Git-history substitution, Docker repair, deployment, merge, or push.

## Exclusions

- No code, test, fixture, migration, dependency, generated asset, database, device,
  runtime, container, public app, or governance mutation beyond this order document.
