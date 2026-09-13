# Q258 — Post-Windows-Update recovery and Order466 single local

**Status: corrected r2 local promotion VERIFIED; first failed attempt retained.**
**Order: 460**, delivering independently accepted/published Order466.

## Fresh receiving evidence

Source41415cc5c6953f71d9b3baada6fd9c7853567128 has all six exact CI jobs
green in run34725373251; the database referee is11passed/0failed. It is not live.
Windows Update's restart cycle ended at boot2026-09-12T23:32:17.5174980Z.
Prior app14944/supervisor6812/PG2340 and ports3000/3001/55503 are absent.
Retained cluster reports in production; pg_ctl status exits3, no server running.
The Q25546004 artifact/config and database remain retained. Q255 and prior
recovery receipts are consumed historical evidence, never replay authority.

## Source-only scope

Coordinator owns this question, Order460/Review460, docs/PROJECT-STATUS.md,
DECISIONS.log, handoff/LEDGER.md and metadata-only Order466 evidence/admissions.
Under .yellow/evidence/order460, bounded disjoint builders may add only:

- recover-native-postgres-20260913.ps1 and its .test.ps1;
- prepare-receiving-runtime-41415-20260913.ts and its .test.ts;
- current-runtime-41415-adapter.ts and its .test.ts;
- current-runtime-41415-cutover-20260913.ps1 and its .test.ts.

No historical helper edits, duplicated stage-chain/auditor, product changes,
Git/index/ref mutation, WSL/Docker, new database/dependency installation, cleanup,
migration, reseed, provider activation or live execution by these builders.

## Recovery constraints

Mechanically reuse the reviewed production-interruption projector589344a3 and
its original launcher guards; native PostgreSQL performs its own WAL recovery.
Exact retained cluster D:\Yellow\temp\order434-production-cluster-20260906,
port55503/loopback; priorPID2340 must be absent. Stale postmaster.pid hash
fbca829c31110a5b9929a758bdae6d6109a525e3a64b6bb95b61d61b3f0211c4;
pg_control hash fe066d618ea011b6b5ef207c48ed73ce43696e2ac9799e7cc8a612e7e06b7ead.
Bind the exact boot above and unrelated running PG17/PID4520, without touching it.
Preserve binary/options/path/ownership/disk guards; fresh absent output root
D:\Yellow\temp\order460-native-postgres-recovery-r3-20260913.
Use the previously reviewed bounded300-second native recovery budget with bounded
parent and exact-owned failure cleanup. Never delete a lock/WAL, reset, run SQL,
or represent successful startup as business-data equivalence.

## Application constraints

Prepare fresh immutable source/control for exact41415 under D:\Yellow\runtime;
one link to existing dependencies, unchanged frontier91/retained database/login,
six approved workers and fiscal/providers disabled. Reuse existing hash-pinned
artifact, ACL, bounded-supervisor, smoke and exact-owned-stop primitives.
Because the previous generation is already stopped, prove its absence rather
than replaying Q255's old stop or promotion receipts. Bind the new PG recovery
receipt/native100ns identity before launch. Fresh stage/live/rollback generations
must have distinct bounded logs and no automatic restart. A rollback, if needed,
uses the retained46004 artifact with a fresh generation, not dead PID receipts.
Verify exact served invoices and print assets, same saved-login authentication,
invoice list/detail/readiness and honest supplier_issue_status_unavailable.
No financial command or provider acceptance is implied by HTTP success.

## Admission and proof separation

Root did not implement these helpers and must personally inspect and execute
focused positive/hostile/ownership/rollback tests. Each actual recovery, artifact
creation, private preparation and runtime launch requires separate exact-hash
root admission after source acceptance and fresh receiving checks. Review/import
is inert. No blind retry, overwritten output, false current-live claim, main merge
or phase-completion claim. Existing Q253/private PriceLabs/provider inputs remain
open independently and do not block this safe technical continuation.

## Separate one-shot recovery admission

