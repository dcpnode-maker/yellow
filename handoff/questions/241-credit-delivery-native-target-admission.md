# Q241 — Order452 native target and proof admission

**Status:** staged technical admission, 2026-09-08. Root coordinator owns execution.
Read-only preflight is admitted now. Write-capable actions require a later exact
source/target hash handoff after root has fully read the frozen helpers and tests.
This is not a founder-policy request and grants no UI or live-app authority.

## Stage A — read-only current-state verification

Use only PostgreSQL16.15 on127.0.0.1:55503, retained postmaster15956 at
D:\Yellow\temp\order434-production-cluster-20260906. Verify live3000 remains
process7568/parent9508, and3001 remains absent. Protected credentials are loaded
through the unchanged, individually selected444 helper functions; never expose them.

Authenticate unchanged447canonical-proof/run and444 helper hashes from the
Order452 release-proof plan. Reuse only the447 PreflightReadiness operation,
which captures complete rows/catalogue/ledger and outside database/role/settings
state without SQL writes. Permit only new uniquely named order452-prefixed files
in its existing private447canonical-logs directory, plus private452 receipts.

Compare the complete database state, excluding source-file hashes that legitimately
changed with new implementation, to accepted snapshot SHA256
1d79d66d961dc3999bcd4f768ac4d59749fa916b18ed4b7ce7ff6b888396b08d.
That prior evidence reports:
- yellow_order446_referee87_20260907: canonical88,2054 rows,9 tenants,21 permissions.
- yellow_order447_referee88_20260908: canonical88,1262 rows,2 tenants,19 permissions.
- yellow_order446_credit_upgrade_20260907: ledger87 plus retained draft88,2904 rows.
- yellow_order434_production: pristine77,90 rows,0 tenants,11 permissions.

These are expected historical baselines, not unverified live claims. Reconfirm all
identities, contents and zero source/template sessions. Confirm the EXACT proposed
new names below are absent from the captured complete database inventory.

### Stage A executed independently — 2026-09-08

Root fully read and personally executed frozen preflight.ps1 SHA256
8a4803f5c51aa17f8cb608805e21e3935377b5ba38fdb3a81b2956181b956a20.
The new canonical snapshot is BYTE-IDENTICAL to accepted1d79d66d above:
`.yellow/evidence/order447/canonical-logs/order452-20260908-085309-593-6e773853-PreflightReadiness.json`.
Both proposed names are absent and retained postmaster/live listener identities
are unchanged. No SQL or database mutation occurred.
Receipt `.yellow/evidence/order452/preflight-logs/20260908-085309-593-6e773853-preflight-receipt.json`
SHA256d6f630686e8f66da21f03017eedf2f4477e438f183a17c25789960a42b70fd99.
The separate source observation11d045e7 is not a final execution freeze.

## Stage B — frozen functional execution admitted, 2026-09-08

Root fully read both new helpers and all implementation/proof inputs. Root ran
the read-only Review mode; manifest
`.yellow/evidence/order452/native-logs/20260908-092126-702-0ac8c69c-review-manifest.json`
SHA256df391e94e58d2b92be6d356d5bd3472949e5d51eafbd31db51d596c21208ef0c
pins all32 inputs, including final HTTP testb7814919 (explicit absent-grant guard;
root fresh typecheck passes). Runner1160956fb2770b04cafaad179f266a5bbeaa8b458b678673a7eef5a4634a5bf9
and proofbd3f6fdcca6ae986480dbdb72ce7bc02381a4db9e8d1631835554a9027d346c4
are admitted ONLY for the exact sequence below. Root personally executes it as
nonimplementer. Immediate full retained-state/source/space/session guards precede
clone. Frozen rollback, draft install, SQL and signed-HTTP tests run in that order;
final preservation capture runs even on failure. No automatic database deletion,
rerun, canonical89, live app or external provider action is authorized.

This records execution authority, not an assertion that tests passed.

### Exact retained-clone resume after runner ordering failure

The first actual run092227 stopped after successful clone8bb2d48f and before any
rollback test or migration because its JavaScript inventory sorting differed from
PostgreSQL C ordering. Root's separate read-only comparison proves exact filtered
prior inventory, all companion state and global roles unchanged. Keep all failed
logs and the same candidate; do not recreate it.

