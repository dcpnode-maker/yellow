# Question 021 — JTI regression fixture constant

**Status:** CLOSED — see `021-ARCHITECT-RESPONSE.md` and D-104.

## RESOLVED

The D-103 regression run stopped with `ReferenceError: TENANT_A is not defined` because
the new assertion used a name from the extension test instead of this file's existing
`TENANT_ID`. May the fixture reference be corrected without changing the assertion?

