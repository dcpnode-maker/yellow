# Question 022 — Order 024 tenant-B property fixture

**Status:** CLOSED — see `022-ARCHITECT-RESPONSE.md` and D-105.

## RESOLVED

P3's tenant-B API write returned 400. Direct fixture inspection shows tenant B's
property is `00000000-0000-0000-0000-0000000000b1`; the test invented `...0022`.
recordFact correctly rejected the nonexistent audit property, and dependent P4/P5 then
had one fewer instance. May the fixture use the canonical property id and rerun all
Order 024 proofs from the top?

