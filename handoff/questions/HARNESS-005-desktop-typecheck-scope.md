# HARNESS-005 — Desktop typecheck outside the current source scope

2026-09-28. The full local desktop `vp run typecheck` fails with two TS2883
errors in `apps/desktop/src/updates/updatesTestHarness.ts:37`. Its inferred
`makeHarness` return type references nonportable electron-builder types
`AllPublishOptions` and `PublishConfiguration` through builder-util-runtime.

This updates fixture is outside HARNESS-005's current native/startup/packaging
scope. It was not changed or suppressed. Before repairing it, record a narrow
scope amendment for an explicit fixture return type and personally rerun the
desktop typecheck/paired tests. No dependency upgrade, updater behavior change
or relaxation of the typecheck gate is implied. HARNESS-005 is still in progress.

## RESOLVED

D-91 routine implementation authority: the order now explicitly admits a named
fixture result shape and the existing updater tests. This removes an inferred
nonportable public type without changing runtime behavior. Full desktop typecheck
and paired tests remain required; no typecheck suppression is allowed.
