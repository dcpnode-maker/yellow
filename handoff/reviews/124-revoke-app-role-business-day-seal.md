# Order 124 independent Tier-3 review — application-role day-seal authority

**Verdict:** APPROVED

**Risk tier:** 3

**Reviewer:** independent non-implementing OpenAI Codex reviewer

**Exact approved base:** `932c570f219a3020eb48bb2e269b75a57eb13e2e`

**Exact parent red:** `fa234482db4c396c2cd1e3f262f9d25ed3820f01`

**Exact security/product executable reviewed:** `b93574d3d9f2b5d5712173dfe7c160088a457521`

**Builder metadata head received:** `8d95c834df4cbaf72b079f69d0b6f0e58269db2b`

**Review branch:** `phase-5/review-order-124`

This approval discharges only sealed Cyber occurrence
`occ_0c5b4cfc4934049849c99d8f`. It does not approve deployment-owner database use as
runtime architecture, close occupancy caller-tenant binding, implement continuous
day close, close any sibling occurrence, integrate a canonical branch, push, deploy,
or claim live status.

## Findings

No implementation, migration, scope, security, product-status, or provenance finding.

The native-Windows migration run is not recorded as wholly green: it passed 16/17 and
reproduced the disclosed host `EPERM` while creating the suite's temporary symlink.
The same exact executable passed the complete Linux/WSL migration suite 17/17. The
Windows-mounted cumulative matrix did not reproduce the disclosed Order-069 timing
stop in this run: P8 passed in 14.20485 seconds against its 15-second ceiling. Earlier
16–25-second results remain honestly classified as host-sensitive stops, not green
results and not Order-124 regressions.

## Provenance and scope

- `9f97bd0c7301259f1242003b3e84bf674d238eee` is an ancestor of exact approved base
  `932c570f`. The complete tree delta is only the newly admitted Order-124 order file;
  commit `802eb20` drafts it and `932c570` records its approved-integration admission.
  There is no executable, migration, application, test, schema, or configuration delta.
- `fa234482` is the direct child of `932c570f` and adds only the focused parent-red
  proof. `b93574d3` is the direct child of `fa234482` and contains the scoped migration,
  proofs, documentation, schema ACL snapshot, matrix mapping, and mechanical future
  finance migration reservations.
- The executable diff adds no production `src/` call, route, service, worker,
  scheduler, role, credential, membership, table, RLS policy, event, or alternate day
  close authority. Migration 0013 contains only the exact `REVOKE EXECUTE ON FUNCTION
  public.seal_business_day(uuid,uuid,date,uuid) FROM app_role`; PostgreSQL raises
  `42883` if that exact function is absent.
- Metadata head `8d95c834` is not treated as governance-only. Besides D-360, ledger,
  order status and builder evidence, it deliberately changes the runtime project
  snapshot and founder-status assertions from built/current Order 123 to 124. That
  product-status change is expressly in Order 124 scope after green gates, leaves
  independent review coverage at Order 91 and state `built_unverified`, and passed
  its exact-head founder-status proof 7/7 with 82 assertions. It adds no security or
  finance authority and makes no integrated, deployed, or live claim.

`git diff --check fa234482..b93574d3` passed. Migrations 0001–0012 and protected files
are unchanged. The only schema snapshot delta is removal of the existing
`GRANT ALL ... seal_business_day ... TO app_role` line. The finance draft changes are
mechanical 0013–0018 to 0014–0019 reservation shifts and preserve their semantics.

## Reviewer-executed Tier-3 proof

All database execution used uniquely named disposable review clusters/databases and
exact detached worktrees. No builder database, canonical branch, phase-c stack,
Order-118 stack, remote, deployment, or live service was changed.

### Exact-parent red

On fresh PostgreSQL at exact `fa234482`, migrations 0001–0012 applied and the focused
proof failed intentionally at 0/1. Its received state was exact:

- PUBLIC seal execution: `false`;
- negative prune: SQLSTATE `22023`;
- mismatched-tenant application seal: SQLSTATE `42501`;
- `app_role` seal execution: `true`;
- same-tenant application seal: succeeded;
- the day was sealed with caller-selected actor
  `00000000-0000-0000-0000-000000012421`.

This is the required narrow red: Order-108 PUBLIC/prune containment and tenant mismatch
remained green while the one residual application authority was executable.

