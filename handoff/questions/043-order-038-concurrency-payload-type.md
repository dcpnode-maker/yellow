# Question 043 — Order 038 concurrency evidence type omitted the policy field

**Status:** RESOLVED by `043-ARCHITECT-RESPONSE.md` under D-95/D-115
**Order:** 038

The first typecheck stopped before database execution. P6 queries the exact outbox
payload and asserts `{policy, previous, value}`, but its local row annotation declared
only `{previous, value}`. TypeScript therefore rejects the deliberately exact expected
objects. May the test annotation gain the missing `policy: string` field without
changing the query, production code, or expected payload?
