# Order 463 reservation alert workflow — independent review

**Reviewer:** Codex `/root/pricelabs_contract_intake` (non-implementer)  
**Date:** 2026-09-09  
**Status:** **POSTGRESQL AND FRONTIER91 READINESS PROOFS GREEN — activation remains separate**

I read `PROJECT.md`, Order463 and the repository compliance, entity and PostgreSQL
skills before reviewing the domain service, server/application wiring, operator HTTP
adapter, root UI and four focused test files. I did not start an application, mutate a
database, use a retained database as a fixture, or change implementation/test source.

## Blocking findings

### P0 — current schema 90 grants no alert mutation authority

`migrations/0016_runtime_dml_authority.sql:5` revokes `INSERT`, `UPDATE`, `DELETE`
and `TRUNCATE` on every public table from `app_role`. Its exact direct insert/update
catalogue at lines 15–83 never restores any authority on `public.alert`, and no later
migration contains an `ON public.alert` grant. The implementation nevertheless issues
a direct alert insert at `src/contexts/reservations/alerts.ts:269-275` and a direct
`UPDATE active=false` at lines 325–333 inside the normal tenant transaction, which
enters `SET LOCAL ROLE app_role` in `src/kernel/db.ts:75-96`.

Consequently both changed commands are guaranteed to fail on current90 with SQLSTATE
`42501`; `translateDatabaseError` at `alerts.ts:228-239` conceals that deployment defect
as not-found. The source/mock suites cannot detect this. Order463 currently says no
migration is needed and does not scope one, so the order/scope and schema authority
must be corrected before a positive real-database proof can exist. The least authority
is column-limited `INSERT` for the seven fields used by create and `UPDATE(active)` on
`alert`, with RLS still forced by the tenant transaction; exact catalogue proof is
required rather than an ad-hoc test-only grant.

### P0 — deactivate UI and backend expose different routes

Order463 line 33 defines `POST .../alerts/:alert:deactivate`. The UI follows it at
`src/http/operator/operator.js:5595-5596`, and its focused assertion at
`tests/operator-reservation-alerts-ui.test.ts:66-71` expects the colon form. The server
instead registers `/alerts/:alert/deactivate` at `src/app.ts:634-637`, while
`tests/operator-reservation-alerts.integration.test.ts:76-80` positively locks that
different slash form. Thus both isolated suites pass while the shipped deactivate
button cannot reach the registered endpoint.

### P0 — present integration harness cannot represent deploy and runtime identities

`tests/reservation-alerts.integration.test.ts:20-23,90-113` uses one
`YELLOW_RESERVATION_ALERTS_URL` for privileged fixture setup/cleanup, the event pool and
`Database.connect`. A deploy URL can seed the fixtures but fails the mandatory
`yellow_runtime` settlement in `src/kernel/db.ts:60-63`; a runtime URL can settle and
enter `app_role`, but cannot insert/delete the fixture catalogue. A meaningful proof
needs separately guarded deploy and runtime URLs for one exact database. The current
cleanup also deletes fact/outbox history at test lines 69–77; no append-only trigger
blocks the database owner, so that cleanup must never run against any retained target.

### P1 — nominal cross-boundary tests conflict before reaching the boundary

The command helper fixes `order463-create-alert` at
`tests/reservation-alerts.integration.test.ts:49-60`. The first test successfully
claims that key at lines 124–130. The next test reuses it for changed reservation
requests at lines 146–150, so `PostgresIdempotency` will raise changed-request conflict
before `lockReservation` can prove the expected cross-property/cross-tenant not-found.
Each boundary case needs a unique key.

## Proof gaps that remain after those blockers

The database file contains only two test cases. It does not yet personally prove:

- simultaneous same-key create yields one mutation plus one exact replay;
- changed-request same-key conflict has zero additional alert/fact/outbox effects;
- simultaneous distinct-key deactivate yields one changed result, one no-op and only
  one deactivate fact/event;
- wrong subject/reservation, foreign alert, foreign tenant and foreign property
  deactivate concealment;
- exact RLS direct-read isolation under `app_role`, and exact cross-tenant write denial;
- publication failure rollback for deactivate and successful retry after rollback;
- exact fact/outbox shapes and keysets (the current lines 139–143 only search serialized
  facts for two forbidden strings); and
- immutable unrelated reservation, occupancy, guest, folio, finance and numbering
  fingerprints across every case.

