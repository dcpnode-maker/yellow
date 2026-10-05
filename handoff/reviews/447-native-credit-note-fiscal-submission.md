# Order447 — native credit-note fiscal-submission review

**Status:** core draft SQL, typed projection/receipt binding and the Q219 signed
provider journey are independently accepted at the exact reviewed source hashes
below. Canonical0088, v3 preparation-interface proof, current88 readiness/schema,
fresh/upgrade referee, standing gates, exact-source CI, merge, deployment and any
external provider acceptance remain open.

## Reviewer and scope

Reviewer `native_helper_release_proof` did not implement the Order447 SQL, fixture,
typed projector/receipt binding or tests. The reviewer read PROJECT.md, Order447,
Q219, the PostgreSQL patterns and the complete bounded native helper before
execution. No generic bootstrap, seed, role, database, provider, application, UI or
live-service action was performed. Protected URLs were assembled in memory and
supplied only through child-process environments; no credential is recorded here.

Root, not this reviewer, inserted the three explicitly admitted dictionary rows in
each retained target and installed the frozen draft only on the candidate. Root
recorded prerequisite attempt SHA256
`4fd60b4901a87ec113b8c6076330f929416736f9640f3d16744f0e54fa3c54e5`
and install evidence SHA256
`3894223d8d877c8ce0ac8010a52c7fef56e170312c4b6bd0b72ab5a4c3dbc560`.
Root separately established exact pre-write equality after the reviewer identified
a prospective target-snapshot guard gap. The repaired executed helper snapshot was:

- runner `ba75251d2d10ac4fe2c401a90afc7c9142f5f681625b494c6dfe4ca46b3e0e51`;
- native proof `e114f0601efd40abd895108dd890f7b3f4279e77277b367ec5c2b57fb61a1f67`.

The helper validates both complete reviewed targets and has one positive and eight
zero-effect target-drift denials. Later private helper edits for separate Q222 work
are not retroactively treated as the helper used by this review.

## Reviewed immutable inputs

- draft0088: `214754e94bdfb0a2163395c9ab4449b0b5e87da7830c45e69d77ac05a2cddb64`;
- shared fixture: `ad6494fd6952c68bd3929fb581949e2d1072ebbd31624c21480b6f45bbcdd606`;
- SQL integration: `d2287be8d5ef8e3faf313438e7a6745e288e51c20880436ee9410832b01628d5`;
- upgrade integration: `67bdbb0dd5b6d1cc601169ec1dc02333ce3c56a2b034075a5fb596730703d149`;
- final Q219 journey: `c2a6c9b4f56a683091e4c3c34bc81b8e8fe7a4ab055df29a63e9e6ec47c09646`;
- issued-wire source: `d4b42f8be43ca228a40ede6ae75b4c6851d2d0a92b8f55d58c09fe5041a3da82`;
- signed-receipt binding: `107b56557700b8728d250bb74d44b2031656bdc428f184caac6a1459061d066d`;
- seed source: `716d6f4df1a577fe6019d9febfd39f0b165d2c97c13637bc2f451d0312a31eea`;
- Order446 credit fixture: `4800e1464e3898318f8f4acf0d90dbe0de98fc500c93b22398594b0cf5e7fc2d`.

The draft's credit-binding lookup was rechecked at exact bytes and is tenant-bound:
the earlier missing-tenant report was a reviewer misread, promptly retracted, and
did not cause or require a production change.

Before database execution, the reviewer personally ran the four focused source
suites: 33 passed, 0 failed, 12 explicit database-gated skips and 337 assertions.
Typecheck and the scoped diff check also exited0.

## Personally executed native SQL proof

All commands ran from the active worktree against only retained loopback55503
targets `yellow_order446_credit_upgrade_20260907` and
`yellow_order446_referee87_20260907`.

The first exact preflight command was:

```powershell
& .\.yellow\evidence\order447\native-run.ps1 -Mode Preflight
```

Snapshot `20260907-193316-762-preflight.json`, SHA256
`73609b207299ba9f9e26ac0455695b958c3dcdda75378e183cab3faa8cc57a7a`,
pinned all11 reviewed inputs and both complete targets. Candidate was ledger87,
projector body `b34eaf0095dad0df5cd55453b7e4bd1a42f5ae698a02c5ebca3dcac7645c9f96`;
referee was ledger87 with original projector body
`ca6b253d...`. Owner, ACL, configuration and outside/template/live fingerprints
were exact.

