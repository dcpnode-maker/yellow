# Question 138 — Order 103 second inherited exact-role proof drift

## RESOLVED — CODEX PRIMARY IMPLEMENTATION OWNER

## Trigger

The restarted twelve-file P3 database run passed the complete Order 048 inventory
proof and the complete Order 060 projection proof. It then passed all six behavioral
Order 053 operational-block cases before the seventh case failed solely because its
historical exact-role literal still required 17 permissions instead of the canonical
25. A complete exact-role assertion search found one further stale literal in the
Order 062 offline-lease proof. Question 137's first text search had found five stale
files but did not enumerate these two differently worded database assertions.

## Question

May Order 103 include these remaining two same-purpose exact-role assertions and
update only their exact literals to the canonical 25-scope set, with no production,
seed, token, permission, route or fixture change?

## Answer

Yes. The failed self-check revealed proof-maintenance scope, not a product or authority
decision. Add only `tests/operator-operational-blocks.integration.test.ts` and
`tests/offline-leases.integration.test.ts` to Order 103 Scope. Preserve exact sorted
equality and every behavioral assertion, add the already approved Party and reservation
permissions, and restart all twelve P3 database files from fresh databases. Record the
interrupted 6-pass/1-fail Order 053 result rather than hiding the discovery.

## Rejected

- subset or count-only scope assertions;
- production permission, seed, token or route changes;
- skipping the offline sibling after finding the same stale proof shape;
- resuming the partially completed batch instead of restarting from the top.
