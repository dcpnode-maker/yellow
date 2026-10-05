# Order 623 — Colleague operating journey contract

## Scope

- Add a single runtime contract that a colleague demo UI can render as the Yellow
  operating journey.
- Include current-date operational cards for arrival, stay, cashier, housekeeping,
  group block, checkout and Overwatch.
- Keep all operational actions confirmation-gated and non-mutating in this thin
  checkout.

## Out of scope

- Database writes, migrations, folio posting, occupancy mutation, statutory
  submission, payment capture, or public deployment.
- Claiming the full demo is ready.

## Acceptance

- `GET /api/v1/demo/operating-journey` returns a deterministic property workbench.
- Every action that would change PMS state is marked `requiresConfirmation: true`
  and `executionEnabled: false`.
- The journey carries operational purpose for each area so the screen is useful, not
  just decorative.
- Tests prove workflow coverage, cashier/checkout gating and group-block linkage.
