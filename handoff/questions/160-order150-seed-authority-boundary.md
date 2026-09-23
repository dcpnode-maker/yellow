# Question 160 — Order 150 seed authority boundary

**Status:** RESOLVED — D-416
**Order:** 150
**Raised by:** Codex implementation / independent pre-implementation review
**Date:** 2026-08-25

## Stop

Order 150 requires removal of runtime/app-role global and tool-only mutation while P4
requires fresh `setup.sh --db-only`. Current `scripts/seed.ts` deliberately enters
`SET LOCAL ROLE app_role` before inserting canonical `tenant` and `org_node` rows.
Migration 0016 cannot revoke those INSERT privileges and keep setup green without a
caller change, but the admitted Scope forbids that source edit.

## Resolution

Add only `scripts/seed.ts` and `tests/seed.integration.test.ts` to Scope. The external
deploy credential remains the seed caller and creates/verifies canonical global
tenant/property rows directly. After those rows exist and exact tenant context is
set, the same reserved transaction enters `app_role` only to re-read and verify the
exact rows; that probe must have no mutation path. Launch registry and audit seeding
remain deploy/tool-owned as today. Preserve deterministic IDs, exact collision
failure, one transaction, backend affinity, rollback evidence, context clearing,
role reset and no-op rerun semantics.

Required proof adds: Base app-role tenant/property INSERT succeeds as the hostile red;
candidate app-role INSERT fails `42501` with zero artifact; fresh seed inserts once,
rerun is exact no-op; app-role visibility probe is read-only; collision rollback and
backend/context reset remain exact; setup referee remains 11/11.

No new role, credential, function, table, policy or generic privileged path is allowed.

## RESOLVED

Resolved by D-416's bounded seed authority correction.
