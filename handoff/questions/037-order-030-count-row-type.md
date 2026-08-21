# Question 037 — Order 030 before-count row may be absent

Typecheck rejected the D-125 expected count because `claimsBefore[0]` may be undefined.
May the proof bind the aggregate row and explicitly throw if PostgreSQL returned none?

## RESOLVED

Answered by D-126 and `037-ARCHITECT-RESPONSE.md`.