Each write-capable mode used `-ExecuteAfterHandoff` and the immediately preceding
absolute snapshot path plus its exact SHA256. The SQL invocation was:

```powershell
& .\.yellow\evidence\order447\native-run.ps1 -Mode SqlTests -ExecuteAfterHandoff `
  -SourceSnapshot '<absolute-worktree>\.yellow\evidence\order447\native-logs\20260907-193316-762-preflight.json' `
  -ExpectedSnapshotSha256 '73609b207299ba9f9e26ac0455695b958c3dcdda75378e183cab3faa8cc57a7a'
```

It passed 8/8, 0 failed, 81 assertions in15.53s. It proves exact SQL/TypeScript
ordinary, correction and transfer wires; unchanged financial graphs; app/private,
tenant/property and authority denials; hostile unbound credit rejection; replay;
and four-way same-key concurrency. Test log
`20260907-193403-311-SqlTests.log` SHA256
`b3d3219ea20a15ea0762e85e07327f9ce8cf61fd8456869943976e7273e9e21e`.
Before/after evidence SHA256s were respectively
`799e79fbf0c7aa79c52d83907149cc9cea905111d6141e130ef190107a60c5e8`
and `e3e78338b5c89be951370eb88898d950cfd973813b44e7ed33eddb62e677ce11`;
preservation log SHA256
`d6fcf0778bdad40ffc24bfbae5109d2c50a6ad09b72a5d7829b431ebf4a46c1d`.

A fresh preflight snapshot `20260907-193456-267-preflight.json` SHA256
`45bbd4998710e672a8dbddc165c3c5c6bb4b8a51d31750a0c29d4b4200f85e71`
then guarded the upgrade command:

```powershell
& .\.yellow\evidence\order447\native-run.ps1 -Mode UpgradeProof -ExecuteAfterHandoff `
  -SourceSnapshot '<absolute-worktree>\.yellow\evidence\order447\native-logs\20260907-193456-267-preflight.json' `
  -ExpectedSnapshotSha256 '45bbd4998710e672a8dbddc165c3c5c6bb4b8a51d31750a0c29d4b4200f85e71'
```

It passed1/1, 0 failed, 15 assertions in7.70s. Both direct whole-draft application
and the unmodified production migration runner reached deliberate PZ447 inside the
rollback-only referee transaction. Original INV/credit parity was exact inside the
transaction; schema, functions, ACL, ledger and every pre-existing row returned
unchanged. Test log `20260907-193533-541-UpgradeProof.log` SHA256
`b28b8cb68b7ac786372c0affb9373a176ac4092a10a52f6fa4af18299821e300`;
preservation log SHA256
`b9f347bb9cb6eb7a776c7a4dbce9658977aeaa408f4ecf3432e859bf6e52d810`.

## Retained journey failure and corrected proof

The first Q219 invocation, guarded by preflight SHA256
`07e89aefe699e467c3db5aa8f6d579786809c7be7210b78d0fcc9f3cd99f1150`,
genuinely produced 2 passes, 1 failure and 60 assertions. The failed oracle expected
a replay of the original request key after acceptance to return the mutable accepted
head. Actual behavior returned the immutable original pending/send/sequence1
command receipt with `replayed:true`, exactly as canonical0079's Q205 contract
requires. Failure log `20260907-193648-429-Journey.log` SHA256
`33189d2410f7cda877695a99956860ac1e6a4e28930ca9b579ddda363eb9714d`
is retained. Its preservation check succeeded with SHA256
`d6bcd0273ec9315dadfcde70e7c4bf8bd69bcc6caf51733edcee9256186fce7e`.

Root repaired only that test oracle: `arrange` retains the complete initial receipt,
the replay assertion requires the same full receipt plus `replayed:true`, and the
separate accepted-head and authorized-GET assertions remain. No production, SQL,
fixture or helper source changed. After types and source-only crypto proof passed,
the reviewer personally ran a fresh preflight. Snapshot
`20260907-194340-401-preflight.json` SHA256
`5740c27be649e2d6f6cceb6dfd12a82f60620865a1739d352ab956286813df0a`
showed only the admitted journey-test hash change and preserved both targets.