Root fully read the narrow helper repair5aaddc7b10d1473530b9d639c5bde078c475dc4bada8b54c213ae9e0dd916d08
and proof3339b0fa4c0af44a66b6d8fd156a438525ccf437325b1179d52fcd88bc11707f.
Its exact-candidate exclusion retains PostgreSQL order and verifies the new row's
complete metadata. Root personally generated fresh review manifest
`.yellow/evidence/order452/native-logs/20260908-093120-311-8680a62a-review-manifest.json`
SHA256862265385d9a1d53b320676b2a7c51e5e363953d43ac427125f3249c673cb88d.
Only ResumeAfterClone is admitted next: pin original before7537d347 and complete
clone8bb2d48fad19b5bc169a9a5ec93902513f1e6b9d0a51dfd9176d1dda68ded402,
freshly verify full candidate equality and companion state, then execute the same
previously unrun rollback/install/SQL/HTTP sequence. No other retry is admitted.

Proposed candidate: yellow_order452_credit_delivery_candidate_20260908, cloned
only from the verified populated canonical88 target above. This is one small test
database on the same server, not another server or app copy. Install only frozen
draft0089 transactionally, with no fabricated schema ledger entry.

Run rollback/predecessor tests on that same new candidate BEFORE installing the
draft. Their one genuine cohort remains there. Then runtime SQL and HTTP proofs
add nine fresh cohorts: ten total and thirty exact factory-owned global codes.
Native guards require the explicit execution flag and the same exact candidate
for both runtime and rollback; no other retained target is permitted by those tests.
Keep the genuine populated88 target unchanged until separate canonical upgrade
handoff. Proposed clean referee: yellow_order452_referee89_20260908, cloned only
from pristine77 after collision/space/session checks, later upgraded with the
production runner. No creation is admitted merely by writing this proposal.

Native source guards must name exact role/host/port/database pairs and distinguish
draft/current89/upgrade88 operations. No broad yellow_order prefix allowance.
Every prior row and non-admitted global/schema/ACL/sequence state must be preserved.
Only newly identified synthetic test cohorts, their exact transaction codes,
provider extensions and publication/receipt records may be added. No existing
financial data is corrected or deleted.

Owned-prune proof, if executed, must target only freshly created test-cohort outbox
rows already published through the existing capability and eligible under retained
policy; preserve every other row. No general prune or table-wide deletion.

Corrupt-storage proof may prepare one temporary test-only owner capability bound
to exact new fixture UUIDs and a collision-checked unique name. It has no arguments
or arbitrary SQL hooks, a fixed safe search_path and app-only temporary EXECUTE.
Inside one transaction, take the exact table lock, temporarily disable only USER
triggers, change only the fixed owned row, reenable triggers, then invoke the real
runtime-authorized reader. Expected55000 must roll back ALL row/trigger changes.
Finally remove only the exact test helper and prove catalogue/ACL/rows/trigger
equality. The frozen body and target IDs need root execution handoff first.

## Reachability corrections grounded in canonical source

0078's fiscal_submission_delivery_all_or_none_ck requires legacy delivery_version
NULL to have property_node NULL; it cannot be a matching property-scoped credit
head.0079's governed request rejects any existing tenant/document head under its
advisory lock, irrespective of provider. Native CRN issuance starts at87.
Do not fabricate supported CRN legacy/multi-provider states or weaken those guards.
Prove the real exclusions/second-provider denial and zero effects; retain defensive
ambiguous/legacy union tests at the pure boundary and the bounded SQL LIMIT2 branch.
These are defensive branches, not claimed successful native lifecycle outcomes.

### Runtime-only resume admitted after two test-oracle failures

The retained093224 run genuinely passed rollback3/0 (19 assertions), installed
the exact draft, then returned SQL9/2 (153 assertions); HTTP did not run. The two
failures were premature lookup before the canonical15-second eligibility interval
and adapter construction counted as a provider request. SQL test914825b1 now waits
on the natural database clock and distinguishes adapter construction from requests;
no production SQL/service/worker or lease policy changed. All failed logs remain.
Finald3ada4ae proves complete original-row, catalogue, companion and role preservation.

Root fully read frozen runnerbb8eea0ebbc221c959a483fda89acdd1c14734052d700063da13fc9e835af295
and proof2e5ba955823495e3535f90330a8be7956504d128b1f910b0d01efd31a7da04a1.
Root personally produced and read fresh32-input review manifest
`.yellow/evidence/order452/native-logs/20260908-094742-457-6fb591d5-review-manifest.json`
SHA256d8b7022df5d290eafcf89a31242f7c3c33700855dd1ada8db658af5d325a6a7d.
Root then executed read-only CaptureRuntimeBaseline, independently verifying the
installed structure, all original rows, exact prior9 cohort IDs/27 codes and3080
current rows against the retained receipts. The new FULL row baseline is
`.yellow/evidence/order452/native-logs/20260908-094847-512-1c228861-runtime-baseline.json`
SHA256301f76e433bf1e9f1ece065fba70739da0fc83e7e71743b19880bd45d9ac1991.
The earlier final receipt contained a summary, not all3080 row hashes; this newly
captured baseline supplies full hashes for preservation during the next run.
Companion/global snapshot remains byte-identical011a7217e2ba232fdc37e356e42403a478048932e97aa9a4a2763cdc34a1b5bd;
postmaster15956/live7568/9508 unchanged;3001 absent.

