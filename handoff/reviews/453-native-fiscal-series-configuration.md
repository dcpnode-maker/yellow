# Order453 — implementation and independent executable evidence

**Current state: source checks in progress; native/frontier90 release NOT accepted.**
This review distinguishes executed tests from explicitly skipped database suites.
UI and live app remain untouched. Order452 is published at557dd031; Order453 is
working source only.

## Ownership

- SQL/draft and authority/upgrade fixtures: credit_note_sql_builder.
- Typed service/command/API and HTTP tests: credit_document_http.
- Independent SQL source review and private native helper preparation:
  native_helper_release_proof (did not implement SQL or service).
- Independent typed/API review: native_helper_release_proof and
  credit_note_sql_builder (neither implemented this lane).
- Root coordinates scope and separately executes native proof after a frozen
  Q242 handoff. Root did not implement the fiscal SQL or typed/API capability.

## Source review findings and corrections

1. Initial authority coverage omitted successful same-tenant second-property and
   prior/current-FY coexistence. Added exact three-row creation and preserved
   history/replay checks. Existing0047 prohibits same-property/exact-jurisdiction
   duplicate supplier identities; the test proves23505 rather than manufacturing
   another jurisdiction or changing approved policy.
2. Added actual migration-rejection cases for drift in both the old series body
   and the durable credit-delivery reader body, alongside authority/default/ACL.
3. Initial driver decoding trusted the outer result array and read created before
   snapshotting. It now rejects proxies/accessors/unknown container keys and
   snapshots own data before deriving replay state.
4. Initial mapping incorrectly classified unavailable55000 and corrupt rows as
   conflict409. These now return sanitized503; actual23505/concurrency conflicts
   remain409 and authorization42501 remains403.
5. The historical invoice pure test expected409's domain error for a fabricated
   wrong-prefix returned row. Q242 explicitly admitted only the matching error
   import/expectation adjustment, preserving actual23505 and invoice assertions.
6. Native HTTP tests initially counted additions without proving old-row inclusion
   and changed only prefix for their claimed new-key denial. Tightening these
   assertions is in progress; a test definition is not yet native proof.

## Actually executed source-only checks

- Independent initial focused command+HTTP:9 passed/0 failed/104 assertions and
  typecheck passed. This green did not detect findings3–4; it is not acceptance.
- Independent focused command+HTTP+historical invoice after fixes:
  20 passed/1 failed/3 explicit native skips/179 assertions. Failure was finding5.
- Root after exact finding5 amendment:
  `bun test tests/india-native-fiscal-series-command.test.ts tests/operator-native-fiscal-series.integration.test.ts tests/india-native-fiscal-invoice.test.ts`
  **21 passed/0 failed/3 explicit native skips/179 assertions**.
- Root exact-target guard regression: prior implementation2 pass/1 fail/10 skips;
  after guard implementation, authority+upgrade source suite4 pass/0 fail/
  16 explicit database skips/37 assertions. No connection is opened by these gates.

## Retained database preflight

Root personally executed only the frozen452 `PreflightReadiness` mode with exact
d598daf0 source-review manifest. New evidence:
`.yellow/evidence/order452/canonical-logs/20260908-113019-212-ef4a9ffd-PreflightReadiness.json`,
SHA256b6d1d524e51ab381ede80b85b04f370f936e155ad8af7c54ba8130149a965acb,
is byte-identical to accepted452 final state. All seven database row/ledger/
catalogue/sequence snapshots and global metadata/roles are unchanged; both proposed
453 names are absent. Postmaster15956/live7568/9508 unchanged;3001 absent.
No database write, target creation, canonical0090, restart or publication occurred.

Actual native results, exact helper/source hashes and later release evidence must
be appended after execution; do not infer them from the planned tests above.

## Published452 CI failure and narrow local repair

Exact557dd031 CI34218945855 completed with five successful jobs and a failed
database job. Independent read-only diagnosis by credit_note_sql_builder found
the canonical88 readiness case using undefined shared deployment before its
initialization in the next canonical89 case. Affected step34/1(267),15.49seconds;
failed case69.97ms. This is a test connection-lifecycle defect, not a claimed SQL
capability failure or an excuse to ignore the failed required job.