The final exact command was:

```powershell
& .\.yellow\evidence\order447\native-run.ps1 -Mode Journey -ExecuteAfterHandoff `
  -SourceSnapshot '<absolute-worktree>\.yellow\evidence\order447\native-logs\20260907-194340-401-preflight.json' `
  -ExpectedSnapshotSha256 '5740c27be649e2d6f6cceb6dfd12a82f60620865a1739d352ab956286813df0a'
```

It passed3/3, 0 failed, 64 assertions in27.66s. This is an actual same-factory
invoice-to-credit request, real worker, encrypted RS256 synthetic-provider response,
exact CRN/reference bytes, response-loss lookup recovery, durable authorized GET,
byte-identical immutable replay and zero financial mutation proof. Wrong reference
and signed document-type controls remained active. Journey log
`20260907-194415-094-Journey.log` SHA256
`3e801b30b0d4b15242cf1774de447e07dd3cd88dac48daacd2f407fb4810e1cf`;
before/after evidence SHA256s
`37eaec45a8b5d4aa54ff1a953dbb3ef0f53ff7050ae144ca40888deac030df79`
and `1b7fb2196a2b58bb331a4526f6b19be20c034fac834a58eb99f1d26e0b7142b3`;
preservation log SHA256
`7dd6848552acedda8acf2fe70987d280166eb8734a911ad0a335f56c13726779`.

After every mode, all pre-existing target rows, full1–87 ledgers, projector bodies,
function/ACL/configuration and non-function catalogues remained exact. Outside
database, role/membership/settings, pristine template, retained postmaster and live
application identities were unchanged. Synthetic cohorts remain retained; no
cleanup or destructive action was performed.

## Published current87 CI observation

This CI evidence applies to published Q220 commit
`236df73dce4629dff92a66e1587961133e2dbd89`, not to unpublished Order447 source.
GitHub Actions run34154722275 completed successfully with all six jobs:

- local-review101844061897;
- windows-state101844062064;
- quality101844062088;
- database101844530608;
- container-smoke101844530672;
- free-host-arm64101844530711.

The reviewer inspected the database job log. Relevant current87 counts include
migration55/0, seed10/0, Order446 fresh/populated invocations31/0,11/0,8/0 and1/0,
native fiscal release containment28/0 across two files, deployment24/0 and canonical
referee11/0. Normal CodeQL run34154719875 also completed successfully. The separate
optional AI run34154722241 failed before analysis for entitlement and is not
conflated with required CI or a code finding.

## Independent decision and remaining boundaries

The frozen Order447 draft SQL, INV-preserving/CRN typed projection and receipt
binding, Q219 v2-origin signed synthetic-provider path, populated rollback behavior,
tenant/property/authority containment, concurrency and financial immutability are
independently accepted at the exact hashes above.

This review does not claim authenticated external provider acceptance. The executed
fixture used the existing v2 preparation interface; operator-v3 preparation remains
an explicit separate proof even though both interfaces retain native origin
`source_version=2`. Provider-version isolation, pruning, definitive rejection and
mid-claim crash/lease recovery rely on unchanged existing-engine evidence unless
they are mapped or rerun explicitly; they are not silently represented as new Q219
assertions. Canonical0088 promotion, current88 schema/readiness, clean and populated
upgrade/referee proof, standing repository gates, exact Order447 source CI, merge,
deployment, provider activation and release remain open.

## Q222 operator-v3 origin delta

The preceding v3 boundary is now discharged by a separately admitted execution.
The reviewer read Q222, the complete270-line test and the complete helper delta.
The test SHA256 was
`538e3ba2afbaa2641b9445d4ce9c8f7e493f449eee5db82ba0d2392c2763e67d`;
runner and proof SHA256s were respectively
`281361472e44d3b4aa7ac1e0dc1d1a63ff1de99b0a1dbf354086408df5d9d3b1`
and `ca548787f04278b34bf13dc296b49316b082f851c661921423c288764c1fc192`.
The helper change adds only the new source pin, required flag and `OperatorOrigin`
selector while retaining complete source and both-target snapshot comparison.