The UI suite exercises deactivate but never submits the create form. It therefore does
not prove create URL/body normalization, key retention/reuse, authoritative refresh,
double-submit prevention or stale-session late-response behavior. Also, the visible
alert line at `operator.js:5636-5644` omits `alert.code`; read-only staff can see the
message/display trigger, but the code is available only inside a writable active
alert's deactivate `aria-label`. Product intent should confirm whether the order's
readable-alert/code requirement permits hiding that recorded code.

The positive source design is otherwise coherent: the reservation is locked with
explicit tenant/current-tenant/property predicates before alert mutation
(`alerts.ts:179-195,267-282,306-340`); create/deactivate use separate idempotency
operations with complete actor/property/reservation/request material; no-op avoids
fact/outbox publication; and changed paths publish a minimized alert diff through the
same transaction (`alerts.ts:198-225`). The operator adapter derives tenant and actor,
requires lifecycle-write scope, and conceals missing property grants
(`src/http/operator.ts:4967-5048`). The UI renders staff content as text, blocks local
double submission, retains uncertain keys, refetches authoritative detail, and checks
property/reservation/generation/session/permission before updating current UI
(`operator.js:5575-5680`). These source properties do not substitute for the missing
database proof.

## Personally executed source evidence

Current reviewed snapshot hashes before correction:

- Order: `091000e0ccf266ad3ab4558d120b38e78fd12cf9fbf035b506d1166be855da43`
- `alerts.ts`: `1b0a7e797b2cd6acdf82ad054f12fd6bf365faefc2f9226ebf8ba109a8bea58d`
- backend integration test: `f586c61d1fadcaff0bd2ddc765a90edaef071ccf132932d0de372f8e0578d6cc`
- HTTP adapter test: `a950f2045f2375dcef59d80103b5715ce7dc94b0bb5f1e93163def0a8522a292`
- UI test: `d8ea492bf5d021b2d9ce40ffcfcb6531fdb729097716f0d61ad84015f421800c`
- operator JS: `53069e086e8b161c97135f5e0a84b8f911a335a7822467f11a4314f90f95e48f`
- migration 0016: `216e79ab0b10a697b79e99872cbf3a65394dcdf94773af1fd4c13862f4e83fe5`

Commands and results, personally run from the active edit root with native Bun 1.3.14:

```text
bun test tests/reservation-alerts.test.ts tests/reservation-alerts.integration.test.ts tests/operator-reservation-alerts.integration.test.ts tests/operator-reservation-alerts-ui.test.ts
11 pass / 2 explicit database skips / 0 fail / 55 assertions

bun run typecheck
pass

bun run boundaries
Import boundaries OK: 198 TypeScript files scanned

git ... diff --check -- <Order463 source and tests>
pass
```

The two skips are the complete PostgreSQL suite and are not claimed as database proof.

## Exact native PostgreSQL proof strategy

No known database on the current native cluster is an eligible disposable fixture
target. `yellow_order444_review_a10851786f17` is the retained serving database;
`yellow_order460_recovery_547cf3d335af_20260909` is retained recovery evidence;
`yellow_order453_referee90_20260908` is the retained canonical90 referee; and
`yellow_pricelabs_staging` is the separately governed PriceLabs research database.
The retained template/older referee databases are also source or evidence, not
unclaimed scratch space. None may be cleaned or repurposed.

After the route, test and canonical alert-authority correction is independently
reviewed, the smallest eligible setup is:

1. On the already-running native PostgreSQL 16.15 cluster at `127.0.0.1:55503`, verify
   the pinned postmaster/data-directory identity, exact database inventory, target
   absence and zero unexpected sessions without printing credentials.
2. Under a separate root admission, create exactly one database named
   `yellow_order463_review_20260909`, owned by `yellow_deploy`, from `template0`; create
   no role/cluster/extension outside canonical migration behavior.
3. Apply the complete canonical migration sequence through the corrected frontier and
   prove the exact ledger/schema/role/ACL result before fixtures. Use distinct protected
   deploy and runtime URLs bound to that one host/database and assert session identities
   (`yellow_deploy` for setup/evidence, `yellow_runtime` → transaction-local
   `app_role` for product calls).
4. Insert unique one-shot synthetic tenants/properties/actors/reservations and retain
   them and their append-only evidence; do not run suite cleanup. Before insertion,
   fail if any fixture UUID/slug/key already exists. Use per-case unique idempotency
   keys and count deltas so an interrupted run cannot be mistaken for a clean retry.
