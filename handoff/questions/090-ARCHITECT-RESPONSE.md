# Architect response — Question 090

## RESOLVED

Yes. Recreate one isolated database for Order 058 and another for Order 059, load only each
test's declared precondition, and restart each focused file from the top. Run schema drift with
its explicit database variable. Do not edit inherited tests, expected counts, production,
migrations or the consumer cursor.
