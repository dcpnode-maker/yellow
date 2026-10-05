# Question 138 — Order 108 inherited review-role scope proof drift

**Order:** 108 — SECURITY DEFINER shadow-path containment
**Status:** RESOLVED by D-336 before cumulative green proof

## Discrepancy

The cumulative gate's Order-048 inventory suite fails only because it still asserts
the historical seventeen-scope review login. Current `seed-review` and its own exact
proof correctly contain twenty-seven approved scopes after the independently reviewed
Party, reservation-lifecycle and folio/charge operator orders. Three sibling operator
tests retain the same stale literal, while the OOS-policy suite already proves the
correct list but retains the stale display label. The runtime token contains the
current canonical twenty-seven scopes; Order 108 changes no permission or token behavior.

## Resolution

Order 108 may update only the display labels and exact expected scope strings in the
five inherited operator tests named in its amended Scope. Each changed literal must
match the already-proven current review seed exactly. This repairs evidence drift; it must not
change seed data, permissions, roles, login/token code, adapters, production assets or
authorization behavior. The cumulative gate must then exercise the affected suites.

## RESOLVED

D-336 authorized only the stale proof-label/literal correction. The corrected
twenty-seven-scope proofs ran in the current-line cumulative gate without runtime
permission, seed, role, token or adapter changes.
