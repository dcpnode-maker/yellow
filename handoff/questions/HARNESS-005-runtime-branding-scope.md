# HARNESS-005 — Native window branding

The desktop package already names the product Universal Harness, but its runtime
window title remains T3 Code. Admit only `apps/desktop/src/app/DesktopEnvironment.ts`
and its paired test to derive the display name from that existing package field.
Application IDs, protocol, state paths, authentication, updater behavior and MIT
provenance stay unchanged. D-91 routine scope revision; no external activation.

## RESOLVED

Recorded in the order before implementation. Verify desktop types and paired test.
