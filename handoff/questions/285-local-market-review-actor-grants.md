# Q285 — existing local review actor market permissions

Order460, 13 September2026. Root read-only native serving inspection confirms
frontier91 and active yellow-demo tenant6d9b7ce2-2d14-5576-b8c3-80f06501a603,
actor9f90d3e9-94f9-54de-95ec-35bd00b99b15 and existing role
05802175-9b05-5a8d-8596-bccfbe36e99f (Local Availability Reviewer).
That role has exactly three memberships, all for this actor and these existing
property scopes:4518a22f-b455-54c6-a50a-4584383749b9,
53d37060-da1e-5144-b5a2-fc24b4182ede,99fad159-d6fe-5cbe-a7f1-6dd5c98bd0c4.
No distribution.market permission is granted. Global metadata registration alone
therefore cannot make the workbench usable. No credentials or private user fields
were printed and no database writes occurred during this inspection.

The founder requested all built features be usable in the one local review app.
Admit source-only preparation of a minimal local-role grant, not a product RBAC
change, broad role grant, new actor, seed rerun or permission bypass. Owner
/root/q258_source_adapter may edit exactly these new ignored files:

- .yellow/evidence/order460/market92-local-review-grant.ts
- .yellow/evidence/order460/market92-local-review-grant.test.ts
- .yellow/evidence/order460/market92-local-review-grant-native.test.ts

The inert helper takes a caller-owned transaction. Before inserting only the two
already defined distribution.market:read/write role_permission pairs, lock and
verify the exact active tenant/actor/role and entire three-membership set, including
the exact existing property nodes. Refuse unknown/additional membership, stale or
inactive identity and mismatching permission descriptions. Prevent membership
phantoms during verification/commit with a bounded transaction-owned lock. Preserve
all existing permissions, users, role grants, hotel rows, extension instances and
global roles. Idempotence returns added/existing evidence; any error rolls back
the caller transaction. Compose after accepted metadata registration, within the
same eventual transaction. No implicit connection, credential read or action.

Focused synthetic tests and an opt-in real native proof harness are in scope;
actual native execution needs root admission after independent source inspection.
Reuse the existing Q265 database only, never serving or a new cluster. Prefer one
transaction-owned synthetic schema with fixed fixture identities and exact SQL
qualifier adaptation; do not weaken production identity checks for tests. Test
added/existing, wrong actor/role/tenant, inactive identity, unexpected membership,
missing/mismatched permission, rollback and concurrent membership protection.
Verify public metadata and global roles unchanged and remove only proved-owned
synthetic objects. No worker database/process/runtime/Git action is admitted.

Root independently inspects and personally executes proof, owns the eventual
registry/grant full-preservation action admission and records. Current41415/91
stays running until the whole recovery/activation plan is ready. All18 phases,
preserved fiscal and dependency-gated11→13→17 remain unchanged.

Root action admission: after complete independent source inspection and focused
synthetic10pass/3explicit native skips/0fail/57, run the opt-in native proof once
against the existing Q265 database only. Frozen helperf30e0a07, unitc420926e,
native49ccf8f5. Relation-prefix and66-byte synthetic identifier defects were found
before connection; final prefix is within PostgreSQL's63-byte bound and checked
before DDL. Exact native PG13580/55503/start and tool hashes precede protected
authority loading. The only DDL/DML is in one proved-owned UUID schema, removed
non-CASCADE by the test; public market metadata/global-role fingerprint must
remain unchanged. Root separately checks zero residual owned schemas. This does
not admit serving registration, live role grants, migration or runtime change.

First actual native proof failed1pass/1fail/5 before its intended rollback:
Bun serialized interpolated arrays as comma text instead of PostgreSQL arrays.
Root then independently confirmed zero residual owned schemas. Admit only the
fixed scalar ARRAY binding repair, helper10dc0cbf/unit6012b8df/native1ab6f911,
and another personally executed native proof with the same bounded target and
cleanup conditions. No unchanged retry or serving action is authorized.

Scalar-array repair passes actual rollback and added-grant checks, but replay
rejected at29.85s; Bun's promise matcher hid the cause. Root again confirmed zero
residual schemas. Admit native diagnostic d4d2c9c0 with unchanged helper10dc0cbf:
direct awaited stage errors report only class/SQLSTATE/bounded backend wait states.
One root diagnostic run plus read-only inspection of its synthetic Q265 backends
is admitted to determine the cause, not an unchanged success retry. No timeout
increase, serving writes or session termination.

Actual diagnostic showed direct-awaited added/existing succeeded, then a native
negative-case async matcher stalled. Root observed its backend idle in transaction,
ClientRead, no blockers, last advisory statement; connection lifetime then expired.
Zero residual schemas again verified. Admit only harnessf105d1e3 removing all native
async promise matchers in favor of direct await/exact captured-error assertions.
Helper/SQL/deadlines unchanged; one root repeat determines whether this repairs the
harness. Do not claim a general Bun root cause beyond the observed behavior.
