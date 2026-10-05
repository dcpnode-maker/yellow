# Question 109 — Order 067 derived-context authenticity

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 067

Post-green source readback found that `evaluateRateModel()` checked the context object and arrays
were frozen but did not prove its derived `nightDowMask`, `bookingWindowDays` and `losNights` still
matched the canonical instants/timezone. May the evaluator rebuild the context from its raw inputs,
compare every derived field, reject a frozen forged copy, and add that exact canary before rerunning
the focused proof?

## Answer

Yes. A JavaScript freeze is immutability, not provenance. Re-derive from canonical UTC instants,
night date and IANA timezone; compare the derived date/DOW/window/LOS fields; preserve optional
occupancy/reference/target evidence through their existing validators. Do not accept caller-supplied
derived values as authority or change any pricing rule.
