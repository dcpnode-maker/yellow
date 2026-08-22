# Question 103 — Order 065 seed literal helper

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 065  
**Observed:** after Question 102 switched to frozen production seed constants, TypeScript inferred
the `envelope()` default tenant parameter as the exact canonical UUID literal and rejected the
required tenant-B call.

May the test helper annotate its tenant, property and actor parameters as `string`, retaining the
same defaults and all foreign-tenant inputs, then restart typecheck?

## Answer

Yes. This is a test-helper boundary only. Do not cast the tenant-B call or widen production seed
constants.