Reviewed preflight `20260907-195059-277-preflight.json`, SHA256
`e9e023f7defb39cd8f861f2b1ac237d5b166cf2170c77d58084a4da916f9111c`,
pinned all12 sources, candidate1838 rows with the Order447 projector, referee1374
rows with the original projector, both full ledgers at87 and private projector ACLs.
The exact personal command was:

```powershell
& .\.yellow\evidence\order447\native-run.ps1 -Mode OperatorOrigin -ExecuteAfterHandoff `
  -SourceSnapshot 'C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow-order175-folio-responsive-containment\.yellow\evidence\order447\native-logs\20260907-195059-277-preflight.json' `
  -ExpectedSnapshotSha256 'e9e023f7defb39cd8f861f2b1ac237d5b166cf2170c77d58084a4da916f9111c'
```

It passed2/2, 0 failed, 28 assertions in5.11s. The database case created a genuine
operator-v3 invoice, proved its authenticated native origin remains source version2
with timing/accounting/source-basis evidence, issued a governed full credit, matched
both original INV and credit CRN projections byte-for-byte between SQL and
TypeScript, retained the exact preceding invoice reference while stripping private
YellowCredit metadata, and created then replayed the governed submission request.
The tenant financial fingerprint and complete original-origin row were unchanged.

Evidence prefix is `20260907-200008-700`. Test log SHA256 is
`e76691cb8dff76b107b6beec8f729ab17a2c6c6dae633911b7d3179081032522`;
before/after snapshots are
`a01d5d1307d219228fc90e45cefcc82043e3efe26507c316ee0483658d72185a`
and `7e8a8766f1b91863f0a66865f22863803b03513ae579211253374562804925f3`;
preservation log SHA256 is
`88e0495b93c2497991d5b356acfd142f006c813511cce59640edf1ac034ccf6d`.
Every previous row remained present; the candidate gained only the admitted
synthetic cohort (total rows1838→1950). The referee remained1374 rows. Both targets
retained ledger87,129 tables,119 RLS tables/policies,28 forced tables,2 views,
projector bodies/owner/config/private ACL and every non-function catalogue identity.
Outside/template hashes, postmaster15956, live app7568/9508 and absent staging port
were unchanged.

Order447 acceptance item4's v2 and operator-v3 preparation-interface compatibility
is therefore independently accepted at these exact hashes. The remaining boundaries
are still canonical0088/current88 schema-readiness, production upgrade/referee,
standing gates, exact Order447 CI, merge, deployment, external provider activation
and release; none is implied by this synthetic retained-target proof.

## Canonical88 populated-upgrade action

Under Q224's separately frozen action1, the reviewer read the complete admission,
reverified runner SHA256
`0681c19cfb63c2c390bf400700c05e879bfe53ac965d57c824a38a8374d14d44`,
proof-helper SHA256
`2cb3428f9f8751ee1b6f7d080cd89abe7a53bc88c842731176c2148fa7934618`
and full PreflightUpgrade SHA256
`3b7e9b9e1c10b4519d9ff74ef42d28299e0e8da6cc58dd727aefc1ced050b02e`.
It then personally invoked:

```powershell
& .\.yellow\evidence\order447\canonical-run.ps1 -Mode Upgrade -ExecuteAfterRootHandoff `
  -SourceSnapshot 'C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow-order175-folio-responsive-containment\.yellow\evidence\order447\canonical-logs\20260907-202831-299-PreflightUpgrade.json' `
  -ExpectedSnapshotSha256 '3b7e9b9e1c10b4519d9ff74ef42d28299e0e8da6cc58dd727aefc1ced050b02e'
```

The production runner discovered88 and applied only
`0088_native_credit_fiscal_submission.sql`; the immediate second invocation was a
genuine no-op (discovered88, applied0). The populated target advanced87→88 and
1374→1375 rows solely through the new ledger entry. All first87 ledger rows,
including `applied_at`, remained exact; all pre-existing rows across129 tables,
the complete non-function catalogue and every non-projector function identity,
body, ACL and configuration remained exact. The non-function catalogue SHA256
stayed `634efcc0788a85ef0bfa8715c4b361a1d705e656db071c734cff4e31a862a067`.
The projector changed only from original body `ca6b253d...` to reviewed body
`b34eaf0095dad0df5cd55453b7e4bd1a42f5ae698a02c5ebca3dcac7645c9f96`,
retaining owner `yellow_owner`, owner-only EXECUTE and exact trusted path/UTC/
DateStyle metadata.

