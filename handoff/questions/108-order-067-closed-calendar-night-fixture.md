# Question 108 — Order 067 closed calendar night fixture

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 067

The first implemented focused run returned 6 pass / 1 fail. P3 asks for the closed calendar cell on
2026-03-10, but its default stay is property-local `[2026-03-08,2026-03-10)`, so production correctly
rejects that night before calendar evaluation. May only that assertion extend `stayEndInstant` to a
canonical instant on 2026-03-11 local time, keeping the closed cell, half-open rule and production
code unchanged, then restart all seven focused proofs?

## Answer

Yes. Change only the closed-cell assertion's stay end. Do not widen production night validation,
move the closed cell, make the end inclusive or weaken the expected `calendar_closed` result.
