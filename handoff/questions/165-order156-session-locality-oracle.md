# Question 165 — Order 156 cannot observe tenant-GUC locality before mutation

**Status:** RESOLVED — D-421 applies the existing D-395/D-402 settlement model
**Order:** 156
**Raised by:** independent pre-implementation audit
**Date:** 2026-08-25

## Stop

Order 156 required its SECURITY DEFINER capability to reject session-scoped role or
tenant authority before mutation. PostgreSQL exposes the effective role and custom-GUC
value, but it does not expose whether an identical current value was established with
transaction-local `SET LOCAL`/`set_config(...,true)` or session-scoped
`SET ROLE`/`set_config(...,false)`. D-402 already records this exact same-value custom
GUC impossibility. No implementation edit was made before the stop.

## Resolution

The capability must verify the exact effective runtime-to-app-role and matching tenant
values it can observe. The existing extension transaction wrapper must then apply the
D-395/D-402 containment boundary: reset role, scrub any session tenant baseline before
settlement, verify exact runtime role and null tenant on the still-reserved unprepared
backend after commit or rollback, and release only after successful settlement. A
hostile same-value session-scoped tenant canary must prove no state reaches the next
request. Any rollback, commit, scrub, discard or recheck failure remains fail-closed.

This does not authorize a new role, token, authority mechanism, SQL interceptor,
backend terminator, pool interface or broader source path.

## RESOLVED

Resolved by D-421 using the already-approved D-395/D-402 settlement model.
