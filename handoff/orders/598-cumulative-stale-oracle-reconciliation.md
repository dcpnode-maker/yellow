# Order 598 — Cumulative stale-oracle reconciliation

## Objective

Reconcile seven cumulative-suite tests with already accepted executable Yellow
behavior after the React workspace extraction and later governed workflow orders,
without weakening product behavior, architectural boundaries, or mutation safety.

## Scope

- `tests/operator-business-day-seal.integration.test.ts`
- `tests/operator-reservation-travel.integration.test.ts`
- `tests/operator-reservation-workspace.integration.test.ts`
- `tests/public-demo-proxy.intentional-red.test.ts`
- `tests/yellow-cashier-receivable-workbench.test.ts`
- `tests/yellow-next-checkout-confirmation.test.ts`
- `tests/yellow-workspace-performance.test.ts`

No production, dependency, generated-asset, migration, database, runtime, or
configuration file is in scope.

## Required behavior

1. Constructor-source assertions include the accepted operating-performance service
   composition while retaining every existing business-day and travel wiring check.
2. The legacy reservation workspace still proves its own assets are self-contained
   and that Elysia is present, but does not equate the repository-wide dependency
   manifest with that legacy asset's dependency set.
3. Public-demo assertions target executable workspace modules and verify the stronger
   successor behavior: named confirmation and mutation locks, confirmation-gated
   checkout, Party-ID navigation, and bounded voice restart after silence.
4. Cashier and checkout assertions target the extracted executable workspaces and
   retain deposit locking, caller-owned idempotency, fresh readiness, visible consent,
   and every active mutation lock.
5. Workspace-performance assertions continue to reject raw duplicate fetches while
   admitting only the Order 593 departure queue and per-request service detail query
   keys.
6. No assertion is deleted merely to obtain green output; each changed oracle cites
   the accepted successor behavior it proves.

## Acceptance evidence

- The seven focused files pass under Bun.
- The current successor workflow suites remain green.
- Strict TypeScript, import boundaries, and the complete cumulative suite are run and
  recorded; any remaining failure is classified rather than hidden.

## Exclusions

- No repair to the unauthorized fourteenth `src/contexts/jarvis` directory.
- No operator interface/gallery, compact-navigation, animation, bundle, provenance,
  temporary-fixture, database, or product behavior change.

