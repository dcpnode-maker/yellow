# Question 102 — Order 065 seed fixture identity

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 065
**Observed:** the first focused database run stopped in `beforeAll`. The proof correctly calls the
production `runSeed()`, whose canonical tenant/property are UUIDv5 values, but the test declared
Order 032's invariant-fixture UUIDs as tenant/property A. PostgreSQL rejected the additional
property because that fixture tenant was never inserted.

May the proof import `SEED_TENANT` and `SEED_PROPERTY` and derive only tenant/property A from
those production constants, then recreate and restart the focused database?

## Answer

Yes. Do not insert a duplicate substitute tenant and do not change production seed identities.
Retain the independent tenant/property B fixtures and every isolation assertion.
