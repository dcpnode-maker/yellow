# Question 161 — Order 150 extension-type residual authority

**Status:** RESOLVED — D-417
**Order:** 150
**Raised by:** independent pre-implementation reviewer
**Date:** 2026-08-25

## Stop

`src/kernel/extension.ts` has a current authenticated platform-scoped command that
inserts `(type, json_schema)` into global `extension_type` under app_role. D-415
requires global/tenantless contraction and also requires every current production
caller to remain executable, while Scope forbids moving this caller to a new
capability. Revoking all extension-type mutation would silently break P2.

## Resolution

Retain only exact app-role `INSERT (type, json_schema)` on `extension_type` as named
residual command-capability debt. Revoke UPDATE, DELETE, TRUNCATE and any other
column/operation; require the existing platform scope, tenant-bound audit and
compatibility protections to pass through `tests/extension.integration.test.ts`.
The future approval/extension command-capability order must migrate and then revoke
this direct global insert. This exception does not authorize any other global or
tenantless runtime DML.

## RESOLVED

Resolved by D-417's exact residual authority ruling.