Root now admits ONLY ResumeRuntime using those exact manifest/baseline paths and
hashes plus ExecuteAfterHandoff. Verify full current baseline equality immediately
before SQL8+HTTP1 new cohorts. Preserve every3080 baseline row; successful final
delta must be9 cohorts/27 owned codes, cumulative18/54 since original clone, exactly
one additional owned outbox-prune cohort, all temporary fault helpers absent and
all retained companion/role/catalogue state unchanged. Capture final state even on
failure. Do not clone, reinstall, rerun rollback, delete, promote or auto-retry.
This is execution authority, not a statement that the resumed tests passed.

## Stage C — canonical upgrade execution admitted

After root native14/0 and rollback3/0, exact0089/readiness/release sources were
integrated. Root fully read canonical runnerb675aee65448145cb486cdfe4618b5b0d521428f583aab910fee55a5c55f3148
and proofb281b7593f36a9524d02d4f4a0eca3ad2cfd9d375c9174ca39f6058a556611e4.
Read-only source Review:
`.yellow/evidence/order452/canonical-logs/20260908-101737-207-7c089fcb-review.json`
SHA256d598daf03d3339ff5459bc5a642ca145fc1f553d9afec3c8fd044b65cdbeb0fc.
Root's immediate PreflightUpgrade:
`.yellow/evidence/order452/canonical-logs/20260908-101815-100-e5e2e635-PreflightUpgrade.json`
SHA256157f58a5c1e367b67e83e48a972de8090aec808a228ff04be976e01f3afbf191
records full state and matches the earlier successful read-only snapshot state.
It pins the4122-row functional candidate to final8980ea7f, additionally captures
every34,430 row of the older446 candidate, and captures complete database metadata
for every existing database, all roles/memberships/settings and other companion rows.
Upgrade remains88/2054 rows; template77/90 rows; proposed clean89 name is absent.

Earlier source-review PowerShell tokenization failure and pretty-JSON evidence-size
failure occurred before SQL writes and remain recorded. Keywords were separated;
compact JSON retains every field. The fixed six-target existing snapshot is4.88MB
and a seventh clean target will add approximately0.43MB, so only structured evidence
cap was explicitly raised to6MiB before writes. Child logs remain bounded5MiB.

Root now admits ONLY Upgrade with these exact review/snapshot paths+hashes and
ExecuteAfterRootHandoff. Production migrator applies only canonical0089 to
yellow_order446_referee87_20260907, preserves every existing row, all first88 ledger
entries including timestamps, all prior functions/ACL/catalogue/sequences and all
companions/global roles, then proves exact no-op and captures normalized schema.
Read its resulting PreflightClean before separately admitting any clean creation.
No live promotion, new server, provider, main merge, target deletion or auto-retry.

After independent functional/rollback proof, copy exact draft bytes to0089,
execute real populated88→89/no-op with prior ledger/rows preserved, and clean77→89
schema equality plus unchanged11/11 referee. Then exact readiness denial/restoration
and full-current integration checks may run. Old88 CI remains exact prefix88, not
88-or89. All companion targets/template/globalroles/liveapp remain protected.
No Docker/WSL/new cluster, main merge, external provider activation or app promotion.

### Clean89 creation and referee admitted after successful populated upgrade

Root personally executed Upgrade101934: production runner applied only0089,
preserved all2054 pre-existing rows and first88 ledger entries, and exact no-op
passed. Root separately compared every protected companion/legacy/template/full
database metadata/role state in resulting PreflightClean to the prior snapshot;
all are exact. The new upgrade schema is78e76f927b299f43c76d3050ace81007aea84cae8bf0830c48451daee96b9703.
Root reviewed `.yellow/evidence/order452/canonical-logs/20260908-101934-922-1797522f-PreflightClean.json`
SHA2568a38c2b28660de5d40485890766aaf112e186fb8c47a6008a8fdac862fae63f2.
The clean89 name remains absent, template remains pristine77/90 rows/zero tenants,
all reviewed sessions zero; D has24.89GB available and live identities are unchanged.

