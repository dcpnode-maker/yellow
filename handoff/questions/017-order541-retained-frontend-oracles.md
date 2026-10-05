# Question 017 — Order 541 retained frontend oracles

Order 541's expanded regression run found two source-substring assertions outside
its declared test scope that no longer describe the current product:

- `yellow-ambient-ai-mode.test.ts` expects the pre-Order534 literal
  `className="yellow-ai-mode"`, while the reviewed stateful neon implementation
  deliberately renders `yellow-ai-mode ${yellowVisualState}`.
- `yellow-reservation-lifecycle-actions.test.ts` expects two reservation-detail
  lifecycle bindings. Order541's URL-stable inline filtered-row detail is a third
  governed `ReservationWorkspace` and correctly shares the same lifecycle lock.

This is routine test-contract reconciliation, not missing product intent. Resolve
under separate Order542 rather than silently widening Order541. Do not weaken either
assertion: require the stateful neon class and exactly three lifecycle bindings.
