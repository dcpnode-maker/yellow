# RESOURCE-20261005-stay-billing-continuity-73

## Finite order

Authorized bounded frontend workflow improvement on immutable source `3cfa8b3bd6ce5038a4a6947726b80a9bacd26773`, branch `phase-7/stay-billing-continuity-20261005`. Work only in the isolated shared clone `C:\Users\astha\yellow-fast-20261005\stay-billing`; do not touch live or runtime state.

Reservation-origin navigation can select the current stay in Billing, but Billing does not expose a direct return to that stay's reservation detail. Add a clear “Return to reservation” action when a reservation-origin context is supplied. It must return through the app's existing guarded same-property History navigation to `/p/{propertyId}/res/{reservationId}`, retain the selected stay context and mount without a reload. Arrival/checkout context means the existing reservation detail route and its lane/ribbon; do not add a new lifecycle action.

Allowed paths are exactly `frontend/yellow/src/App.tsx`, `frontend/yellow/src/workspaces/FinanceWorkspace.tsx`, `tests/order773-stay-billing-continuity.test.tsx`, this finite order, and this implementation report. Keep the change to navigation props and visible return affordance. Do not alter financial handlers, money calculations, request bodies, keys, confirmation/recovery behavior, auth/tenant checks, backend, migrations or other App state. Preserve existing navigation lock behavior and hide/disable the return affordance while lifecycle/uncertain work blocks navigation.

Inspect relevant existing rules and `DECISIONS.log`; reuse existing dependency tree only. No dependency install. Run one focused mounted navigation/lock test and the frontend typecheck once. If a check fails, diagnose within a bounded pass and retain the failure. Do not run broad suites or touch runtime. Do not commit unless root requests.

## Implementation report

Base: `3cfa8b3bd6ce5038a4a6947726b80a9bacd26773`  
Branch: `phase-7/stay-billing-continuity-20261005`

Reservation detail already opened Billing with a reservation query parameter, and the mounted app already owned same-property History navigation and lifecycle/recovery guards. Billing lacked a return control. The bounded change passes an optional return callback from App only for reservation-origin billing, exposes “Return to reservation” for that context, and routes the currently selected reservation through the existing guarded navigation controller. The selected reservation ID remains the destination identity. No billing command, financial request, money calculation, authority, backend or runtime code changed.

The focused mounted test passed: 1 test, 13 assertions. It renders the actual `CashierWorkbench` in owned headless Chromium with synthetic auth and read-only API fixtures. Standalone Billing has no return action; reservation-origin Billing shows the selected guest and enabled action; activating it calls back with the selected reservation ID and changes the path to that stay. With the existing navigation permission callback locked, the button is disabled and activation produces no second callback or route change. No financial write occurs. The frontend TypeScript check exited 0 using the existing local binary: `bun C:\Users\astha\yellow-fast-20261005\stay-billing\frontend\yellow\node_modules\typescript\bin\tsc --noEmit -p frontend/yellow/tsconfig.json`.

The earlier check command used `bun x tsc --noEmit -p frontend/yellow/tsconfig.json`; Bun reported “Resolving dependencies / Resolved, downloaded and extracted [42] / Saved lockfile.” No dependency manifest or lockfile appears in Git status. This initial package-resolution side effect is retained as a process deviation. The mounted rerun used only the existing local dependency tree and no further package resolution.

Mounted-fixture diagnosis retained: early observations initially raced the reservation-detail read; waiting for the selected guest fixed that. The next focused run exposed that the direct `CashierWorkbench` fixture had not called Yellow's existing `configureYellowApi(propertyId)`, so its synthetic read URLs had an empty property segment. The fixture now configures the real property scope before mounting, then verifies the exact selected-reservation read. The final focused run passes.

No live service, runtime, database, migration, deployment or commit was used. The only changed paths are App, FinanceWorkspace, this focused test, and this order/report file.

Frozen source SHA-256:

- `frontend/yellow/src/App.tsx`: `7AAD134FE43774F9BD35EA1DA978926AF66574D8F12DC6DF2542228B8C0340BF`
- `frontend/yellow/src/workspaces/FinanceWorkspace.tsx`: `CEE0B8CE74942E2C4795B5D98A0EAB52FFBFFCC8B3D6156EAD9DC6D14B7709F2`
- `tests/order773-stay-billing-continuity.test.tsx`: `60039262F5F61226EADD306D11FCF44A13E79D3F8F3094B5A652D1B6D0CD64A5`
