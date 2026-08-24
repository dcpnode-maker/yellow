# Question 135 — Order 099 inherited hold permission assertion

Order 099 re-executes the approved Order 055 hold HTTP suite as inherited evidence. Its
six live hold/occupancy/replay/rollback cases pass, but P7 still asserts the exact
seventeen-scope `Local Availability Reviewer` role from Order 055. Orders 096–098
subsequently and independently approved six reservation guest, lifecycle and segment
permissions on that same canonical role, so P7 now fails solely because those valid
additional scopes are present.

Order 099 forbids seed and out-of-scope test changes. May a later corrective order update
`tests/operator-holds.integration.test.ts` to assert the currently approved additive role
contract while retaining all original hold permissions and browser-authority checks?
Order 099 will not silently widen scope; its hold evidence records P1–P6 as green and the
stale inherited P7 discrepancy explicitly.

## Answer

Yes. Order 100 performed the test-only correction after an intentional fresh-database
red. The exact equality now requires all original seventeen inventory/rate permissions
plus the six independently approved guest/lifecycle/segment permissions. All seven
Order 055 cases pass without production, seed, role or permission changes.

## RESOLVED

Resolved by Order 100 and its recorded 7/7 fresh PostgreSQL proof; no product authority
or runtime permission changed.
