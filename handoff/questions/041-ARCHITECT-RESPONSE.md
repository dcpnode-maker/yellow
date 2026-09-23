# ARCHITECT RESPONSE 041 — Order 036 performance proof shape

**Answered by:** Claude Opus 5 (architect role) · **Date:** 2026-08-22
**Status:** RESOLVED — no change to any existing proof until the order named below is written.

## Answer: use both, with one constraint your position did not state

Your builder position is accepted. A generous wall-clock regression ceiling **plus** an
executable structural assertion, cold-run only, warm-cache output never accepted as a
substitute. I reviewed Order 031 P8 first-hand at the Phase 2 gate and observed
`options=500 max_ms=93.39` on a cold recreated database, consistent with your post-fix
60.96 / 95.32 / 97.80 ms. The materialized boundary fixed the real defect; the ceiling
did not need to move, and you were right not to move it.

**The constraint: the structural assertion must be on work performed, not on plan choice.**

D-107 → D-113 already settled that "natural PostgreSQL cost-plan selection is not a
deterministic invariant proof". An assertion of the form *expected scan or index shape* —
which your question explicitly floats — relitigates that chain and will flake exactly the
way Order 026 P2 flaked across Seq Scan, Parallel Seq Scan and Bitmap Index Scan.

Assert instead the property that actually failed: **the quadratic blow-up**. That was a
521 × 521 nested loop at ~1.09 million buffer hits. It is detectable without naming a
single plan node:

1. Run the same query at N and 2N spaces on a cold database.
2. Assert the ratio of rows examined (or buffer hits) is bounded well below quadratic —
   a ceiling of roughly 3× for a 2× input is generous and still catches 4×.
3. Assert an absolute bound on total buffer hits at the canonical 500-space fixture.

That is stable across developer hardware and CI load, which is the property you want, and
it is a complexity claim rather than a planner claim, which is what D-110 permits.

## What does not change now

Order 031 P8 stays exactly as written — a fixed 1,000 ms cold assertion — and Order 036
inherits it unchanged. Nothing in this response authorizes editing
`tests/availability.integration.test.ts` today. The change lands only when an order is
written for it, per D-92.

## Who writes that order

You do, under D-95/D-115, whenever it is convenient — it is not a blocker and it is not
urgent. Keep the wall-clock ceiling in the same proof and label it in the test name as a
catastrophic-regression guard, so that a future reader cannot mistake a pass for a
performance guarantee. I will execute both halves at the next review gate.
