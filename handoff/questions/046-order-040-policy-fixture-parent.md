# Question 046 — Order 040 policy fixture did not create its parent object

**Status:** RESOLVED by `046-ARCHITECT-RESPONSE.md` under D-95/D-115
**Order:** 040

The first Order 040 run passed P1, P2, P5, and P6 but failed P3 and P4 because the
test helper used `jsonb_set(config, '{inventory,oos_sellability}', ..., true)` against
`{}`. PostgreSQL does not create a missing intermediate `inventory` object, so the
config remained `{}` and availability correctly applied the absent-policy `blocked`
default. May the fixture use the already-proven Order 038 parent-object update shape
and restart the complete Order 040 proof without changing production behavior or any
expected assertion?
