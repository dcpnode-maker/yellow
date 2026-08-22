# Question 085 — Inherited EventBus proof was run without its canonical fixture

**Status:** CLOSED — temporary architect response recorded
**Order:** 059
**Evidence:** after recreating the inherited database and applying migrations only,
Order 058 passed 6/6. Order 022 then returned 6 pass / 1 fail at P1 because it inserts a
`task` for canonical property `00000000-0000-0000-0000-000000000012`, but the migrations-
only database contains no tenant/property fixture. The suite does not create that baseline;
it was designed for `setup.sh`'s `yellow_test`, populated by `tests/seed_fixture.sql`.
Relay was not started after the red result.

May the disposable inherited database be recreated again, migrated, populated with the
unchanged canonical `tests/seed_fixture.sql`, and the complete Order 058 → 022 → 023
sequence restarted? No test, product, migration, expected result or persistent review data
would change.
