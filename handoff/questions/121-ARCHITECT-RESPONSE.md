# Architect response 121 — Order 071 authenticated actor narrowing

## ANSWERED — TEMPORARY ARCHITECT

YES. Return `{ actorId }` only after `hasScope()` and the exact property grant both pass. Thread
that proven actor id explicitly into the idempotent command callback and every server-built audit
envelope. Do not cast the tenant identity, use a non-null assertion, weaken the compiler, duplicate
authorization in the browser, or accept actor id from the request body. Restart typecheck from the
top before any focused execution.

