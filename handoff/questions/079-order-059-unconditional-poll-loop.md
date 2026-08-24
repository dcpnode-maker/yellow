# Question 079 — Order 059 Bun skips optional-chain while condition

**Status:** CLOSED — temporary architect response recorded
**Order:** 059
**Evidence:** the compiled exact method contains
`while (options.signal?.aborted !== !0)`, the supplied signal reports false, yet the body
makes zero consume attempts before 130 ms. Callback count is also zero.

May production use `for (;;) { if (options.signal?.aborted === true) return; ... }`, moving
the optional-chain check into an explicit early return rather than the loop condition?
All drain, cadence, retry, sequential-await and callback behavior remains unchanged.