5. Execute the strengthened isolation/replay/conflict/concurrency/rollback suite with
   bounded connections/timeouts. Preserve bounded private logs and final fingerprints.
   Do not drop the proof database absent a later explicit, exact deletion admission.

Until that proof is green, Order463 is source-present but not built/verified or safe to
activate.

## Source re-review after admitted repairs

The blocking findings above are retained as the review history. The admitted source
repairs resolve them without widening the production mutation surface:

- `migrations/0091_reservation_alert_authority.sql` grants only the seven insert
  columns the service supplies and `UPDATE(active)` to `app_role`; it adds no table,
  RLS change, table-level mutation grant, role or PUBLIC/yellow_runtime grant.
- the production route and UI now agree on the existing slash-action convention;
  the reviewer-owned HTTP suite also dispatches both commands through the real
  `createApp` router and proves the unpublished colon alias is 404;
- the database suite now requires exact paired `yellow_deploy`/`yellow_runtime` URLs
  for only `yellow_order463_review_20260909`, retains random one-shot fixtures and has
  no cleanup path; and
- boundary cases use distinct keys and now cover simultaneous create and deactivate,
  exact replay and changed-request conflict, wrong tenant/property/subject/alert,
  RLS read/write behavior, exact minimized evidence, injected post-publication
  rollback and retry, unrelated-row immutability, plus direct SQL denial for alert
  message/tenant/subject/id updates, delete and truncate.

The repaired UI suite now has ten cases including create normalization, uncertain-key
reuse, blank input, double submit, stale navigation/session behavior and authoritative
refresh. Alert code is visible to read-only viewers. The validation suite accepts
ordinary CR/LF/tab in notes while retaining strict single-line codes.

Current reviewed hashes are:

- Order463: `5919f1636792af04b3010525617e9ceeeeb0f73c6929c5cd83b75d61bedf334c`
- migration0091: `ec49a08984c2a8db3c2faaca8041d19e614741ef486d7b65f4eefe94dc4f35d3`
- `alerts.ts`: `a506f0b6017d1b2bb54d9622c23442a1abab8afb4ab21642e51134c9114b23bc`
- reviewer database test: `ae58f2e6b23486cd1d180994088011ea64958d2c7c822aaa4748f5a7633942be`
- reviewer HTTP test: `892418a80aca17c3c6ca294dd4b9e2f078422437408910270dba124121b3b35b`
- native proof runner: `536a58fbacedae4daa9614f99696683150cf5a079b8d24584eb8f14fa0c3c0c0`
- complete migration manifest 1–91: `81a9fb1269413de573efc5de7665016f44a1a0c8d0e99f5bd4ca3c84145c6f7e`

Personally executed after those repairs, using native Bun 1.3.14:

```text
bun test tests/reservation-alerts.test.ts tests/reservation-alert-authority.test.ts tests/operator-reservation-alerts.integration.test.ts tests/operator-reservation-alerts-ui.test.ts tests/reservation-alerts.integration.test.ts
17 pass / 6 explicit database skips / 0 fail / 84 assertions

bun run typecheck
pass

bun run boundaries
Import boundaries OK: 198 TypeScript files scanned

<bundled PowerShell 7.6.5> -NoProfile -File .yellow/evidence/order463/invoke-reservation-alert-proof.ps1 -Action Review -ExpectedRunnerSha256 536a58fbacedae4daa9614f99696683150cf5a079b8d24584eb8f14fa0c3c0c0
pass; source/binary pins and exact 1–91 migration manifest accepted
```

No database action ran. The guarded runner separates read-only `Inspect`, one-shot
`Provision`, and `Integration`; every write-capable action requires `-RootHandoff` and
a protected, hashed prior receipt. Provision refuses an existing target, creates no
role, preserves pre-existing role/membership/database fingerprints, migrates through
0090, proves migration0091's exact ACL effect inside a rolled-back transaction, then
applies0091 once and proves replay is a no-op. It produces the required native
PostgreSQL16.15 ACL-bearing normalized dump rather than inferring snapshot text.
Integration seeds only the fresh target, runs the unchanged 11-invariant referee and
the runtime-DML/alert suites, and re-proves schema and global catalogue stability.
There is deliberately no drop, alert-suite teardown, overwrite or retry path. The
unchanged canonical referee does contain TC12.3's narrowly scoped deletion of its own
fresh synthetic dorm occupancy and linked fixture parents; that known invariant-test
operation requires the root's live admission and applies only inside the fresh463
database, never to a retained database.