Root independently inspected the full inherited launcher/projector and new helper,
personally reproduced the lowercase-start/no-authority predicate bypass without
starting anything, and returned it for correction. Final helper77cfb0c5 rejects
all noncanonical action casing before projection. The prior postmaster epoch is
1789233249, preserving boot-after-process semantics. An intermediate disk-test
oracle failure is retained; inherited host/listener safeguards were not weakened.
Root personally executes final42passing/0failed synthetic assertions, then actual
read-only full preflight against the retained host: binary/path/lock/control/boot/
PG17/disk/options/logging/ports/output guards all pass. No startup in that proof.

Root now admits exactly one Start under helper
77cfb0c52dd3fc4d6904f024682ccde91129d09f052d10067b0361d634f2d0d7,
projected70fa74d93576c81a2f6fa9c7eaac1f4a2df0589a0aafb1a470bb23f003c91f6a.
Exact admission: .yellow/evidence/order466/q258-recovery-admission-20260913.json.
This admits native retained-cluster recovery only, not SQL, app launch, another
database, deletion/reseed/migration or data-equivalence claims. Preserve failures.

## Recovery completed; separate immutable-source admission

Root executed Start once: native PG13580/start2026-09-13T03:30:30.6444374Z,
receipt2a0722428c290475ec41a3139ce8fa494e6c0a79d8f38119bedc3334e047c83b.
Native pg_ctl completed in127940ms. Root independently verifies exact executable,
command/native start and sole loopback55503;3000/3001 remain absent. Recovery
companion893b69e3 and precontroldataa3fb9a1f remain bound. No SQL/equivalence claim.

Root inspected the four materializer/adapter files, personally executes8/0(39),
strict TypeScript and2/0 actual native ACL-script predicates with synthetic ACLs.
Actual environment/candidate hash closure, same-user ACL principal and primitive
field checks were strengthened before acceptance; no credentials read in proof.
Admit only immutable source creation under helper1dc403e081e38e877c2ccd50a350a12478b8935fca6bf0be838acbc3c194001a,
exact41415 archivee588dfe4/tree5e6d8b67/2220files. Output roots above must be absent;
use one junction to existing dependencies. Exact admission is
.yellow/evidence/order466/q258-source-admission-20260913.json.
No private preparation or app launch is included in this source action.

## Immutable source complete; separate private preparation admission

Source creation completed once, receipt a06466bca6b1e23565b6d9cd08019d0b1229568d467f2c72ba0929f65101f5d8.
Root separately verifies all2220 extracted Git blobs/30307939bytes, archiveSHA,
existing dependency junction and absent private output. Sole PG13580 remains;
no app listener. Root admits one private preparation under adapter3dcc399d,
using .yellow/evidence/order466/q258-private-preparation-admission-20260913.json.
Only retained saved credentials are privately compared/projected, changing the
buildSHA alone; fresh explicit same-user private ACLs and candidate receipt.
No runtime launch/SQL/migration/provider activation. The first cutover draft was
rejected; corrected cutover execution remains unadmitted pending closure proof.

Private preparation completed once: candidate47ed699a756dc478a81621e5cb0075b63e6cd4ee1b64ad2405607097a35896f0,
environmente0011e5fd8ddb81020c09937cdb6494fff16aca2782e1dea8231aa24494e8c5c,
supervisor57e6ad0c33b2867fe064904193ac9bb51d56146570f58ff26990f10761a5e8d6.
Root separately checks all four exact same-user protected ACLs and file hashes.
No credential values published; app remains stopped. Nonimplementer reviewer
personally reproduces readonly-PID, missing binding-function scope and invalid
conditional-expression faults in cutover15e821 despite7/0 superficial tests.
Incomplete artifact/ACL/supervisor pinning and rollback context also require fixes.
These failed candidates are evidence, not accepted launch authority.

## Corrected cutover source accepted; one generation preparation

Final d93f839e and testfbd850c2: root and separate nonimplementer each personally
11/0(57), including actual previously failing function paths; wrong Review hash
is rejected. Native app-start failure preserves unproven-cleanup refusal before
rollback. Root actual read-only source/archive/private ACL/prior absence/recovered
host and retained original smoke-identity guard pass; no secret values output.
Retained rollback supervisorf4045744 and its same-user ACL separately verified.
Admit one generation Prepare only: metadata admission
.yellow/evidence/order466/q258-cutover-prepare-admission-20260913.json.
Fresh private stage/live/rollback supervisor files; no launch/SQL in this step.

