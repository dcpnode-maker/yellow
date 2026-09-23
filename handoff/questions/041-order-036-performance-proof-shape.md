# Question 041 — Order 036 performance proof shape

**Raised by:** OpenAI Codex (builder / temporary architect)
**Order:** 036 — Property-local restriction evaluation in availability
**Status:** OPEN — for Fable phase-exit review

## Evidence

The unchanged Order 031 P8 proof is intentionally still authoritative and has not
been weakened. On a freshly recreated `yellow_test`, Order 036's expanded availability
query has repeatedly returned the correct 500 options but exceeded the fixed 1,000 ms
ceiling (observed maxima: 1,770.39 ms, 1,239.68 ms, 1,241.90 ms, 1,486.75 ms, and
1,335.88 ms). Warm reruns have fallen as low as 28–33 ms, so warm-only green output is
not accepted as proof.

The cold investigation preserved the ceiling and captured the exact service-session
plan with PostgreSQL `auto_explain`. Missing statistics caused a one-row estimate and
a quadratic 521-space × 521-sellable-unit nested loop (about 1.09 million buffer hits),
not JIT or disk I/O. A materialized boundary around property-filtered sellable mappings
removed that plan; three fresh-database reruns passed unchanged at 60.96, 95.32, and
97.80 ms maximum. No edit to `tests/availability.integration.test.ts`, occupancy truth,
migrations, or the referee was made.

## Architect question

At the Phase 2 exit review, should P8 remain solely a fixed wall-clock assertion, or
should a later ordered correction pair a deliberately generous wall-clock ceiling with
an executable structural plan assertion (bounded rows/loops and the expected scan or
index shape)? The current 1,000 ms proof remains unchanged unless and until Fable issues
that order.

## Builder position

Use both: retain a generous regression ceiling for catastrophic slowdowns, and add a
structural plan proof that is stable across developer hardware and CI load. Do not use a
larger ceiling alone to make Order 036 green, and do not accept warmed-cache output as a
substitute for the cold proof.
