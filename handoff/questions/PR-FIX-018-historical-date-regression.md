# PR-FIX-018 - Complete an incomplete test-fixture backport (PR97)

## RESOLVED

PR-FIX-016 intended the three exact public PR86 fixture hunks. The local backport
retained a launch-time predicate inside a fixed-date historical test. Complete
that query to match ac58c91ce2a971a8e2c670edffeed3803417b0b2 and add an explicit
regression guard under this narrow order. This grants no production date or
eligibility relaxation and no licence-policy exception.
