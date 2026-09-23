# Question 101 — Order 065 compiler narrowing

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 065
**Observed:** the first implemented `tsc --noEmit` stopped before database proof. Optional row
access leaves the derived extension version typed `number | undefined`; `Number.isInteger()`
does not narrow that union. Two Bun `toEqual` overloads also reject a readonly tuple as the
expected value for newly allocated mutable arrays.

May the correction add an explicit `version === undefined` guard and compare those two mapped
arrays with mutable `[...EXPECTED_KEYS]` copies, then restart typecheck from the top?

## Answer

Yes. Change only those three compile boundaries. Do not assert, cast or widen the production
version, and do not weaken exact catalogue equality.
