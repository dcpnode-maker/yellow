# Question 017 — Order 023 P5 proof isolation

**Status:** CLOSED — see `017-ARCHITECT-RESPONSE.md` and D-100.

## RESOLVED

## Stop condition

Order 023's pre-registered P5 assertion ran and failed, so D-92 stops the phase.

The two same-name relay instances produced no duplicate consumer effect. The test
expected exactly the 40 rows created for P5 but observed 42 distinct ids. The two
extra ids were pending rows intentionally left by P4: P4 inserted eight load rows,
then stopped after six one-row polls. Because the outbox is a global pending queue,
P5 correctly delivered those two rows before its own 40.

## Question

May the P4 fixture insert five load rows instead of eight? Six poll starts still
measure five loaded intervals, all P4 requirements remain executable, and the load
test leaves no pending row for P5. No production code or assertion is weakened.