Two publication gates remain explicitly open. `tests/schema/expected.sql` still has
the frontier90 alert ACL and must receive only the verified pg_dump delta after the
live native dump. `src/kernel/build-info.ts` still reports migration frontier90; it
must advance coherently with canonical0091 before any runtime readiness/activation
claim. Neither pending gate invalidates source-only review or the fresh-database proof,
but Order463 cannot be called complete until both are resolved and the independent
database proof below is green.

The final runner hardening pins its own bytes before credentials or filesystem writes,
requires the bundled PowerShell7.6.5 executable (SHA-256
`362a356ce7f0940ec74f73a8fc2c990a2cc24a38a11c90bbd8eca947110ad139`),
and rejects Provision/Integration without root handoff before creating the private
directory or reading retained credentials. Review remains credential-free. Host checks
pin restart receipt
`cd80d994c334ce4810014f3c54f133ab4a3bac795dc4b23c97c748c5167c2fea`,
PID9880, start `2026-09-09T08:57:25.3781778Z`, exact executable/data root,
command line, postmaster options and clean-control receipt; generic port presence is
insufficient. Inspect additionally proves the inherited deploy identity is the exact
existing superuser on PostgreSQL16.15 and the admitted data directory, without any
permission repair. Schema capture uses pg_dump's `--file` for a stdout-only SQL
artifact and keeps stderr in a separate bounded private log. The reviewer DB predicates
now use JSONB containment throughout; no `->>` predicate remains.

### Native Inspect execution history

The first admitted Inspect with runner `076ee95a…a94` stopped before SQL because
PowerShell7 materialized the restart receipt timestamp as `DateTime`; only that
receipt predicate failed. It created the protected control directory, which remained
empty. The repaired reader uses `ConvertFrom-Json -DateKind String` and preserves the
receipt's exact lexical timestamp.

The next admitted Inspect with runner `89aca9d3…536` also stopped before credential
access or SQL: CIM `CreationDate` truncated the retained process start by seven ticks.
PID, executable and normalized command matched. The final runner uses the already
reviewed `Assert-ExactProcess` argument for an actual start value and supplies exact
`Get-Process.StartTime`; it does not loosen timestamp precision.

Root independently inspected and admitted runner
`536a58fbacedae4daa9614f99696683150cf5a079b8d24584eb8f14fa0c3c0c0`.
I then personally executed only its read-only Inspect phase with the exact bundled
PowerShell7.6.5. It passed the retained restart/process, deploy-superuser,
PostgreSQL16.15 data-directory and sanitized global catalogue fingerprint checks and
proved the target absent. Protected receipt:

```text
D:\Yellow\temp\order463-reservation-alert-proof\20260909-120024-149-e340a981-inspect.json
SHA-256 44850e2a59723f2b449cd9a3a06484303332f3b917b391da740f00e3ab2e547c
targetPresent=False
```

No Provision, migration, fixture, invariant or integration action ran. Provision
remains gated on a separate root admission binding this exact runner and Inspect
receipt.

Root then read the Inspect receipt in full and admitted one Provision with runner
`536a58fb…c0c0` and Inspect receipt `44850e2a…547c`. I personally executed it once.
It created only `yellow_order463_review_20260909` from `template0`, applied canonical
migrations1–90, proved migration0091's exact column ACL effect inside a rolled-back
transaction, applied0091 exactly once, proved its replay a no-op, captured a native
ACL-bearing PostgreSQL16.15 schema dump, and re-proved the pre-existing role,
membership and other-database fingerprints unchanged. It completed in 19.3 seconds:

```text
D:\Yellow\temp\order463-reservation-alert-proof\20260909-120238-281-baea7888-provision.json
SHA-256 a78e875828456ed4b31e547057ed82a3736077de9f33490818e27c0b596ef36f

D:\Yellow\temp\order463-reservation-alert-proof\20260909-120238-281-baea7888-schema91-normalized.sql
SHA-256 00905c1b38f0a1a6e90581c327d89a377a9ab0f33620626d4eb3d66f24cd13c3
```