Evidence prefix `20260907-203205-224` includes upgrade JSON SHA256
`5fbfb79028e48129f66027bea34b3c497ac8fb314b1c4a59b24dd6c7ab67c2cc`
and log SHA256
`4d30632dfb8e4a0939956f89b0d7fdd483dc58e620203aa5d631c2183c4d41de`.
The native schema dump SHA256 is
`e1dad83f6c5e015142ac8068984d7f85f4dbf3fbe03d89854f26146c10860667`;
normalized bytes at
`20260907-203205-224-upgrade88-schema-normalized.sql` have SHA256
`616afe24b78507e93a4eedebea3da7a4d939e3f185c9e1f82088872ccf0dd4b6`
and length1,792,531.

Fresh `20260907-203205-224-PreflightClean.json`, SHA256
`093c99634b241279027d759aa436b05e36217df75cbc4adb258637913d40d8d2`,
confirms the draft candidate stayed87/b34 with1950 rows, the upgrade is88/b34 with
1375 rows, pristine77 stayed projector-absent with90 rows and the exact clean name
remains absent. Outside SHA256 `399ad933...`, postmaster15956, live app7568/9508 and
absent3001 remained unchanged. No clean database was created. Clean referee/schema
equality and readiness drift remain separately gated Q224 actions2 and3.

## Canonical88 clean migration and referee action

After the coordinator independently reviewed action1 and admitted Q224 action2,
the reviewer reverified the unchanged helper, PreflightClean and accepted populated
schema hashes, then personally invoked:

```powershell
& .\.yellow\evidence\order447\canonical-run.ps1 -Mode CleanReferee -ExecuteAfterRootHandoff `
  -SourceSnapshot 'C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow-order175-folio-responsive-containment\.yellow\evidence\order447\canonical-logs\20260907-203205-224-PreflightClean.json' `
  -ExpectedSnapshotSha256 '093c99634b241279027d759aa436b05e36217df75cbc4adb258637913d40d8d2' `
  -UpgradeSchemaPath 'C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow-order175-folio-responsive-containment\.yellow\evidence\order447\canonical-logs\20260907-203205-224-upgrade88-schema-normalized.sql' `
  -ExpectedUpgradeSchemaSha256 '616afe24b78507e93a4eedebea3da7a4d939e3f185c9e1f82088872ccf0dd4b6'
```

Only `yellow_order447_referee88_20260908` was created, as an exact clone of the
reverified pristine77 template. The production runner discovered88 and applied
exactly migrations0078 through0088, then performed a genuine88-file no-op. The
clone advanced from90 to105 rows before seed and from11 to15 canonical permissions;
all first77 ledger rows including timestamps and every prior row were exact.
Current structure is129 tables,119 RLS tables/policies,28 forced tables and2 views.
The projector has exact reviewed body `b34eaf0095...`, owner `yellow_owner`, exact
configuration and owner-only EXECUTE.

Native clean dump SHA256 is
`adc517bae363d1d82ac9a39ce1726260386d23941200c86aa6541a8e2748a509`.
Its normalized SHA256 is
`616afe24b78507e93a4eedebea3da7a4d939e3f185c9e1f82088872ccf0dd4b6`,
byte-identical to the accepted populated-upgrade normalized schema. Seed-collision
preflight passed; unchanged seed ran once under a single transaction. The unchanged
referee passed11/11: exclusive50 race1 winner, mixed private/bed exclusion,
40-thread capacity exactly6, direct insert42501,162 commits in0.92s, deferred
journal/sealed-day enforcement,100 gapless numbers,119-table tenant isolation and
both security-invoker views.

