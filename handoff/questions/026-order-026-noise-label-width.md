# Question 026 — 100,000-row ltree label width

**Status:** CLOSED — see `026-ARCHITECT-RESPONSE.md` and D-109.

## RESOLVED

The 100,000-row setup failed atomically with unique key 23505 because
`lpad(value::text, 5, '0')` truncates 100000 to `10000`, colliding with row 10000.
May the synthetic label width become six digits and the full proof restart?