No fixture, invariant or integration suite ran. The new database and all evidence are
retained; no cleanup or retry occurred. Integration remains separately gated on root
review of this Provision receipt.

Root read the Provision receipt in full and separately admitted one Integration run.
I personally executed it once with the same runner and exact Provision receipt. It
completed in 16.8 seconds with the unchanged referee at 11 passed / 0 failed of 11 and
the two database suites at 11 passed / 0 failed / 174 assertions (six reservation-alert
service cases and five exact runtime-authority cases). This includes the real
concurrency, replay/conflict, tenant/RLS, minimized evidence, rollback/retry,
direct-DML denial and immutable-row cases described above. The post-test normalized
schema remained byte-identical to the provisioned schema, the native pg_dump stderr
log was empty, and pre-existing role, membership and other-database fingerprints were
unchanged.

```text
D:\Yellow\temp\order463-reservation-alert-proof\20260909-120435-636-5c90f3c3-integration.json
SHA-256 b633b5c7afb866d27862386c08f488d9e8800e213f0371e71fb2762efdf8c72d

database tests: 11 passed / 0 failed / 174 assertions
referee: 11 passed / 0 failed of 11
frontier: 91
schema unchanged: true
```

The one-shot synthetic fixture and its append-only evidence remain in the isolated
Order463 database. There was no retry, reseed, database drop, serving/recovery access
or application runtime. The independent PostgreSQL proof is therefore green. The
separately recorded generated schema-snapshot and build-frontier publication gates
must still close before Order463 activation/completion.

### Frontier91 readiness source review and prepared live probe

I independently reviewed `src/kernel/build-info.ts` at
`66c147ec2888173df78f5bbb13a2b8ddd5978947465cb6990d2050198c867010`
and `tests/build-readiness.test.ts` at
`139baf239c3bc60e99386a32376dbbae4d536216fd1fc157372c8bcd4110e390`.
The frontier advances only90→91. The new readiness CTE checks the existing alert
table's owner, exact enabled/non-forced RLS policy, absence of table-level app-role
mutation, exact seven-column INSERT plus active-only UPDATE, absence of REFERENCES,
and absence of PUBLIC/yellow_runtime table and column authority. Its result is included
in both the aggregate all-true check and an explicit named guard. Existing fiscal,
tenant, function, index and permission readiness predicates remain present.

The unit proof exercises the new flag as true and proves false, null, undefined and
omitted states all fail closed before the permission phase. I personally ran it:

```text
bun test tests/build-readiness.test.ts
8 pass / 0 fail / 249 assertions

bun test tests/build-readiness.test.ts tests/release-workflow.test.ts tests/free-host-arm64.test.ts tests/setup-current-catalogue-oracle.test.ts
21 pass / 0 fail / 419 assertions

bun run typecheck
pass
```

I also inspected the current-release oracle delta admitted in the Order463 question.
It changes only current source/release frontier literals and appends migration0091 to
the full migration list; historical 86/87/88/89/90 proof names and boundaries are not
relabeled. No shell, setup, deployment or database command was executed for that
review.

The smallest live readiness proof is prepared under private Order463 evidence:

- `.yellow/evidence/order463/readiness91-proof.ts` —
  `2375cf74b3ab54d4891ef5f0f0eac4babf8ce2eea71c743fa5fe9302db9e5fce`
- `.yellow/evidence/order463/invoke-readiness91-proof.ps1` —
  `a477bbbc9a3ea700edcf699d2d7bbd2f9eae62c7d690520fb9819d0ebda89f8d`

The wrapper self-pins before any live access, reuses pinned parent host guard
`536a58fb…c0c0`, requires the accepted Integration receipt, exact bundled
PowerShell7.6.5 and separate root handoff. The TypeScript probe uses one
`yellow_runtime` connection only, fixes `default_transaction_read_only=on`, verifies
runtime/host/database/version and read-only settlement before and after calling the
real exported `assertRuntimeReleaseReadiness`, and closes the pool. It cannot seed,
alter roles, start an app or connect to another database. Failures disclose only a
bounded phase identifier, never the SQL error, URL or credentials. Its credential-free
Review and typecheck passed; no live Run has occurred yet.