Q242 explicitly admitted the narrow local predecessor connection/try/finally
repair without a frontier change. Root inspected/applied it and executed
`bun test tests/build-readiness.test.ts tests/build-readiness.integration.test.ts`:
8 passed/0 failed/33 explicit DB skips/184 assertions; fulltypecheck passed.
Actual repaired database sequence and new-head CI are still pending. No rerun,
successful native453 result or published fix is claimed here.

Additional independent compatibility gate by credit_note_sql_builder:
`bun test tests/india-native-fiscal-invoice.test.ts tests/india-native-fiscal-invoice-issuance.test.ts tests/india-native-fiscal-series-command.test.ts tests/india-native-fiscal-series-authority.integration.test.ts tests/india-native-fiscal-series-upgrade.integration.test.ts`
31 passed/0 failed/16 explicit DB skips/256 assertions; fulltypecheck passes.

## First actual native execution — failed and retained

Root personally executed the exact ec5ed3d8 source-review manifest after Q242's
private admission. Clone/complete after-clone validation passed. The upgrade
suite produced2 passed/2 failed/1 canonical-only skip/21 assertions in5.85s.
Both failures are the actual typed series result-container guard rejecting Bun's
SQLResultArray during fixture preparation, before draft0090 installation. The
drift rejection test passed; this does not substitute for the unreached proofs.

Final receipt `.yellow/evidence/order453/native-logs/20260908-120812-677-a2bc016c-final-state.json`
SHA256f81d4f47ab992a48509cd5bc532c260efe41aa409ceb219fe3925c8ebd280efe
proves2055 original clone rows preserved,2183 final rows,2 incomplete synthetic
cohorts/6 owned codes, unchanged89 ledger/catalogue/functions, no fault helpers,
and complete protected seven-database/global state. Postmaster15956 and existing
live7568/9508 are unchanged;3001 absent. No retry, cleanup, canonical migration
or app promotion followed the failure.

Root's literal/system SELECT in a read-only transaction then observed Bun1.3.14:
Array.isArray=true but a direct Array subclass prototype; own-data result keys
0,length,count,command,lastInsertRowid,affectedRows; ordinary own-data row.
The implementation required exactly Array.prototype and omitted two actual
metadata fields. Evidence `20260908-121333-928-d6854bb2-driver-shape.log` contains
metadata only, no credentials or business values. Q242 Stage C admits the narrow
service/regression repair and source-only retained-candidate continuation helper
preparation. The original failed run is not relabeled green.

The repaired decoder accepts only plain arrays or the observed immediate
Array-derived prototype with one non-enumerable data constructor; it never calls
that constructor. Actual own command/affectedRows metadata is accepted without
reading metadata values. Rows and caller input remain exact plain own-data
snapshots. Both context and result regression fixtures match the observed Bun
shape; proxy prototypes, constructor/metadata getters, extra methods and deeper
or foreign prototype hierarchies fail without invoking the tested traps.

Root personally inspected the repaired service and every added test, then ran
command+HTTP+historical-invoice:22 passed/0 failed/3 explicit native skips,
199 assertions,646ms. Independent credit_note_sql_builder personally executed
the six-file compatibility set:36 passed/0 failed/19 explicit database skips,
334 assertions,853ms; fulltypecheck passed. Frozen service SHA256
736165950d286040ac317a824fb3dc48594d7fb04fa11cd4861ba6e99c7eb874,
command test303a4df47e2751d02cdb875752e9d6c90ac80d520fe15efc45eab9783fbc2e2e.
The worker did not execute this added regression before the repair; no synthetic
pre-fix red run is claimed. The genuine earlier native2-failure run is retained.
These source/model checks do not yet establish actual native success.

## Actual retained-candidate continuation — upgrade accepted, runtime stopped

