# Question 114 — Order 068 inherited unpriced reason literal

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 068

After the normalized-input repair, thirteen of fourteen combined Order 067/068 proofs passed. P6
expected `rate:gate_ineligible`, but the canonical Order 067 result is exactly
`reason: gate_unmatched`; composition correctly prefixed and propagated it as
`rate:gate_unmatched`. May the test expectation change to that existing literal?

## Answer

Yes. Change the expected literal only. Do not rename Order 067 output or translate reasons in the
composer. Restart typecheck and both complete focused files.
