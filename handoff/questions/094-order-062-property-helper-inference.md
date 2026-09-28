# Question 094 — Order 062 property helper inference

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 062  
**Observed:** the first implemented typecheck stopped with TS2345 at the place/release helpers
because `leasePath(property = SEED_PROPERTY.id)` inferred the canonical UUID string literal as
the parameter type, rejecting the pre-registered foreign-property string.

May the focused proof annotate only `leasePath(property: string = SEED_PROPERTY.id)` and restart
the compiler from the top?

## Answer

Yes. This is a test-helper type correction that enables the exact foreign-property proof. It
does not change runtime behavior or an expected result. Add only the `string` annotation and
restart typecheck before any focused database run.

