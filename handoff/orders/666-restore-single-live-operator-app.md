# Order 666 - Existing public frontend startup repair

Date: 2026-09-23. Status: COMPLETE for startup/navigation restoration only. Owner: Codex.

Evidence and unresolved operational findings are in the coordination repo's
`handoff/receipts/666-single-live-app.md`. This is not whole-PMS acceptance.

Authoritative coordination order:
`C:/Users/astha/Documents/Codex/2026-08-14/cl/outputs/yellow/handoff/orders/666-restore-single-live-operator-app.md`.

Founder authorises restoring one existing live app, not launching a replacement.
Scope in this tree: this order, frontend/yellow/src/App.tsx,
frontend/yellow/src/workspaces/ReservationWorkspace.tsx, package.json, generated
public/yellow-next assets. Fix missing API import, stale assistant state setter
and safe optional-statement narrowing; add frontend typecheck to the existing gate.

Use existing frontend compiler as red/green proof, relevant Today tests and build.
Recreate only yellow-public-demo-app-1 with its existing Compose/env configuration,
after preserving rollback image and proving backend bytes match the running image.
Verify rendered UI and actual navigation through the existing tunnel. No new app,
database/provider/business-data mutation, credential change, source rewrite or
deletion. Preserve dirty work. Full release governance remains; no whole-PMS claim.

Q017 in the coordination repo additionally admits the focused regression test
`tests/order666-reservation-render-safety.test.ts` and correction of the conditional
timeline hook reached by the real reservation-navigation browser test.
It also admits correcting the stale nonexistent-handler expectation in
`tests/order620-today-colleague-demo-path.test.ts` to verify the actual state setter.
