# Order 667 - Arrival recovery and Today clarity

Date: 2026-09-23. Status: COMPLETE for scoped presentation/read-retry repair. Owner: Codex.

See receipt667. This is not whole-PMS or successful check-in acceptance.

Founder requests fast, token-efficient continuation of the existing single app.
Preserve Order666's one-app deployment and pre-existing dirty changes. This is a
presentation/read-retry repair, not an alteration of check-in eligibility.

## Scope

- This order and `handoff/receipts/667-arrival-recovery-and-today-clarity.md`.
- Matching order in `D:/Yellow/git-live-order611-source-v2/handoff/orders/`.
- Only in that live source: `frontend/yellow/src/yellow-api.tsx`,
  `frontend/yellow/src/workspaces/ReservationWorkspace.tsx`,
  `frontend/yellow/src/workspaces/TodayGlassDashboard.tsx`,
  `tests/order611-today-glass-dashboard.test.ts`,
  `tests/order667-arrival-recovery.test.ts` and generated `public/yellow-next` assets.
- Read-only search of known Yellow repositories/history for previous universal
  search; no blind duplication or search implementation in this order.
- Rebuild/recreate existing `yellow-public-demo-app-1` only after focused tests,
  typecheck and independent inspection. Retain current image as rollback.

## Delivery

Preserve server-provided room-candidate error information, give specific next-step
guidance without claiming a known cause when unknown, and add a bounded read-only
refresh control for room candidates/readiness. No automatic retry loop or new
cloud request. Clarify the capacity measure; do not calculate new availability in
the browser or alter underlying hotel math.

## Proof and restrictions

Tests accompany changes. Focused tests, root/frontend typecheck, boundary check,
production build and rendered browser proof of label and read retry. Independent
non-implementing review. No backend/schema/auth changes, mutation gates bypass,
model/key activation, paid call, new app, data writes or deletion. Source statuses
predating Order666 are historical, not evidence that today's service is stopped.
No PR or broad staging of the dirty working tree in this scoped repair.
