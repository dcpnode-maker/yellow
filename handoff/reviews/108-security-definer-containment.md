# Independent review — Order 108 SECURITY DEFINER containment

**Result:** APPROVED

**Reviewed executable SHA:** `ee4ec0c48d7ebb62328454f2df3c22ed665108a7`

**Hostile parent SHA:** `5876f672d690a28af74bee04c0adcc5486618a4f`

**Reviewer:** Claude, independent non-implementing reviewer

**Recorded by:** Codex from the founder-provided Claude review result; this file does
not represent Codex self-review

**Date:** 2026-08-24

The reviewer used an isolated Git worktree and a separate Docker Compose project and
did not modify the live Yellow containers or implementation branch. The disposable
review environment was removed afterward.

The reviewer directly inspected migration 0011 against the original definitions in
migrations 0001, 0003 and 0010. All six required signatures—`record_occupancy`,
`release_occupancy`, `expire_holds`, `prune_outbox`, `assert_day_open` and
`seal_business_day`—use exact function-level
`search_path = pg_catalog, public, pg_temp`; every Yellow relation and helper call is
`public.`-qualified. Signatures, return types and business behavior are preserved
apart from the required resolution containment and `prune_outbox` negative-retention
`22023` guard. `PUBLIC` and `app_role` lose all six inherited execution grants, while
`app_role` regains only record, release and seal. The reviewer also confirmed the
owner-only outbox-pruning caller does not assume the revoked app-role grant.

On the exact parent, the reviewer manually reproduced P0 through `psql`: hostile
`pg_temp.outbox` and `pg_temp.business_day` triggers executed with deployment-owner
authority when invoked through `prune_outbox` and `seal_business_day`, even though
direct app-role insertion into the protected probe was denied. On the reviewed SHA,
the identical attack no longer writes an owner-authority marker and the focused suite
passes **3/3 with 21 assertions**, including exact paths, ACLs, retained occupancy,
outbox, day-open/seal behavior and rollback/tenant boundaries.

The reviewer personally executed these supporting proofs:

- pristine `./setup.sh --db-only`: exact 85-table schema, RLS **75/75**, invariant
  referee **11 passed, 0 failed of 11**;
- `tsc --noEmit`, 63-file import boundaries and normalized schema drift: green/exact;
- protected SHA-256 values: migration 0001
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`
  and referee
  `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`;
- the fifteen-suite cumulative runner twice. Fourteen suites passed each run,
  including the restored financial-postings proof and Order 108 hostile proof. The
  inherited Order-069 `rate-publication` P8 cold timing assertion alone exceeded its
  15-second host budget at approximately 15.8–15.9 seconds while two full Docker
  stacks contended. It touches no Order 108 path and is disclosed as a separate
  performance-flake debt, not silently called green or treated as an Order 108 defect.

No Order 108 findings. Approval is exclusive to the six-function temporary-schema
containment, exact execution ACLs, negative-prune validation and cumulative-proof
lineage repairs at the reviewed executable SHA. It does not approve or fix
caller-supplied tenant authority, runtime superuser/owner/BYPASSRLS connections,
`RESET ROLE` pools, the known/default JWT secret, actor-unbound idempotency, FORCE RLS
deployment proof, token-secret entropy, or any financial Order 109+ behavior.

## Exclusive Order 108 discharge

- 108

