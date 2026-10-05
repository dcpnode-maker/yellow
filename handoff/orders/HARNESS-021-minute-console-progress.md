# HARNESS-021 — Minute-refresh local progress console

Status: implementation in progress.

## Authority

Founder on 2026-09-30 requests post-migration continuation, all three available
GPU workers, and a PowerShell screen reporting each work stream every minute
with minimal model-credit use. This order is only the read-only status surface.
Worker execution remains governed by HARNESS-018; Paperclip is sole coordinator.

## Scope

- This order and handoff/reviews/HARNESS-021-minute-console-progress.md.
- E:/YellowWorkspace/ControlPlane/Build-Progress.ps1 and tests/progress.test.ps1.
- ControlPlane/README.md, project-register.json, worker-live-status.json.
- Launch one explicitly requested visible local PowerShell status window.

## Boundaries

No scheduler, model calls, worker dispatch, credentials, private connection URLs,
control changes, paid fallback, service restarts or automatic source integration.
Keep previous failed job receipts. Percentages only describe an explicit finite
batch, not overall ecosystem completion. Stale/unavailable evidence is visible.

## Acceptance

Fixture tests: missing/corrupt evidence, stale worker status, invalid counts,
bounded task percentage and missing live endpoint. Viewer does no model calls
and refreshes every 60 seconds. Verify one actual visible PowerShell process.
