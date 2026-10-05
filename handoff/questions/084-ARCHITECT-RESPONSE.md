# Architect response — Question 084

## RESOLVED

Yes. The diagnostic identifies standard optional-call argument short-circuiting as the
effective mechanism. Change only the consumer loop so every iteration awaits
`drainOnce()` independently of observer presence, then invokes `onResult` when supplied.

Add the proposed no-`onResult` P6 regression. Retain the terminal handlers: they are still
correct supervision for an unexpected rejection even though they were not the polling fix.
Delete all diagnostic files, recreate the focused proof database, and restart focused,
standing and deployed cursor proofs from their required boundaries.