Root independently executed stamp20260908-123158-354-e044da45 against the same
candidate. Upgrade4/0/1 canonical-only skip(34 assertions,11.25s) proves the real
predecessor weaknesses, five executable-body/default/ACL drift denials and actual
production-migrator late rollback over issued history. Exact draft installation
then passed without ledger fabrication. Authority tests returned9/2(361,15.23s);
the real HTTP stage was not reached. Final structured4a3435b1/raw735021a3 preserve
all2055 original and2183 preceding rows,3054 total,14 cohorts/42 owned codes.
All seven companion databases/global metadata remain16059ea1; fault helpers are
absent and live/postmaster identities are unchanged. Failure evidence is retained.

Root independently inspected both failures and the narrow repairs made by
credit_note_sql_builder: explicit GSTIN ::text reaches the intended duplicate
constraint rather than parameter-type42P18; the owned453 catalogue snapshot
subtracts only relhastriggers. PostgreSQL documents that flag as true if a table
has or once had triggers and describes these flags as lazily maintained:
[PostgreSQL16 pg_class](https://www.postgresql.org/docs/16/catalog-pg-class.html).
The original full trigger rows and function/ACL/owner/config/column/constraint/
policy snapshots remain; the shared452 fixture and production SQL are unchanged.
Root's separate three-file source/HTTP-model run passes8/0 with19 explicit native
skips and101 assertions in831ms. Builder's source checks4/0 with16 DB skips and
37 assertions plus fulltypecheck pass; neither is actual repaired DB acceptance.
Repaired authority SHA256bf70496fc08dcdd7237ec19e0a97f06c623cc8cb108d487474bfb9fe60732361;
fixture b43d30d411dd37cdd0e9d84efd77b951bed5b6b1abf0848ed9dbb38b7ec0bb09.
Q242 Stage D now prepares runtime-only proof from the exact installed baseline,
not another install or predecessor rerun.

Root then executed the separately frozen runtime-only run20260908-125203-310-ed261c75.
It returned9/2(907 assertions,17.47s). The corrected duplicate query passed; a
later unquoted year alias produced42601. Automatic PostgreSQL planner statistics
changed during the fault test, exposing that the snapshot also included physical
maintenance fields. The root-verified final62be2969/raw7938c18b preserves all3054
preceding and original2055/2183 rows:3711 total,23 cohorts/69 codes. All companion
state, installed draft and live identities remain unchanged; no helpers remain.
Q242 Stage E bounds the test-only alias/statistics oracle correction and a fresh
runtime-only admission. No actual signed-HTTP or whole-order acceptance claimed.

## Independent native acceptance

Root personally read the final test-only repairs, reran source/HTTP-model9/0 with
19 explicit native skips/118 assertions, read the full runtime2 helper, then
executed exact manifestdd929905/preflight349f14d6 under Q242 Stage E.
Actual run20260908-130648-854-6f794c85 completed:
- authority12 passed/0 failed/933 assertions,19.87s;
- signedHTTP5 passed/0 failed/376 assertions,6.41s.
This includes genuine simultaneous creation, coherent tenant/current authority
denials and races, advanced-counter replay, property/FY coexistence, both fact
and outbox injected failures, after-publication rollback and signed API journey.
The previous actual4/0/1 upgrade rollback proof remains valid; it was not rerun.

Final structured8ce8a4faddbb694849e53cc8d6d14f4bee1e35f31c6e1e4cc870501f546f5ef0;
raw0a4c694998cc7d1acac3e452757f9c257e1952c818367fe8baa693d552ba9e3e.
4438 rows,10 new/33 cumulative cohorts and99 cumulative codes, every prior2055,
2183,3054,3711 row preserved; installed function and ledger89 unchanged, no fault
helpers, complete seven companion/global state and live/postmaster unchanged.
Root created canonical0090 through apply_patch and verified byte-identical
67802156fe1a35d76023361dc8461699dad204017ff727441523fa9fb2b1faf9 to accepted draft.
Native implementation is accepted; canonical90 release/startup/CI integration
is now admitted in the enumerated scope. No canonical DB upgrade or live release
is inferred from adding a source file, and no failed evidence is erased.

## Populated canonical90 upgrade accepted

Root read all19 frozen helper inputs and all90 migration checksums, then executed
read-only review700453dad3d2f116790b8510781811d85ed5e1b59d90e8045bba1166d46dbc6a
and preflight01fc83973c366c2c07885c548d263dedd093dc4c8daceab8ea2ca6c0978a6a5a.
The initial unexecuted series-absence proof was repaired to preserve originalOID
and fullpg_proc before this source freeze; no product code changed.

Actual Upgrade20260908-140817-544-294d0b7b receipt
0e4946e5dad6103980c486a65b16509c1e2ece6401638cc3a1d050573e664117
applies only0090 to yellow_order446_referee87_20260907, then exact no-op. All2055
predecessor rows except the permitted new ledger row, complete historical89
ledger entries, unrelated functions/catalogue/sequences and protected external
state are unchanged. Total2056; normalized schema
f96a2876e0b350d5e65e6dedcf8345b6cb534bf5b5483f3471dac03498a1a142.
Next PreflightCleanac337ec408fa749e48cbe93a5235bf72be5e36041754a436c0a7919fd7801191
confirms newclean90 absent and live/server unchanged.

Root identified before CleanReferee execution that the helper copied clean89's
1263-row final oracle. Exact old migrated106/final1263 evidence, unchanged seed/
referee and actual one-row0090 delta prove clean90 migrated107/final1264. Existing
helpers and completed receipts remain immutable. Only a separately frozen
finish-only successor is admitted for preparation; no upgrade retry or database
reset is authorized. Fresh/referee/readiness results are not yet claimed.

## Canonical90 fresh installation and runtime-readiness acceptance

Root read the entire finish-only successor diff and freshly revalidated all21
source pins,90 migrations and complete populated/protected state. The immutable
upgrade proof was not rerun. Admitted clean execution20260908-142920-436-38141392
created only yellow_order453_referee90_20260908 on the existing host, migrated
78–90 from pristine77, preserved the old77 ledger/rows and proved exact no-op.
Both actual normalized schemas equal
f96a2876e0b350d5e65e6dedcf8345b6cb534bf5b5483f3471dac03498a1a142.
Unchanged seed and tests/run_invariants.py print11 passed,0 failed of11. New
clean90 has1264 rows,129 tables/119RLS/119policies/28FORCE/2invoker views.

Root then separately admitted and executed readiness20260908-143250-029-5729c88e:
canonical89 denied; current90 accepted;30 retained reader/projector and20 series
metadata/ACL/config/body/signature/result cases each deny and exactly restore.
Every series case additionally preserves complete original pg_proc/OID45442.
Receipt885a62595fcaf12b84fd7e1f339b5332acd4ecb4b72ae02b809e6e2d26b77fd8;
final complete state byte-identical to pre-readiness
b94f0e78a8ae41f99722543f9c352c7f4d15e16045c4d263d9238d5f06030742.
Root separately compared full final.state, schemas and protected pre/post state.
Generated expected.sql is exact f96a2876, obtained only from both actual databases.
The original count-oracle/identity-helper defects were caught before their affected
write modes, not erased or disguised as production defects. No existing app,
other retained database, global role or provider state was changed. Standing,
selective branch publication and exact new-head CI remain open; no main merge.

## First functional-only standing — failed, retained

Manifest936a5eb7/tree4be3e4c7 ran the unchanged four gates in the existing
validation artifact. Full suite1982pass/1458explicit skips/1fail,35419assertions,
548files161.86s; types and boundaries pass. Log148689e458a2eab7e611b119b455b75289008fa1d421c71eb9f74b01bad3af0c
and standing.json passed=false remain immutable. The lone Q207 provider-loading
positive control lacked its error code. Independent credit_document_http ran
active/scrubbed/artifact suites7/0 with1POSIXskip and25 positive repetitions
without failure; no reproducible cause was found. This is an unclassified
transient, not proof that production is unaffected. Q242 admits one sanitized
assertion-message diagnostic and an exact43path successor. No loader/security
predicate changed; no skipped gate or automatic retry counts as acceptance.