Generation Prepare completed once, receipt697c702b. Root separately checks exact
stagebd8f6f9c/liveea3221aa/rollbackc8aba935 supervisor hashes/ACLs, unused outputs,
full candidate/archive/private binding, prior app absence, recoveredPG and exact
CI6green. Root now admits one Promote underd93f839e, metadata in
.yellow/evidence/order466/q258-promotion-admission-20260913.json.
Temporary3001 smoke then exact stop; single3000 with retained credentials/database
and six approved workers. Fresh46004 rollback only after proven exact cleanup if
needed. No migration/reseed/newDB/provider/mainmerge or prior receipt replay.

## First cutover consumed and failed; r2 correction

The d93f839e Promote invocation exited1: staging child15208 started at
2026-09-13T03:57:17.0774426Z and was subsequently confirmed stopped. No successful
promotion or retained rollback receipt exists. Only PG13580/55503 remains.
All first-attempt artifacts are retained; neither Prepare nor Promote is replayable.
Root found the post-launch guard reused the app-absent host condition. r2 separates
recovery binding and verifies the exact expected live child, supervisor, candidate,
frontier91 and per-generation source commit. Fixed safe diagnostics preserve first
and rollback failure classes without raw exceptions or secrets. The underlying
first rollback no-status cause remains unproven; retained preflight passes read-only.
Fresh r2 uses a different output root, cutover-41415-r2-20260913. Source81921d4e
and test17b117df pass root-personal13/0(61). Root independently passes full native
PG/prelaunch host, all source/archive/private bindings, original fixture identity,
saved-login comparison and fresh r2-root absence. Execution requires separate
admission after the independent final-source audit; no r2 action is claimed here.

## Corrected r2 independently accepted and separately admitted

q258_source_adapter independently verifies frozen81921d4e/test17b117df and runs
13/0(61), inert Review, and the actual imported transformed true-host function
with synthetic OS/file leaves. Both41415 and46004 contexts pass; wrong candidate
commit, frontier90, providers enabled, and an extra app listener reject. No private
or runtime action by the reviewer. Root source proof and full actual prelaunch
checks are above. r2 Prepare admission q258-r2-cutover-prepare-admission-20260913.json
was consumed once, yielding66c86c5b at2026-09-13T04:17:05.9902185Z; generation hashes
stage652ec476/livef290311e/rollback79f4ec0a. Root separately verifies full receipt,
all generation hashes/ACLs, exact41415CI/source/private/retained-host checks and
fresh one-file generation roots. Admit one r2 Promote only under81921d4e/66c86c5b,
recorded in q258-r2-promotion-admission-20260913.json. No result is implied here.

## Actual r2 result and independent root post-check

Promote completed, receiptc64e87d70bd5f4bdeaed5ac57fa140dd813a8dc13905fbbe7ddfce680843ee8c
at2026-09-13T04:19:14.2088495Z. Sole loopback3000 serves41415/frontier91 with
app17936/native start04:19:10.6446122Z and supervisor17096/start04:19:07.7695159Z.
RetainedPG13580/55503 unchanged. Staging17732 is stopped, no3001listener, no r2
failure or rollback receipt. Saved-login authentication, invoice reads, exact
93880-byte invoices and33970-byte print, honest supplier-status blocking pass.
Root separately rechecks ready identity and the actual full true-mode native
PG/app/parent/candidate/ACL/listener guard plus both served-file hashes. Initial
post-check filename/metadata-reader errors and corrected successful rerun are
recorded, not hidden. No credential values output. Six approved workers retained,
fiscal/providers off, logs5MiB×3/stream, no automatic restart. No reset/reseed,
migration/newDB/dependency copy/mainmerge/actual rollback/phase closure.
Compact proof: .yellow/evidence/order466/q258-r2-promotion-proof-20260913.json.
Order467 status reconciliation remains unpublished source, not yet served.