Evidence prefix `20260907-203548-228` includes clean-migrate JSON/log SHA256s
`15c0503dcf3096455ac8b879bae4ef2697d4b7fc677af45521823234224fb8bc` /
`1c46255e76118b1c552dfc0a9cb46466bf4af2554b40c2df8ee3e046e9529d22`,
seed log `ca50aa0d35a8ae82dbd19888c0919058aaa125e3afa2029fe016cfbcdebe03e0`
and referee log
`924e0857bc30b326d7e5b3c41dfed37ede89f7aca0887a779d1cf58affbe9473`.
The pre/post-referee snapshots are SHA256
`f01d4953e2f450784cff810c5f569a209f3a9a5d0c0d68072641a6614a020c62`
and `8fd35e7b641781154d5a143b176d124d37750860ba4456f6adc8200c0ba9a096`:
all105 pre-seed rows,509 functions, ledger88 and non-function catalogue
`b3396b662533a4004bb079d06652d1915e34798a902c1f2cca08d69c17160b4d`
remain exact. The unchanged seed/referee adds only its expected cohort, producing
1262 rows and19 permissions.

Fresh `20260907-203548-228-PreflightReadiness.json`, SHA256
`72b8ec620377ea0f51491279bd63f3146e7612f8a00bac3495915e806cb21dee`,
pins candidate87/1950 rows, populated upgrade88/1375 rows, clean88/1262 rows and
pristine77/90 rows, all with zero other sessions. Outside/host/live identities are
unchanged. No readiness mutation ran; Q224 action3 remains separately gated.

## Canonical88 readiness-drift first execution and repair preflight

After the coordinator admitted Q224 action3 against the exact `72b8ec62...`
snapshot, the reviewer personally invoked:

```powershell
& .\.yellow\evidence\order447\canonical-run.ps1 -Mode ReadinessDrift -ExecuteAfterRootHandoff `
  -SourceSnapshot 'C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow-order175-folio-responsive-containment\.yellow\evidence\order447\canonical-logs\20260907-203548-228-PreflightReadiness.json' `
  -ExpectedSnapshotSha256 '72b8ec620377ea0f51491279bd63f3146e7612f8a00bac3495915e806cb21dee'
```

This run is not a13/13 pass. The first12 committed metadata/owner/ACL drifts were
each denied by a separate `yellow_runtime` connection, exactly restored in the
helper's `finally`, and followed by a ready result. Before the 13th drift mutated
the database, construction of its `CREATE OR REPLACE FUNCTION` statement had
silently interpreted PL/pgSQL dollar tokens as JavaScript replacement-string
tokens; PostgreSQL rejected the malformed statement with SQLSTATE42601 near
`IF`. The retained failure JSON
`20260907-203902-929-readiness-drift.json.failure.json` has SHA256
`c787cd6e7203f7822f1b6d8738d5debd448b3dc5f63523fdf7f25fdbd0f3fd76`
and records `completed: 12`; failure log SHA256 is
`994d0d0ac6ebb7dffd8e5a67149c7b339bc896b5378619291581498a1ad040ba`.
No reset or mutation retry was performed.

The reviewer then ran only the read-only `PreflightReadiness` classifier. Its
`20260907-204002-989-PreflightReadiness.json` was byte-identical to the admitted
pre-action snapshot, including all targets, functions, ACLs, rows, sessions,
outside identity and processes, proving complete restoration after the stopped
run.

Q224 subsequently admitted a helper-only callback replacement. The reviewer
inspected the one-line change and independently executed a pure Bun splice oracle
against the admitted function bytes. It proved one unique body occurrence, exact
unchanged prefix/body/suffix, the exact31-byte comment insertion and preserved
dollar bytes. Baseline definition/body SHA256s were `27ce1a6d...` / `b34eaf00...`;
the deliberately drifted definition SHA256 was `f7e0e102...`. The repaired private
proof helper SHA256 is
`f7c5e71f16e1ac586fccc437bb19daae2d5a8198867ee0b9de9d7037e2e3dd53`;
the runner remains `0681c19c...`.

The reviewer then personally ran the read-only command:

```powershell
& .\.yellow\evidence\order447\canonical-run.ps1 -Mode PreflightReadiness
```

Fresh snapshot
`20260907-204356-893-PreflightReadiness.json` has SHA256
`ff1fdca77a6b9fd6988fae3bc5c772f6e8eceb98b97f4578938a4a3ec3a733b8`;
its log SHA256 is
`8fc0499ad18a6cff9cf28f53df6494a84e65118467323a891e4a621fc1574823`.
Programmatic whole-JSON comparison after removing only the repaired helper's own
source-hash member produced the same payload SHA256 `970c2f4f...` on both sides:
candidate1950, upgrade1375, clean1262, template90, sessions0/0/0/0, plus every
outside, migration and other-source field were exact. This freezes the repaired
input and unchanged database state only. A full13-case retry has not run and
requires a separate coordinator admission.

