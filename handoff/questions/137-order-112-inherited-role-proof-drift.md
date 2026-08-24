# Question 137 — Order 112 inherited exact-role proof drift

## RESOLVED — CODEX PRIMARY IMPLEMENTATION OWNER

## Trigger

After Order 112's focused two-actor proof passed, the complete inherited
`operator-inventory` file reached its final assertion and failed 6 pass / 1 fail.
The production login carried the canonical 25 sorted permissions independently proven
through Orders 096–102, while this Order-048-era assertion still required the 17 scopes
that existed before reservation guest/lifecycle/segment and Party authority shipped.
Repository search found the same stale exact literal in four sibling operator files.

## Question

May Order 112 include only those five same-purpose exact-role assertions and update
their labels/literals to the already canonical 25-scope set, without changing seed,
permissions, token logic, route authority or any product behavior?

## Answer

Yes. This is executable-proof maintenance required to make Order 112 P3 honest, not a
permission decision. Add the four sibling test files to Scope; `operator-inventory`
is already in Scope. Replace only the stale exact 17-scope labels/literals with the
same exact 25-scope sorted set already asserted by `review-seed.integration.test.ts`.
Do not export a shared expected value from production/seed code: independent exact
literals remain the stronger drift detector. Restart each affected complete proof on
fresh PostgreSQL where its fixture requires freshness.

## Rejected

- weakening exact equality to subset membership;
- deleting newly approved permissions or editing the seed to satisfy old assertions;
- claiming P3 green while silently skipping stale files;
- combining any production permission/role behavior with this correction.
