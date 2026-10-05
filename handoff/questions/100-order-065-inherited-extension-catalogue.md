# Question 100 — Order 065 inherited extension-catalogue proof

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 065  
**Observed during preflight:** `tests/extension.integration.test.ts` has an intentional exact
default-test assertion that the launch registry contains six types and thirty instances. Order 065
adds exactly two types and ten platform instances, so the inherited test will correctly become red.
The file is not currently in Scope.

May Scope add only `tests/extension.integration.test.ts`, changing its catalogue description and
exact expected totals from 6/30 to 8/40 while retaining validation of every launch instance against
its registered schema?

## Answer

Yes. Preserve exact equality and the per-instance validation. Do not derive expected counts from the
arrays inside that assertion, because it is intended to detect accidental catalogue growth or loss.
Run the inherited file after the focused Order 065 proof.