After the coordinator independently rehashed those repaired inputs and explicitly
admitted the full retry, the reviewer personally invoked:

```powershell
& .\.yellow\evidence\order447\canonical-run.ps1 -Mode ReadinessDrift -ExecuteAfterRootHandoff `
  -SourceSnapshot 'C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow-order175-folio-responsive-containment\.yellow\evidence\order447\canonical-logs\20260907-204356-893-PreflightReadiness.json' `
  -ExpectedSnapshotSha256 'ff1fdca77a6b9fd6988fae3bc5c772f6e8eceb98b97f4578938a4a3ec3a733b8'
```

The repaired run exited0 in21.56s. All13 committed one-at-a-time volatility,
strictness, parallel-safety, security-definer, search-path, timezone, date-style,
owner, four ACL and function-body drifts were denied through the separate
`yellow_runtime` connection. All13 exact restorations and post-restore readiness
checks passed. Evidence
`20260907-204558-407-readiness-drift.json` has SHA256
`6d3809db70d2f812ae712955105810989f55ac9586aab88ed6aacc4ed1705108`
and records `baselineAccepted: true`, `denialCount: 13` and
`restorePassCount: 13`.

Both pools closed before the final session-sensitive comparison. Independent
whole-object comparison of its final state to the admitted snapshot was exact
(payload SHA256 `716e29ba...`): candidate1950/87, populated upgrade1375/88,
clean1262/88, template90/77 and sessions0/0/0/0. The generated
`20260907-204558-407-post-readiness.json` is byte-identical to the admitted
preflight with SHA256
`ff1fdca77a6b9fd6988fae3bc5c772f6e8eceb98b97f4578938a4a3ec3a733b8`;
its log SHA256 is
`8fc0499ad18a6cff9cf28f53df6494a84e65118467323a891e4a621fc1574823`.
Postmaster15956, live app7568/9508 and absent staging listener remained exact.

Q224's three canonical88 native actions are independently accepted at the stated
inputs and evidence: populated production upgrade/no-op and preservation, pristine
clean migration/referee with byte-identical normalized schema, and13-case runtime
readiness denial/restoration with zero final effect. This does not by itself claim
standing gates, exact source CI, merge, deployment, external-provider activation
or release.

## Q225 recovery execution — stopped test-oracle failure

After the coordinator admitted one candidate-only recovery execution against
combined preflight `20260907-205116-973-RecoveryPreflight.json` SHA256
`8bd88a9522eece8ef26062d70c50113126899f2a6ad55c99212d36b20bc93e2a`,
the reviewer personally invoked:

```powershell
& .\.yellow\evidence\order447\native-run.ps1 -Mode Recovery -ExecuteAfterHandoff `
  -SourceSnapshot 'C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow-order175-folio-responsive-containment\.yellow\evidence\order447\native-logs\20260907-205116-973-RecoveryPreflight.json' `
  -ExpectedSnapshotSha256 '8bd88a9522eece8ef26062d70c50113126899f2a6ad55c99212d36b20bc93e2a'
```

The single admitted run stopped with4 passes,1 failure and84 assertions in12.63s.
Identity/credential isolation, wrong-version zero effect followed by registration,
strictly cohort-bounded global pruning with durable signed GET/replay, and genuine
authenticated rejection all passed. The fifth case launched the runtime-only
child, observed its committed claim and confirmed its backend exited. Its immediate
head was correctly `submitted`/`lookup`, response null and transition sequence2,
but Bun SQL represented the bigint sequence as string `"2"`; the test's TypeScript
annotation and assertion expected numeric `2`. It therefore stopped at line337
before waiting for natural lease expiry or invoking the fresh lookup worker.
Recovery after process death is not accepted by this run. Test log SHA256 is
`a7223aab159ccfad04867bd2736489dda4a896543695c883a99de68d9734b287`.

