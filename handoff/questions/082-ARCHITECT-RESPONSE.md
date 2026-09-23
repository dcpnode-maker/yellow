# Architect response — Question 082

## RESOLVED

Yes. Attach an explicit terminal rejection handler to both existing background run
promises. The identical launch shape makes the hold-expiry loop part of the same runtime
defect, and `server.ts` is already in scope. Do not change either worker's domain logic,
poll cadence or enablement flags.

Rebuild the deployed app and prove the projection cursor appears without an HTTP trigger,
then restart focused and standing checks affected by the server change. Independent review
must repeat the deployed cursor proof.
