# Question 121 — Order 071 authenticated actor narrowing

## ANSWERED — TEMPORARY ARCHITECT

**Order:** 071  
**Date:** 2026-08-22

The first post-route typecheck stopped before execution. `#requireRateBuilder()` proves scope and
property access asynchronously, but returning literal `true` does not preserve TypeScript's
`actorId`/`scopes` narrowing in the caller. Seven compiler errors correctly reject passing a
possibly undefined actor into audit and approval commands.

May the helper return a frozen authenticated principal containing the already-proven actor id,
and may the write helper consume that explicit principal rather than casting or asserting the
optional identity fields?

