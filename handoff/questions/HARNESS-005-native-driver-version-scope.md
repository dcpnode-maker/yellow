# HARNESS-005 native driver dependency seam

Resolved by implementation owner, 2026-09-28, under D-91.

The opt-in Windows fixture proves xa11y 0.13.0 returns null stable IDs for
Electron top-level windows. The pinned v0.15.0 Windows source introduces
native-HWND stable IDs and process-generation validation. Do not invent
coordinate or title-only identities to bypass the existing fail-closed gate.

Add only `apps/desktop/package.json`, generated `pnpm-lock.yaml`, and focused
existing WindowsForegroundFocusWorker/SnapShotAccessibility tests to the
HARNESS-005 native dependency seam. Pin xa11y 0.15.0, preserve upstream licence
and update its host version check. Install only into this local T3 checkout
with lifecycle scripts disabled. No global SDK/service/security changes.

The real owned-window action/revocation proof and independent review are still
required. This scope resolution does not grant native actuator acceptance.
