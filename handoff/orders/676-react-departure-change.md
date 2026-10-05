# Order 676 — Change departure in the active reservation workspace

Status: DELIVERED — 24 September 2026. Independent source/database/browser-fixture proof and root live acceptance passed; receipt676 records final image and boundaries. Founder requests the functional ecosystem in the existing single live app. This order completes one missing staff workflow; it does not assert ecosystem completion.

## Objective and authority
Expose the existing governed reservation segment lookup and departure-change command in the current React reservation workspace. D-563/D-564 and the existing legacy operator stay-change flow are the behavioral reference. Preserve PROJECT.md invariants, exact reservation/property identity, occupancy arbitration and existing pricing behavior. No new backend command or schema.

## Scope in D:/Yellow/git-live-order611-source-v2
- frontend/yellow/src/yellow-api.tsx (typed segment lookup/change-departure transport only)
- frontend/yellow/src/reservation-departure-change.ts (optional focused client state/validation helpers)
- frontend/yellow/src/workspaces/ReservationDepartureChange.tsx (focused editor)
- frontend/yellow/src/workspaces/ReservationWorkspace.tsx (integrate editor beside stay segments; coordinate existing mutation lock and refresh)
- frontend/yellow/src/styles.css (scoped editor styling reusing accepted neutral design)
- tests/order676-*.test.ts (transport/state/component interaction proofs)
- tests/order623-group-block-workbench.test.ts (superseded branded title assertion only, Q676-regression-copy-scope)
- tests/yellow-reservation-command-surface.test.ts; tests/yellow-reservation-finance-entry.test.ts (superseded inline component boundaries only, Q676-regression-copy-scope)
- handoff/orders/676-react-departure-change.md; handoff/reviews/676-*.md; handoff/receipts/676-*.md; handoff/LEDGER.md
- docs/PROJECT-STATUS.md (verified current runtime and explicit remaining gaps only, preserving history)
- temporary order676 deployment Dockerfile (delete after use)
- Coordination C tree: this order, handoff/questions/676-*.md, handoff/receipts/676-*.md, handoff/LEDGER.md.

Preserve the dirty integration tree/branch and all unrelated work. No bulk staging, commits of unrelated changes, live fixture mutation, schema/backend edits, new permissions, paid service enrollment, additional persistent/live app instance or destructive cleanup. Isolated ephemeral loopback fixture servers and browser profiles for repeatable integration tests are allowed; never use production data and remove their exact owned resources afterwards. Record a scope question before editing any other file. Room move and booked meal/class lineage remain follow-on work, not invented fields.

## Behavior
Load segments only for the exact opened reservation/property. Honor server action eligibility. Require explicit review of old and new departure, timezone-aware input, loaded expectedPeriod and exact identity. Lock overlapping reservation mutations. Retain one idempotency key and immutable payload across an uncertain response; do not permit a new conflicting attempt until resolved. Re-read reservation and segments after success and show success only if authoritative data agrees. Explain capacity/stale-data failures with a recovery action. Do not claim this command reprices, posts charges, or sells late checkout; current service explicitly returns no financial journal.

## Ownership and proof
Sol implementation owns only the client/component/test files above. Root owns integration review, runtime audit, browser proof and narrow deployment. A separate non-implementing agent must personally execute existing segment/occupancy proofs against an isolated PostgreSQL 18 database plus new focused tests, and record exact commands/results/findings. Skipped DB suites are not proof. No fixture writes to live.

Types, focused tests, boundaries and build must pass. Exercise the actual component success/denial/conflict/uncertain retry in a controlled test environment. Live read-only desktop/mobile checks confirm visibility, identity, layout and no console errors. Deployment derives from the current order675 image and replaces reviewed frontend assets only; preserve rollback and all existing companions. Record remaining limitations honestly.
