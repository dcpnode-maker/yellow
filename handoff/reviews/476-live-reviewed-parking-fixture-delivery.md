# Order 476 — stopped before target delivery

Date: 2026-09-20 · Executor: Codex `/root`.

The reviewed source hashes matched exactly. The one permitted seed invocation exited
non-zero and was not retried. Its captured output was deliberately not persisted;
only the bounded result was retained: exit `1`, 39 output bytes, SHA-256
`C79D13B269318D7404994D29246E6E6672397FE7477F574A261A366B347B87D5`.

Source inspection immediately established the invocation precondition error:
`YELLOW_DEPLOY_DATABASE_URL` requires the exact login principal `yellow_deploy`;
`yellow_owner` is deliberately NOLOGIN. The failed attempt therefore could not
authenticate to, inspect, or mutate the target.

A subsequent target-bound `BEGIN TRANSACTION READ ONLY` postflight through the
runtime RLS boundary showed the fixed parking state unchanged: one in-house
reservation and zero primary guests, exact segment occupancies, open primary folios
and zero-balance primary folios. No retry, seed, DML, migration, restart, or other
target mutation followed.

Order476 is stopped. A new order must bind the reviewed deployment password to the
documented `yellow_deploy` principal and retain the one-attempt and independent
postflight requirements.