Root subsequently admitted and executed that readiness proof once. It failed at the
sanitized `assert_release_readiness` phase; there was no success receipt. The retained
private log is
`D:\Yellow\temp\order463-reservation-alert-proof\20260909-123251-677-6f07d66b-readiness91.log`
at SHA-256
`147a4776ae79a5b88f2c5a1abfe95986f0433d7d92cb4a17c212bbdaabbcf65b`.
Its only content is the bounded phase marker. That failure does not identify whether
the catalogue query raised, a named catalogue predicate was non-true, or the final
read-only app-role permission transaction failed, so it is not evidence for weakening
the release oracle.

I prepared a separate one-shot read-only diagnostic for that distinction:

- `.yellow/evidence/order463/readiness91-diagnostic.ts` —
  `400ff3667957dfc0da7820cfe817d2f4d3dffc25eda6528741aad93922bca94a`
- `.yellow/evidence/order463/invoke-readiness91-diagnostic.ps1` —
  `9d26b56e3741f6524ac15083efc81cdd2cba07cd0d970c8bc9b3f90bc4383e01`

The diagnostic captures the catalogue and permission statements from the real pinned
exported readiness function rather than maintaining a second SQL oracle. On the exact
isolated target it can disclose only the 23 fixed boolean names and bounded states,
or a five-character SQLSTATE/null if execution itself fails. If all catalogue flags
are true, it executes the captured original `begin('read only')`, local app-role and
permission query and reports only a bounded outcome. The wrapper pins the accepted
integration receipt, the preceding failed proof/log, source, helper, host and tool
identities before credentials, and still requires a separate root handoff to Run.
PowerShell AST parsing, credential-free Review under the exact bundled PowerShell7.6.5,
TypeScript typecheck and diff whitespace checks passed. No diagnostic database Run
has occurred at this point.

After root cleared the owned port3001 process, the first admitted diagnostic invocation
failed in Bun's parser before opening a database connection: the repository typecheck
does not include private `.yellow` evidence, and Bun rejected two newline-separated
`as Record<...>` casts. The protected parser log is
`D:\Yellow\temp\order463-reservation-alert-proof\20260909-125400-395-3981b80e-readiness91-diagnostic.log`
at SHA-256
`e3c5b550a896da315fc40f334f6c6951149423e976b43fe882629562a5612a9c`.
No readiness SQL ran and no diagnostic receipt was created.

I changed only those two casts to their inline form. The corrected diagnostic is
`909463f12d3c4162fc8145167d2c4019e413534ec89aff80c03ab80ed3855e0a`;
the repinned wrapper is
`6c9f7faf388a15b2bd3e56c37adab062cb662db82dd8f48de18a2adf54ceeb2f`.
In addition to the repository typecheck and PowerShell AST/credential-free Review, I
personally compiled the exact corrected TypeScript source with Bun1.3.14's
`Bun.Transpiler.transformSync` in TypeScript/Bun mode. That exact parser proof passed.
No database execution was included in the correction or its verification.

### Frontier91 ACL readiness regression audit — 12 September

The retained diagnostic receipt is exact and eligible evidence for the failed
predecessor, not a success claim. Receipt
`7d024410d8b503d98dfa2067018dd4df51172cc6abd17465d5f2b8d611c3683a`
records only `catalogueOutcome=sql_error`, SQLSTATE `22023`,
`permissionOutcome=not_run`, zero named failed flags, exact runtime/read-only
identity and frontier91. The earlier bounded readiness and parser-failure logs remain
unchanged at their recorded hashes.

I independently inspected the root correction at `src/kernel/build-info.ts` SHA-256
`b6149f8c89336b4a9ac33fa3a26fb4657590b47810f11368aa8c74327170f2e2`.
Only the alert-column ACL expansion now supplies `attribute.attacl` directly to
PostgreSQL's strict `aclexplode(aclitem[])`; a NULL per-column ACL therefore produces
zero rows for the nested `NOT EXISTS`. The invalid empty-array substitution is absent.
The focused source test at SHA-256
`82242a91add9e89586c35c4ae631fbc809ee188cb3587d00efe60536a7b8ee4d`
pins that exact form and rejects the former `'{}'::aclitem[]` form.

The prepared successor probe at SHA-256
`ae3a448f46f01c5d69c521d756817f75a2050060d2936435fed21d41e7b1aa64`
is read-only and requires the exact corrected source. It will personally prove on the
isolated Order463 database that the former empty ACL expression raises SQLSTATE
`22023`, NULL ACL expansion returns zero rows, the exact `pg_catalog.aclexplode`
function is strict, and the real exported `assertRuntimeReleaseReadiness` returns
success. It emits only those bounded facts and exact runtime/read-only identity.