Root admits ONLY CleanReferee under the SAMEd598daf0 source manifest, exact
PreflightClean path/hash and normalized upgrade schema path/hash from101934.
Create yellow_order452_referee89_20260908 from exact pristine77 only after the
helper's immediate collision/session/space guards. Migrate78–89, prove no-op and
byte-equal schema, then collision-check and run unchanged seed/referee11/11;
preserve every preceding row/catalogue/ledger and all other targets/roles.
Do not delete/recreate any target or start a new server. Review its resulting
PreflightReadiness before separately admitting committed readiness mutations.

### Readiness denial/restoration admitted after clean89 referee success

Root CleanReferee102140 succeeded: exact pristine77 clone, production78–89/no-op,
canonical89 schema78e76f92 byte-identical to populated upgrade, unchanged referee
11 passed/0 failed. Clean89 has1263 rows,89 ledger,129 tables/119 RLS/119 policies/
28 FORCE/2 views; all previous rows remain. Root independently compares all six
other database snapshots plus outside database metadata/roles to PreflightClean:
exact, with all live identities preserved.

Read and pin `.yellow/evidence/order452/canonical-logs/20260908-102140-393-7dcf4398-PreflightReadiness.json`
SHA256b6d1d524e51ab381ede80b85b04f370f936e155ad8af7c54ba8130149a965acb.
Root admits only ReadinessDrift with this snapshot and unchanged d598daf0 source
review/runnerb675aee6/proofb281b759, plus ExecuteAfterRootHandoff. On the clean89
target only, require genuine runtime readiness, old clean88 denial, and the frozen
17 reader/13 projector one-at-a-time committed mutations followed by exact finally
restoration and readiness acceptance. Original-reader absence/result/signature
tests are exact collision-checked targets; no CASCADE or arbitrary function targets.
Mutation apply is atomic and cleanup runs only after actual commit. LEAKPROOF is
not mutated (requires superuser); app EXECUTE grant-option denial is tested instead.
No role elevation occurs. Require closed connections then complete zero-effect
state equality, including all clean89 rows/ledger/catalogue and all companions.
No failed case authorizes automatic retry or a relaxed readiness assertion.

### Final StageC result

Root's actual ReadinessDrift102600 passes all30 denials and30 exact restorations;
receipt9b2ba954cc9fa306e85e32d076b6fe760573bf47e045a30436425905c927257c.
Fresh post-readiness snapshot is byte-identical to preceding b6d1d524 above.
Generated expected schema was applied only after root inspected the two additive
new-function/ACL hunks and verified exact78e76f92 equality with both independently
executed databases. This closes Q241's native/canonical verification sequence;
it authorizes no future target reuse/write or live promotion. See D1439.

## Separate source-only candidate and standing admission

Root fully read the private candidate runner and both pure projectors, inspected
the mixed API-only projections and all46 scoped paths, and independently checked
the actual base tree:2097 files/28,317,220 bytes. Pre-execution defects in root-file
parent admission and oversized single Git blob batching were corrected before any
runner execution. Batches are now independently sized and bounded8MiB; new paths,
ownership-safe rollback, exact dependency-junction identity and private indexes
preserve unrelated source and paused UI.

Frozen candidate-run.ts SHA256caa23dfcd9765524517a63371e2041d59cbc941d6d2cae47b1e9c6968cbbdc59;
prepare-selective-candidate.ts a9110a491bc37080051a2fdb1cbe25d4c7daffc29262a89e664c8a3a9b6e4f93;
validate-selective-candidate.ts 252c18c2c5cab4e70609b207065b6830b541bfcc45daecd6ab92e94c37538bcf.
Root admits read-only Review to a new private receipt, then Prepare ONLY against
that exact receipt/hash and unchanged source/helper/index fingerprints. It writes
private Git indexes/objects only, never a ref or real index. Root must inspect the
resulting manifest before Validate against its exact hash.

Validate may update only the selected candidate files in the existing regular
D:\Yellow\temp\order447-functional-validation-20260908 artifact, initially exact
0b1ff327/tree75425071. It must preserve the known node_modules junction, all real
source/index/stage/flags and refs. Run bounded full-suite/typecheck/boundaries and
license checks with DB/auth/provider/Docker/WSL environment removed; distinguish
environment skips and an empty local license census from actually executed proof.
Only owned temporary replacements/backups may be removed or restored. Unknown
changes are preserved, not overwritten. This grants no database operation, new
checkout/dependency tree, live restart/promotion, commit/push/merge or auto-retry.
