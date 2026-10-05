# Question 039 — Order 030 TTL proof crosses skewed clocks

The standing gate showed PostgreSQL and Bun host clocks differ by about twelve seconds,
making a `Date.now()` comparison invalid. May P1 measure remaining TTL entirely inside
PostgreSQL and require `0 < remaining <= 120` seconds?

## RESOLVED

Answered by D-128 and `039-ARCHITECT-RESPONSE.md`.