Offline verification with native Bun1.3.14 passed:

```text
Bun.Transpiler TypeScript/Bun compile of readiness91-successor-proof.ts: pass
bun test tests/build-readiness.test.ts: 8 pass / 0 fail / 250 assertions
bun test tests/build-readiness.test.ts tests/release-workflow.test.ts tests/free-host-arm64.test.ts tests/setup-current-catalogue-oracle.test.ts:
21 pass / 0 fail / 420 assertions
bun run typecheck: pass
PowerShell parser check of invoke-readiness91-successor-proof.ps1: pass
```

No database connection or host-bound helper ran in that audit. The then-current wrapper bytes at
SHA-256 `173ef7210b4d4cd5290c7215ad66456cc35179675f7e10ada79fad1c3d06ff12`
still import the retired PID9880 host guard and are deliberately ineligible for Run.
PID9880 is absent, port55503 is not listening, and the retained cluster requires the
separately governed native recovery. After that recovery, the successor wrapper must
pin the fresh restart receipt/process identity and must not execute or weaken the
stale guard. A new exact root admission remains mandatory before the one read-only
database Run.

### Fresh recovered-host successor execution — 12 September

The successful native recovery is bound through the shared definitions-only helper
at SHA-256 `b40646de518261dfcc9e36b8a269197aaee5364f35453710a542a37b29a8ee15`.
That helper pins the successful restart receipt
`563fc1645160b23ab63f04eb9371b3ee6a57dd3cbb11dd501b0159eb479f16a5`,
recovery admission
`9b5592a1df2afdfdb024eab710df4d73c2ed2e1286c17b0b37bb84dfd497e5e7`,
and pre-recovery control receipt
`223247f4710679a284201c8f16a284d464d938c26f573a0ec7115a45537c0220`.
It requires PID2340 and exact `Get-Process.StartTime`
`2026-09-12T17:14:09.3086384Z`; it does not use the stale PID9880 helper.

The rebound successor wrapper is
`e5952d33463e847ec4f4676ca81bac071ec3f0d506cc19d62210a1cf1fbdc48f`.
Its credential-free static/Review proof is
`798d2fe829b4f0be9efb921f0f5b826987533544e79e04d3c5e783df4d35fd2a`
and passed18 assertions; the shared receipt-only proof passed15. The wrapper checks
the exact recovered host before live access, after accepting the probe result but
before writing or printing success, and again on exit. Root fully read the wrapper,
unchanged probe and both host helpers, repeated the offline proofs, and admitted
exactly one read-only Run.

I personally executed that one Run through the pinned PowerShell7.6.5. It used one
`yellow_runtime` connection to only `yellow_order463_review_20260909`, with
`default_transaction_read_only` and `transaction_read_only` both on. The former
empty ACL expression reproduced SQLSTATE `22023`; NULL ACL expansion returned zero
rows; the exact `pg_catalog.aclexplode(aclitem[])` function reported strict; and the
real exported `assertRuntimeReleaseReadiness` completed true at frontier91.

Protected evidence:

```text
D:\Yellow\temp\order463-reservation-alert-proof\20260912-172803-325-fb8ffb29-readiness91-successor.json
SHA-256 b2a2e0065a87d9662d4f8df001bc43d7f35397e718a95df209c6d4797cd35e3b

D:\Yellow\temp\order463-reservation-alert-proof\20260912-172803-325-fb8ffb29-readiness91-successor.log
SHA-256 ec949d7d115c9333f2861246cb9420d815af5c837584d23fe9e298f994983f66
```

The receipt binds the corrected build-info
`b6149f8c89336b4a9ac33fa3a26fb4657590b47810f11368aa8c74327170f2e2`,
unchanged probe `ae3a448f46f01c5d69c521d756817f75a2050060d2936435fed21d41e7b1aa64`,
the complete recovered-host chain and the retained predecessor diagnostic. The final
host observation remained PID2340 at the exact seven-tick timestamp and executable
SHA-256 `324ac242d623edcf82822f0c59c5dc2f8e74049d9dbb7ebc738bdaf5824e2ae6`,
with the sole relevant listener `127.0.0.1:55503`; ports3000/3001 remained absent.
No app, migration, seed, fixture, DDL, role, provider or business-data write ran.