The runner's mandatory `finally` comparison succeeded. After-canonical SHA256 is
`43a0c4037e88656472c59fc3305b21d62f2c84d5be1e4a4f34c1390d532fe9d6`;
after evidence SHA256 is
`55cb658059788962c8e54a0eea9988c7d1188b833fe9661b196d81c6237b9539`;
preservation log SHA256 is
`8a32dbb8cbda930978f6bfff6d2d38fedbdd689afa26ff4b2cd04611deebebbb`.
All companion88, clean88, template77, outside state, migrations and sources stayed
exact. Candidate identity, ledger, functions/ACL/config, catalogue and projector
stayed exact; every one of its1950 baseline rows remained byte-identical. Only the
four admitted synthetic cohorts were added, producing2424 rows. Sessions ended at
zero; postmaster15956, live app7568/9508 and absent staging listener stayed exact.
No rerun, reset or database repair was performed. The retained fifth cohort is at
the genuine committed `submitted`/`lookup` claim with no provider send. A test-only
bigint expectation correction and fresh reviewed preflight/admission are required
before the unfinished recovery case can be rerun.

## Q225 corrected recovery execution

The coordinator changed only the recovery test's raw `transition_seq` type from
number to string and its expected value from `2` to `"2"`. The reviewer inspected
those two lines: corrected test SHA256 is
`95487aaef107d62c77243f61b4e3a81fc07e19a3f2482efce12511cdda84cdcc`;
the child and recovery helpers remained exact. A reviewer-executed read-only
`RecoveryPreflight` produced
`20260907-205842-982-RecoveryPreflight.json` SHA256
`0216d7cdb43248f91b0e53fde00e31679d266759c51d8a7f63a8842af2a3de3c`.
Its nested canonical snapshot SHA256 `43a0c403...` was byte-identical to the
retained post-failure state: candidate87/2424, companion88/1375, clean88/1262,
template77/90 and zero sessions. All16 source pins were exact, with only the
intended test hash changed from the first admission.

After the coordinator independently reviewed and admitted that exact state, the
reviewer personally invoked:

```powershell
& .\.yellow\evidence\order447\native-run.ps1 -Mode Recovery -ExecuteAfterHandoff `
  -SourceSnapshot 'C:\Users\astha\Documents\Codex\2026-08-14\cl\outputs\yellow-order175-folio-responsive-containment\.yellow\evidence\order447\native-logs\20260907-205842-982-RecoveryPreflight.json' `
  -ExpectedSnapshotSha256 '0216d7cdb43248f91b0e53fde00e31679d266759c51d8a7f63a8842af2a3de3c'
```

The corrected native run passed5/0 with156 assertions in28.66s. It proved the
runtime-only child admission, wrong-version zero effect followed by exact
registration, a strictly cohort-bounded real global prune whose eligible set was
only the three fresh events with byte-identical signed GET and immutable replay,
genuine encrypted/authenticated rejection without IRN or resend, and a real child
exit after committed claim followed by natural database-clock lease expiry and a
fresh exact-wire lookup-only recovery. Test log SHA256 is
`3b7b9c85bebb15ce6fd8ca77572b5be83f21c96b5f6ee6bf7a794c2d7e2ee471`.

Mandatory final preservation also passed. After-canonical evidence
`20260907-210018-525-recovery-after-canonical.json` has SHA256
`57108e11d5dfe907979360e10e6938257ff59a665475733876e470eb96a39877`;
after evidence SHA256 is
`e627bd9ba3f2c8d08287230e109a9ee25b5a135a62fe54206ac1656a74fe06dd`;
preservation log SHA256 is
`cc7f4173fc46b54df705ce4bd8f0bc352e42c0be05f67b25280a43d841005dc8`.
All outside, companion88, clean88 and template77 state remained exact. Candidate
identity, ledger, functions/ACL/config, catalogue and projector remained exact;
every one of the2424 baseline rows survived byte-identically. Four new completed
synthetic cohorts increased the candidate to2904 rows. Sessions closed to zero;
postmaster15956, live app7568/9508 and absent staging listener were unchanged.

Q225 direct-credit recovery acceptance is independently satisfied at these exact
test/helper/state hashes. The earlier4/1 attempt remains retained as a non-pass;
this does not claim standing gates, exact source CI, merge, deployment, provider
activation or release.