### Exact ACL, migration, and containment

On fresh PostgreSQL at exact `b93574d3`, migrations 0001–0013 applied. Focused
authority passed 3/3 with 6 assertions. It proved exact version-13 filename/checksum
`75aef629ebc90a7c2ba3dcf94532295cfce57fc521197d7b5cdc6b6d5a1bf712`, PUBLIC and
`app_role` denial, owner execution, SECURITY DEFINER retention, safe search path,
same- and foreign-tenant application SQLSTATE `42501`, no seal mutation, and owner-only
one-way latch behavior including repeat/missing-day `P0012` failures.

Direct parent/fixed catalogue snapshots were compared. Both contain 85 public tables,
75 RLS tables, 75 policies, 16 roles, and 3 memberships. All six public SECURITY
DEFINER functions retain owner `yellow`, owner execution, PUBLIC denial, and exact
`search_path=pg_catalog, public, pg_temp`. Body MD5 values are identical on both sides:

- `assert_day_open()` — `e21925ef91c1edccaeb043b059a732e0`
- `expire_holds()` — `2276d323bb37f839824de5ca17172976`
- `prune_outbox(interval)` — `d816a6e8156ef5007853989451e336c0`
- `record_occupancy(...)` — `f6e06d3cd2f81b0bf0fd25b719dc8c04`
- `release_occupancy(uuid,uuid)` — `7a0516093bbedabfcda93023d5671c1b`
- `seal_business_day(uuid,uuid,date,uuid)` — `544ef717ce224e2a868e2f04f1fdfa49`

The only catalogue privilege delta is seal `app_role` execution `true` to `false`;
the occupancy siblings remain app-executable and the other three siblings remain
app-denied. Parent and fixed fresh databases each matched their committed schema
snapshot exactly.

### Cumulative, finance, migration, and standing gates

- exact 18-suite mapping/orchestrator: 6/6, 137 assertions;
- complete exact-executable isolated database matrix: 18/18 from suite one;
- financial postings: 10/10, 111 assertions, including the owner seal/charge lock,
  sealed-day denial, cross-tenant denial, and 500-charge balance proof;
- SECURITY DEFINER containment: 3/3, 22 assertions;
- app-role nonlogin: 5/5, 25 assertions;
- actor-bound idempotency: 5/5, 54 assertions;
- Linux/WSL migration suite: 17/17, 95 assertions;
- native-Windows migration suite: 16/17, 93 assertions, with the sole pre-database
  symlink fixture `EPERM` reproduced exactly;
- fresh deployment acceptance: 6/6, 13 assertions;
- Order 053: 7/7, 42 assertions, including the exact sorted 27-scope fixture;
- native-WSL standing suite: 171 passed, 411 skipped, 0 failed, 1,971 assertions;
- frozen install: 23 packages with no lockfile change; TypeScript clean; import
  boundaries clean across 64 files; installed-tree licence policy 23; dependency audit
  found no vulnerabilities;
- exact schema drift passed; protected SHA-256 values remain
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923` for
  `migrations/0001_init.sql` and
  `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1` for
  `tests/run_invariants.py`.

An initial standing run from the Windows-mounted WSL worktree is not represented as
green: the 5-second filesystem boundary walk timed out and `git show` could not follow
the Windows-format worktree gitdir. A fresh native-WSL exact worktree removed those
host-path artifacts and passed the complete standing suite above.

### Pristine referee and runtime health

Separate Compose project `yellow-review124-referee` used the exact digest-pinned images,
applied migrations 0001–0013 from pristine state, seeded fresh development/test
databases, retained 85 public tables, and personally returned:

```text
RESULT: 11 passed, 0 failed of 11
```

Its exact-SHA app, PostgreSQL 16.15, and Valkey containers were all healthy. The app
returned exact `200 {"status":"ok"}` with the required same-origin security headers.

## Conclusion

Order 124 is APPROVED at exact security/product executable
`b93574d3d9f2b5d5712173dfe7c160088a457521`, with builder metadata head
`8d95c834df4cbaf72b079f69d0b6f0e58269db2b`. Only occurrence
`occ_0c5b4cfc4934049849c99d8f` is discharged. Deployment-owner runtime authority,
occupancy tenant binding, the future audited day-close command, and all sibling Cyber
occurrences remain open. No merge, push, deployment, phase-c mutation, or live-status
claim is implied.
