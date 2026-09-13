# Q279 — isolated real PostgreSQL registry proof preparation

Order460, 13 September2026. Prepare proof for accepted Q276 metadata registration.
The existing synthetic Q265 public catalogue already contains market metadata.
Never delete it to manufacture an added-path test.

Builder /root/q258_runtime_cutover owns only these new ignored files:

- .yellow/evidence/order460/market92-registration-native.test.ts
- .yellow/evidence/order460/market92-registration-isolation.ts
- .yellow/evidence/order460/market92-registration-isolation.test.ts

Keep market92-registration.ts and every production source unchanged. A test-only
tagged-SQL adapter may substitute exactly the two literal public relation names
with an exact validated UUID-named proof schema, leaving all parameter values,
SQL clauses and the advisory-lock key unchanged. Reject every unexpected query,
schema, identifier or operation. This is a transparent isolation seam, not proof
that the fixed-public deployment call was executed.

Prepare opt-in native proof using only the existing Q265 environment parser and
exact yellow_order472_compset_20260913 target on127.0.0.1:55503. Before any DDL,
verify native16.15/cluster/deployer identity. One exclusive UUID-owned schema may
later contain only empty LIKE copies of extension_type and permission, preserving
actual constraints/defaults; no public DML, seeded fixtures, role/grant change or
new database. Prove rollback, one added/one existing result under actual lock
contention, exact conflict rollback and unchanged public metadata/instance/grant
fingerprints. Verify schema ownership before cleanup; drop only that schema with
exact known objects, never an arbitrary CASCADE or reused target.

Use bounded connection/statement/lock/overall deadlines and transaction cleanup.
Do not log private authority or record contents. Failed proof must not report
success or hide cleanup failure. Pure seam tests and strict types accompany code.
Root independently inspects and executes pure proof first. Actual connections,
DDL/DML, metadata registration or cleanup require a separate root action admission
after source review; this question currently admits source preparation only.

Root owns this question, Order460 and existing review/checklist/coordination paths.
No public product change, Git/CI action, live migration/recovery, app restart or
provider operation. Existing Q276 pins need no change for this isolated proof.
