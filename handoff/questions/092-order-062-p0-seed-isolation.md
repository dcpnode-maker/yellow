# Question 092 — Order 062 P0 seed isolation

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 062  
**Observed:** the first focused P0 run returned `0 pass / 2 fail` before reaching the
missing offline-lease route. `runSeed()` rejected `Extension instance seed collision for
vertical_profile/hotel` because `setup.sh --db-only` had already loaded the invariant fixture
into `yellow_test`; `afterAll` then attempted to close services never initialized.

Does P0 permit recreating `yellow_test`, applying migrations 0001–0005 only through the
production migration runner, and changing only the focused file's cleanup handles to optional
close before restarting the same assertions from the top?

## Answer

Yes. Order 062 pre-registers a fresh 0001–0005 database, not the referee's populated fixture.
The first run proved a harness precondition error, not missing product behavior. Recreate the
disposable database, run only `scripts/migrate.ts`, make `afterAll` tolerate an aborted
`beforeAll`, and restart P0 unchanged. Do not call this first run the required red proof and do
not alter any production file or behavioral assertion.

