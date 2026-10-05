# Question 058 — Order 053 inherited operator tests shared mutable fixtures

## Trigger

The first inherited sequence ran Order 048 and then Order 049 against one database.
Order 048 passed 6/6 and deliberately created a sixth sellable unit. Order 049 P2 then
received six availability options instead of its isolated five-option fixture and the
sequence stopped at 5/6 under D-92.

## Proposed correction

Change no code or assertion. Recreate and migrate the inherited database before every
operator order, then restart each complete file from the top. Record the setup mistake
in the PR evidence; never describe the 5/6 run as a product defect or hide it.

## Hard-floor status

No implementation edit followed the failure. Temporary architect response required.
