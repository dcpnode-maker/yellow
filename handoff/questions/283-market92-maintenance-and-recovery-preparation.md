# Q283 — minimal native maintenance and91→92 recovery preparation

Order460, 13 September2026. Exact75a2 source package is materialized and root
verified; all six exact-head CI jobs plus canonical referee remain required for
actual release. Existing41415/frontier91 stays running during preparation.

Two disjoint implementation owners, four new ignored files only:

- /root/q258_runtime_cutover: .yellow/evidence/order460/current-runtime-41415-maintenance-20260913.ps1
  and .yellow/evidence/order460/current-runtime-41415-maintenance-20260913.test.ts.
- /root/astra_ultra_handoff (corrective owner after initial worker freeze): .yellow/evidence/order460/receiving-serving-market92-recovery-migrate-20260913.ps1
  and .yellow/evidence/order460/receiving-serving-market92-recovery-migrate-20260913.test.ts.

This is source and focused synthetic proof only. No live stop/start, database
access, authority/environment read, output-root creation, Git mutation or actual
Review/Prepare/Quiesce/Resume/Recovery/Migrate action by either worker. Root must
inspect, independently prove and separately admit any action. Tests must not
execute top-level live code; use inert extracted functions with synthetic seams.

## Maintenance owner

Create the smallest receipt-bound maintenance controller, using reviewed owned
process/start/ACL primitives only by exact pinned imports, never invoking old
cutover entry points. Bind current promotion receipt c64e87d70bd5f4bdeaed5ac57fa140dd813a8dc13905fbbe7ddfce680843ee8c,
41415 app17936/start2026-09-13T04:19:10.6446122Z, supervisor17096/start
2026-09-13T04:19:07.7695159Z, sole3000 loopback listener, PG13580 native identity,
candidate/live-supervisor/environment identity and private ACLs. Read current
receipt metadata, not credential values, for immutable pins during preparation.
Double-observe native PID/start/executable/command/parent/listener and refuse
changed or unknown ownership. Eventual quiesce stops only the exact owned app and
supervisor, verifies3000/3001 absent, and drains serving sessions boundedly without
terminating any database session. Do not weaken existing capture zero-session gates.

Prepare a separately explicit resume path for the exact41415 app only while its
verified database is still91. No restart on92, no obsolete46004 rollback, and no
automatic retry or fall-through. Quiesce must require validated resume prerequisites
and a complete separately admitted release plan; retain one-shot success/failure
receipts and safe bounded logs. Source preparation does not authorize downtime.

## Recovery/migration owner

Use the reviewed Q251 bounded Recovery/Migrate structure as reference, not replay:
replace old source/frontier/roots/host assumptions. Bind Q281 actual receipt
3ea46055f27ccc00b081a26e2cb03a01c9debc931aaba261069a100d866fbb48,
source75a2eba1/tree7f5dbd1d, archive2ad8502e/9,564,897 and shareddeps11da9763.
Use the frozen Q282 capture/verifier and existing native migration runner unchanged.
Serving yellow_order444_review_a10851786f17; new recovery
yellow_order460_recovery_75a2eba1cd34_20260913; exact0092 fc20c295c130010bddcd1e71388261a23cb1b3e5aa85bea27b4492a1074028ac.

Require fresh valid maintenance/quiescence receipt AND actual zero serving
sessions/absent app listeners immediately before CREATE DATABASE TEMPLATE and
immediately before migrating serving. Require absent recovery before clone,
both databases quiescent after clone, full before/recovery equivalence and fresh
continuity before91→92. Only exact0092 may apply; second canonical migration run
must apply nothing. Full after capture/verifier must preserve business rows,
catalogue except exact authority, all companions including PriceLabs, roles,
sequences and historical ledger. No registry, seed, provider or app launch here.

Retain ordinary-path/private-ACL/tool/archive/tree/dependency/action-time identity,
resource C3GiB/D2GiB plus clone budget, bounded deadline/output/ownership guards.
Outputs are one-shot and no automatic deletion/retry/restore. Unknown or changing
sessions fail closed, never pg_terminate_backend. A successful92 migration needs
separately admitted75a2 activation; old91 source is not a schema rollback.

Root owns Order460, this scope, release checklist, review, status and ledger.
Preserve all18 phases, fiscal work and dependency-gated11→13→17; no new framework,
copied dependency tree, worktree or parallel local app is justified by this scope.

Root inspected the initial recovery wrapper75045384/test4C6D5B8F and does not
accept it for action: it validates claimed artifact/dependency hashes without
re-reading those bytes, omits native tool/PG action-time bindings, incorrectly
counts a CI jobs object as an array without verifying the six job results,
uses unbounded ReadToEndAsync retention, and lacks complete one-shot failure/
preservation checks. Astra Ultra now owns corrective edits to these same two
files; initial worker moves to disjoint pure adapter Q284. Root is the independent
reviewer and personally executes the corrected focused proof. No live action
is admitted and no guard may be replaced by a receipt's assertion alone.

The corrected wrapper may accept deploy authority only through child environment
YELLOW_ORDER460_MARKET92_ADMIN_URL and YELLOW_ORDER460_MARKET92_SERVING_DEPLOY_URL,
provided by root from the already approved protected authority files after all
admission/source/CI/maintenance/native checks. Bind the same deploy identity and
exact postgres/serving targets. No credential-bearing CLI parameters or logging;
source tests use only synthetic values and never load the actual environment.

Root independently inspected final recovery e30cfa2c/testf1972bd4, maintenance
b9ec5308/testb1ff1289 and Q286640bff72/86808abd. Actual combined focused proof:
28pass/0fail/196 in31.67s. Admit the recovery controller's read-only Review once:
actual source/archive/ACL/dependency and Git preservation inspection, no DB,
authority loading, output writes, app/process change or execution handoff.
Successful Review is not Recovery/Migrate/Quiesce authority. Those stay gated on
the complete accepted activation plan and root's separate action admission.
