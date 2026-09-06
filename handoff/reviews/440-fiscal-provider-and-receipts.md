# Order440 / Question206 — independent provider and receipt review

## Private lossless decoder — bounded approval2026-09-06

**Builder:** native_resume_builder. **Independent reviewer:** root Codex, who
implemented neither the module nor its tests. Exact scope is only the two new
private files admitted in Question206; the full provider/receipt outcome is not
implemented or approved by this entry.

The builder recorded intentional missing-module red before implementation. Root
read both complete files and personally ran:

```text
bun test tests/fiscal-exact-json.test.ts
initial candidate:11 passed,0 failed,122 assertions,364ms
final candidate:12 passed,0 failed,130 assertions,385ms
bun run typecheck
passed
bun run boundaries
passed:178 TypeScript files
```

Independent adversarial execution nevertheless found a blocking raw/escaped
surrogate flaw in the initial candidate. A raw high surrogate plus an escaped
low surrogate, or the reverse, had malformed UTF-16 source but decoded into a
valid astral character. Both returned success; TextEncoder would replace the raw
half, so the purported original bytes and interpreted identity disagreed.
Root sent both exact constructions to the builder without implementing a fix.

The builder added four permanent value/member-name cases first, reported11 pass/
1 fail, then added raw-source validation before UTF-8 encoding/tree allocation.
Root personally inspected that delta and reran the complete final12-case suite.
Raw source and decoded strings are now separately validated, while the cheap
character-length bound precedes scanning. The previously demonstrated two attacks
also independently reject with invalid_json. Error results never reflect source.

Root additionally executed10,000 deterministic differential cases in a separate
`bun -e` process. PRNG seed90607, recurrence
`seed=(Math.imul(seed,1664525)+1013904223)>>>0`, maximum generated depth5:
null/boolean/safe-integer/string/array/object trees, multilingual and combining
Unicode, controls and __proto__/constructor-shaped keys. Projection of every
successful tree equals JSON.parse of the same JSON.stringify-produced source;
every node/container is frozen and every member map has null prototype.
Number conversion occurs only in this independent safe-integer test oracle,
never the production decoder. All10,000 cases pass; unsafe numbers/changed-cent
collisions/negative zero/huge exponents are covered lexically in permanent tests.

Inspection confirms direct-index number scanning, exact original lexemes, decoded
duplicate-name rejection and no package/network/database/global runtime export.
Permanent tests execute minus/exact/plus bounds for1MiB UTF-8,32 containers and
100,000 value nodes. These are bounded Yellow policies, not claimed provider
limits or a production latency benchmark.

Final SHA256, personally rechecked after execution:

- src/contexts/tax-fiscal/fiscal-exact-json.ts:
  `f6e59232b97171de8270f6cd96a2ca1c2a16ee467f444ddb07983f29f59f1516`
- tests/fiscal-exact-json.test.ts:
  `878cfd19b720776b5ffc3f5939eab79463e990128e56802919dbcc6329c9f01e`

**Accepted only as a private decoder dependency.** Complete standing/current-source
CI remain required before its integration. This does not verify signatures,
provider endpoints/credentials, authenticated transport, persistent artifacts,
authorized receipt reads, invoice printing, sandbox acceptance or Phase7 completion.
Q204's separate exacte439 CI is unaffected; no applied SQL, old scanner, provider,
database, local app or dependency changed during this review.

### Complete decoder standing proof

Root personally awaited the same live session80238 through terminal exit0.
`bun test` with no database environment and no competing local DB proof records
1686 pass,1264 explicit DB/Unix skips,0 fail,22423 assertions across505 files,
101.23s. Log:D:\Yellow\temp\q206-standing-20260906-exact-json.log.
This closes the decoder's local full-standing condition, not exact-source CI or
the full receipt/provider outcome. Later status edits and the separately admitted
JWS builder require their own completed proof; they are not included in this run.

## Private pinned RS256 verifier — independent findings (acceptance pending)

Builder:native_resume_builder. Reviewer:root, who changes neither implementation
nor test files. Root reads the complete module/test and personally executes the
initial13-case suite (13 pass,0 fail,131 assertions). The verifier returns only
signature evidence and explicitly denies that this establishes fiscal acceptance.
The existing decoder is consumed privately; no context export or provider is enabled.

Two independent executable findings prevent accepting that initial green result:

1. WebCrypto accepts canonical RSA SPKI DER followed by four unrelated bytes.
   Root's actual generated-key probe returns a successful factory for this alias.
   The same key can therefore get different recorded fingerprints and evade a
   raw-byte duplicate check. Builder adds permanent trailing-DER/same-key-alias
   regressions and a built-in node:crypto public-key parse/export byte comparison,
   before non-extractable WebCrypto import. No custom ASN.1 parser or cryptography
   is introduced. Root later requires direct reexecution, not the builder result.
2. Bun1.3.14 WebCrypto reports a byte-rounded modulus length. Root constructs
   synthetic RSA JWK public moduli with exact bit lengths and converts them using
   built-in node:crypto. Actual2041/2047 bits are correctly reported by KeyObject,
   but WebCrypto reports2048 and the candidate incorrectly accepts them. Actual
   2049 reports2056 in WebCrypto. Enforce true KeyObject bit length and exponent,
   preserve fixed SHA256/RSASSA verification, and use ceiling bytes only for signature
   width. These are key-boundary probes, not proof of valid synthetic private keys.

Root also tries genuine key generation requesting2049 bits; Bun generates2048.
No genuine non-byte-aligned signing proof is claimed from that request. The builder
removes its similarly misleading test and retains mathematically correct ceiling
width. Exact key-boundary tests and final independent suite execution remain required.

### Final private-verifier acceptance — 2026-09-07

Root personally re-reads the repaired source and executes both previously blocking
probes after the builder freezes it. Generated RSA SPKI with four trailing bytes
is now rejected. Independently constructed public JWK moduli at actual
2041/2047/2048/2049/4096/4097 bits produce exactly the required reject/reject/
accept/accept/accept/reject results. KeyObject's actual bit length, RSA type and
65537 exponent are checked before WebCrypto import; signature length uses ceiling
bytes, not a claim that byte-rounded WebCrypto bits are authoritative.

The same independent in-memory probe generates a genuine2048-bit key and signs
the original compact bytes. A changed-cent payload fails; exact unsafe decimal
lexemes survive; the1999ms/2000ms exclusive upper boundary behaves correctly.
Proxy, revoked Proxy, null-prototype object, function and Symbol inputs produce
bounded failures without invoking getters. All36 independent assertions pass.
These public modulus boundary probes do not claim real non-byte-aligned signatures.

Root personally executes:

```text
bun test tests/fiscal-exact-json.test.ts tests/fiscal-signed-jws.test.ts tests/import-boundaries.test.ts
32 passed,0 failed,301 assertions,3.64s
bun run typecheck
passed
bun run boundaries
179 TypeScript files passed
bun run license-check
23 installed packages passed
git diff --check
passed
bun test
1699 passed,1264 explicit DB/Unix skips,0 failed,22568 assertions
2963 tests across506 files,97.05s; terminal session92728 exit0
```

Full-suite log: D:\Yellow\temp\q206-standing-20260907-jws-final.log.
No competing database proof or implementation edits ran during this full suite.
SHA256 personally confirmed before/after the focused final execution:

- src/contexts/tax-fiscal/fiscal-signed-jws.ts:
  `844072dfc67d2663d4ba1e3aa794ba8edd322621c41f3d4a794867fa73ede27b`
- tests/fiscal-signed-jws.test.ts:
  `ae744cbf50c5de39432fd02f29bce96906e429521f4728735c3fc79903b6f16f`

The separate fiscal_http_acceptance reviewer inspects root's current status
reconciliation against its own PR88/post-merge evidence and finds no mismatch.
It personally executes only the two requested current-management/founder-status
files:7 passed,2 explicit database skips,0 failures,155 assertions. That bounded
status review does not independently review this JWS implementation.

**Approve the two private JWS files and prior decoder for development publication.**
Root is independent of their implementation/tests. Exact-source complete CI and
normal non-author integration remain required. This is signature-only evidence:
issuer/source binding, authenticated provider transport, persistent artifacts,
property-authorized GET, operator printing and authentic sandbox remain unfinished.
No SQL, global roles, provider registration, dependency or stable local changed.

### PR89 publication and native ARM64 execution gap

Candidate3ff6349a73cb47fe689eecf03acb8a427a25e714 is published through PR89.
Independent fiscal_http_acceptance personally reattests all85 canonical inputs
byte-identical to its executed post-merge80 schema/referee11/11 proof and stable
on second read. Ordered mapping digest7763707b6c38f9f873cf67786f841d91c99e2acbb634fa5b771ac7ac41108187.
This is a source-applicability check, not another database execution.

The reviewer detects that the original ARM64 image/referee job never imports
these private helpers. Root records exact scope in Q206, adds a failing wiring
regression (3 passed,1 failed,35 assertions), then an unconditional two-file
decoder/JWS test step after native ARM64 frozen installation and before image
proofs. Existing six jobs, action pins, limits, read-only permissions and cleanup
remain unchanged. Actual ARM64 execution is not claimed by local wiring tests.

Root focused proof:29 passed,0 failed,309 assertions; typecheck/diff pass.
Nonimplementing fiscal_http_acceptance personally inspects the two-file diff and
runs free-host-arm64.test.ts:4 passed,0 failed,37 assertions,86ms; accepts the
bounded correction for publication, not integration.
Frozen workflow SHA5722afc44f44e2813eaf1529d439f2018d2a40cb989643bd95247a5ec9d608ae;
test SHAac4091da86b0b298c1bf6314e96f96cd08538481b6e7c7c207a31ac9f3b9f15d.
Root's same live full-standing session97318 reaches terminal exit0:
1700 passed,1264 explicit DB/Unix skips,0 failed,22573 assertions,
2964 tests across506 files,95.91s.
Log:D:\Yellow\temp\q206-standing-20260907-arm64-gate.log.
The newly admitted invoice-binding implementation starts only after this suite
finishes and is not covered by it. No canonical DB inputs or private JWS files changed.

### PR89 independent integration — 2026-09-07

Reviewer fiscal_http_acceptance personally inspects exact-d300b7c CI34053928779:
all six jobs finish successfully, alongside normal CodeQL34053927038. Native
ARM64 actually executes the decoder/JWS suites:25 passed,0 failed,272 assertions.
Linux full standing reports1701 passed,1263 explicit database skips,0 failed,
22580 assertions; isolated subprocess proof24/0(227) also passes.

The reviewer personally reads genuine current80 wire4/0(230), HTTP10/0(97),
delivery11/0(95), Linux process5/0(29), immutable replay5/0(447), historical
durability19/0(227), containment/readiness19/0(68), all ten compatibility suites,
deployment24/0(69), exact schema and canonical referee11/11. This includes the
fresh-worker recovery case, historical79 denial/current80 admission and hostile
ACL/configuration restoration. Referee records162 commits,118 RLS tables,
two invoker views and100 gapless numbers. Root is recording this reviewer's
personal execution/inspection, not claiming to have rerun these CI commands.

Immediately before ordinary SHA-guarded merge, reviewer confirms exact source
d300b7c7c702303d1e9e89a8736237daca235a07, unchanged base2a0ba41,
OPEN/CLEAN/MERGEABLE state, all required checks green, no review threads and
unchanged normal protection. PR89 is independently merged as
43fc758bf706b40cdf6d3a06e4272ffd8d56193d. Merge parents are2a0ba41 andd300;
tree2a6645fab518b415721a039d8ed620a0b16e4213 equals the tested source and
CI test-mergec85a2e61. No admin/bypass, branch deletion, database or local action.
Post-merge schema/referee is separately admitted in Q206 and remains pending here.

### Original invoice/QR binding — independent review in progress

Builder native_resume_builder freezes source6b0778a1dac71675f16bb564c7f8eabfe82e2d09a8d6945ccadef65bf367584d
and test8fc40312914899b15eb5aedea9cbf264b6ec1b11548a8cc8325d3b347f31ad66.
Its reported missing-module red is0 pass/1 fail/1 error. Root independently reads
both complete files and personally executes the projector/decoder/JWS/binder and
import-boundary suites:58 passed,0 failed,569 assertions,5.35s.

Root identifies a permanent-proof gap despite that green suite: the test described
as an unsafe changed-cent collision uses10000000000000.01 and10000000000000.00,
which remain different after Number conversion. Root's actual Bun probe establishes
that90071992547409.91 and90071992547409.90 do collapse to the same Number while
remaining distinct exact decimals inside the existing14,2 source limit. Builder
is asked to prove valid baseline acceptance and independently re-signed invoice
AND QR mismatch rejection, with an explicit collision precondition in the test.
Number conversion is only an attack demonstration, never the binding oracle.
Final binder acceptance remains pending the repaired proof and independent probes.

### PR89 mandatory post-merge80 proof — personally executed fiscal_http_acceptance

On2026-09-07, after reading the explicit Q206 post-merge admission and confirming
no overlapping full local suite, nonimplementing reviewer fiscal_http_acceptance
personally executed the bounded native procedure. Local HEAD and remote main were
both43fc758bf706b40cdf6d3a06e4272ffd8d56193d; GitHub confirms parents2a0ba41/d300
and tree2a6645fab518b415721a039d8ed620a0b16e4213, identical to tested PR89 source.
No checkout change was made by this reviewer.

Before database allocation, all85 proof inputs were compared byte-for-byte by
SHA256 against binary `git show 43fc758:<path>` output: exactly80 sequential
migrations and scripts/migrate.ts, scripts/schema-drift.ts, tests/seed_fixture.sql,
tests/run_invariants.py, tests/schema/expected.sql. Every input matched and was
rechecked unchanged after execution. Ordered path/NUL/hash/LF mapping SHA256:
`7763707b6c38f9f873cf67786f841d91c99e2acbb634fa5b771ac7ac41108187`.
This excludes the uncommitted binder and all private/dirty governance files.

The exact authorized target `yellow_order440_q206_postmerge_90607` was proven
absent. On existing127.0.0.1:55503, yellow_deploy CREATEDB authority was verified;
template yellow_order434_production had77 canonical ledger hashes,127 public
base tables,0 tenants and0 other sessions. Its connection was closed and an
administrator-side check again found0 template sessions before one fixed-literal
CREATE DATABASE ... TEMPLATE operation. No existing database was reused/reset/dropped.

Only the approved Order442 seed.env/app.env keys were read, inside the proof
process. Exact loopback host,port,roles and no URL query/fragment were validated;
only pathname changed. Credentials were not printed or written to a new file.
Personally executed commands/operations:

```text
runMigrations({databaseUrl:<private target URL>,logger:<quiet>})
  discovered80; applied0078,0079,0080
  backendPid12916; transactionBackendPids12916/12916/12916
pg_dump --schema-only --no-owner --no-comments
  command-scoped PGHOST=127.0.0.1 PGPORT=55503 PGDATABASE=<authorized target>
  PGUSER=yellow_deploy PGPASSWORD=<private in-process value>
normalizeSchemaDump(actual,true); schemaMismatch(actual,expected) === null
psql --no-psqlrc --set ON_ERROR_STOP=1 --file tests/seed_fixture.sql
  same command-scoped target authority; no transaction/observer wrapper; exit0
YELLOW_DSN=<private target URL> PYTHONIOENCODING=utf-8
  python tests/run_invariants.py yellow_order440_q206_postmerge_90607
RESULT: 11 passed, 0 failed of 11; exit0
```

Native PostgreSQL16.15 strict restrict/unrestrict normalization yields exactly
1620228 bytes, schema SHA256
`03796c8d46400892158875f6957525b5ec91e6406e7cb9d3f13787800ee32b8e`.
Canonical78/79/80 hashes respectively remain
`65323a81a999a11e3d55893411c994c0b841af9b0465ca7e80630fd78d0ffae6`,
`b233821d0b683810542f91834458e98f657996268d81bc81398f6c15f86ca52f`,
`2c6b1a82e031470bace7ae8b37a2d67e54497014bd1e82f5364d23a2ce25f250`.
Runner1c744395992ad99cb7eb44c5db811c4edddf2fb1169720aac96445d1042c6354,
normalizer5b3815c3709e23bf5b1dae47ce1f988e6f74f98818be5ae31826e8a63fdd3d36,
seedf8e8147800bc3ee24ba5020b70f95ad77a987c698d3c63dd664ed8d4cba1a409 and
referee2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d
are exact merged inputs, not substituted proof wrappers.

Actual referee checks all11:50-thread exclusive winner1; private-vs-beds result
exclusive1/beds0 with no coexistence;40 contenders yield exactly6 beds; direct
INSERT denied42501;162 commits in0.97s; unbalanced journal rejected at COMMIT and
balanced journal accepted; sealed-day denial;100 invoice numbers exactly1..100;
118 tenant tables/RLS/policies and both security-invoker views preserve isolation.

Final retained target is80 migrations/128 tables/2 synthetic fixture tenants/0
other sessions. Template remains77 migrations/127 tables/0 tenants/0 sessions.
All80 target and77 template ledger hashes match canonical source. Complete role
attributes excluding password data and all membership rows/options were snapshotted
in memory before/after and are unchanged. After owned pools closed, a separate
administrator-side count found0 target/template sessions. Terminal proof session43986
exited0 and the coordinator was immediately notified that no database work remained.

No global role/grant mutation, new cluster, Docker/WSL, live provider, stable-local
restart, existing database change, source edit, commit or push occurred. Only this
admitted end section was appended. This completes the actual PR89 post-merge80
schema/seed/referee gate; it neither reviews/accepts the uncommitted binder nor
claims complete provider integration, receipt persistence or Phase7 completion.

### Original-source signed invoice/QR binder — independent bounded acceptance

On2026-09-07, root remains the nonimplementing reviewer: native_resume_builder
wrote both admitted binder files and repaired the permanent unsafe-cent proof.
Root personally read the complete source/tests and did not edit either file.
Final source SHA256:
`6b0778a1dac71675f16bb564c7f8eabfe82e2d09a8d6945ccadef65bf367584d`.
Final test SHA256:
`b8ff670d47a49be6bc96f37f8a68fc0105c21b83076794d268cf0b4cca14bb33`.
Both were rechecked unchanged before the following personally executed proof.

```text
bun test tests/fiscal-exact-json.test.ts tests/fiscal-signed-jws.test.ts tests/india-irp-issued-wire-candidate.test.ts tests/india-irp-signed-receipt-binding.test.ts tests/free-host-arm64.test.ts
55 passed,0 failed,582 assertions;1429ms
bun -e <independent in-memory generated-key original-source mutation probe>
112 assertions passed; final module SHA2566b0778a1...
```

The additional probe generates its own2048-bit RSA key and fictional checksum-valid
GSTINs from29YELLO0000W1Z and27FIXXX0000Y1Z, never copies real taxpayer/token data.
For genuine IGST and split invoices, it mutates and freshly signs every original
leaf, verifies denial, and separately checks invoice and QR changed-cent collisions
at90071992547409.91 versus90071992547409.90. Those distinct legal decimal amounts
round to the same JavaScript Number; the binder nevertheless rejects the changed
amount. Likewise an independently resigned changed acknowledgement is rejected.
Mathematically equivalent exponent/decimal forms remain accepted without rounding.
This supersedes the earlier test-only comparison that did not actually collide.

Other independently executed cases cover decoded duplicate/prototype-shaped/deep
JSON,64-digit acknowledgement acceptance versus65 rejection, invalid leap/year/time,
input snapshot across await, getter invocation count0, revoked proxies, wrong QR
issuer, exact half-open trust-window boundaries and recursive immutability.
Both providerAcceptanceEstablished and authenticatedProviderSandboxCertified remain
false. Fixed errors expose no key, raw token, original financial content or cause.

Root accepts the private original-source binding semantics. This is not approval
of authenticated transport, SQL retention, receipt reads or provider registration.
The first complete standing remains1715 pass/1264 explicit DB/Unix skips/1 native
status deadline failure (22784 assertions;2980 tests/507files;128.36s). Its unchanged
isolated status proof is5 pass/1 Unix skip/0 fail. Q206 now admits a bounded native
batching correction with no timeout increase; final complete standing and new
exact-source CI remain before publication/integration.

The newly extended native ARM64 command includes the binder after the unchanged
decoder/JWS suites. Root first executes the required intentional red3 pass/1 fail.
Nonimplementing fiscal_http_acceptance inspects the exact workflow delta and
personally passes4/4 (37 assertions) on workflowfe418598.../test216ca2b6....
That proves wiring only; PR89's actual ARM64 result does not execute the new binder.

### Native publication repairs and final complete standing — 2026-09-07

Builder native_resume_builder implements only state.ps1 and its native fixture.
Root independently catches relative .NET existence checks resolving against process
cwd despite PowerShell Set-Location. The new outsider-cwd fixture first reports5
open questions instead of3; builder roots response paths at PSScriptRoot and keeps
both File.Exists and Directory.Exists. Initial pre-batch fixture also fails exact
counts because Path treats literal brackets as wildcards. Both repairs retain
612-to2 batch reduction, anchored/case-insensitive markers and empty-array guards.

Nonimplementing fiscal_http_acceptance personally executes:
bun test tests/project-status.test.ts tests/current-management-demo-status.intentional-red.test.ts tests/founder-status.integration.test.ts tests/free-host-arm64.test.ts tests/owned-proof-process.test.ts
24 passed,3 explicit skips (2 database,1 Unix),0 failed,272 assertions;9.10s.
Final native state SHAea5e84bfa72d466b419fa83d675c27a519a38189dfea71e97f9ec934c8db4f04;
test SHAc489946f6581c7cfcfdbc8810a582c866226d13cf69a7a2bf512c1b05791019a.
Hash comparison before/after is unchanged. The optional symlink branch remains
dependent on native permission; unconditional symlink execution is not claimed.

The next complete run passes native status but aborts an unrelated loaded-folio
browser proof on startup-port EBUSY:1716 pass/1264 skips/1 fail,22800 assertions,
111.12s. Root adds the explicitly admitted narrow transient-reader repair already
used in the appearance/app-bar proofs. Injected transient-before-success red first
records1 pass/1 fail; final personal actual browser proof is3/0(13).
Nonimplementing fiscal_http_acceptance independently reads the delta and personally
repeats3/0(13),2.35s, including actual375/640px atDSF2. Its frozen file hash remains
c54dafc4e29db5d76856c14fd813ddc4a856d1b33c9cdd22168e0d5520e61856.
Only EBUSY/ENOENT mean 'port not yet ready'; EACCES/EIO/unclassified/nonobject
errors rethrow unchanged. Existing geometry, polling,60s deadline and cleanup stay.

After every other agent's proof terminates, root personally runs complete bun test:
1719 passed,1264 explicit DB/Unix skips,0 failed,22813 assertions;
2983 tests across507 files in109.65s. Both failed logs remain retained.
Types pass;180 import-boundary files and23 installed package licences pass.
Current-status regression intentionally fails0/1 against old PR89 state, then
passes7/0 with2 explicit database skips and158 assertions after exact reconciliation.
Fresh all-six CI must execute actual databases and the new native ARM64 binder;
this accepts publication, not merge, activation, complete IRP or Phase7 closure.

## Q207 independent production, SQL81 and executable acceptance — 2026-09-07

Reviewer: fiscal_http_acceptance, independent of all production and migration
implementation below. Authority: Order440 and Q207, including its explicit
new-only native proof targets and test-only reviewer ownership. I personally read
the receipt/provider/repository/worker, read-service/HTTP, protected deployment
loader/server composition, readiness and complete prospective81 SQL/contracts.
I authored only the admitted signed durability proof and signed fixture repairs;
I did not change production SQL or production TypeScript. This section records
my own execution, not implementer-provided test results.

### Retained defects and exact scope of their correction

1. The original receipt byte boundary used a repeated base64 quartet expression.
   My 121 independent checks produced117 pass/4 fail: valid raw6MiB minus1/exact
   and decrypted4MiB minus1/exact were rejected by Bun/JSC's regex budget. Root
   replaced it with bounded decode/re-encode canonical validation. My rerun was
   121/0 and the permanent five tests were5/0(44),271ms. The original source was
   f11d77ea1f362e3b1c64f0c63d17819e6cb6c3b835bede292c69105788aa433d;
   repaired boundary source5f48d70f7d8cfef3576b60e801df410b409b38d78670c9cc82051ca73ca0088c.
   Later DTO additions are mapped to the current complete module below.
2. The original signed suite fabricated its purported legacy row after81. That
   was not an80→81 preservation proof. I replaced it with explicit new unsigned
   INSERT/UPDATE denial and genuine old-function histories before the runner
   applies81. Static findings also required a same-tenant role join, all sensitive
   column privilege checks, actual ancestor/foreign-role fixtures and late-write
   rollback. Root made the production repairs; I executed their proof.
3. Frozen prospective81 SHA8412f2a5bac88013e945e5717e95867745ec490076844b0a932a8d8c67392891
   failed my actual hostile PUBLIC column-grant probe. Its canonical transaction
   reached an appended assertion after real DDL and demonstrated surviving head
   wire_text/history response_sha256 privileges; the entire81 transaction rolled
   back. My positive-control predicate then proved NULL status, disposition and
   resolution-source acceptance. An earlier prepare:true JSON-scalar control was
   invalid and is explicitly discarded, not represented as a successful probe.
4. Root's next1388130ef72c0f17a3a253d993d160f65cb0ab14ff1ff649c4128b415c919813
   corrected those cases, but my valid accepted/rejected/CNL controls exposed CNL
   reconciliation_reason=NULL still passing. The transient81 transaction again
   rolled back completely. Root's final IS DISTINCT FROM correction is applied
   and frozen as d2e4e34a4587f4ee12ed5c43f8fac9d4186345877bdbb75ac74217460f0e06ac.
   No applied1–80 bytes or migration ledger was rewritten.

Retained owned migration-copy artifacts, never canonical edits:

- hostile ACL: C:/Users/astha/AppData/Local/Temp/yellow-q207-hostile_acl-6xOLQI;
  copied81 SHAef2515f58072f5bf4dcaedce37687900dab79b20fa3bc413509c27855df3ea40.
- late rollback: C:/Users/astha/AppData/Local/Temp/yellow-q207-rollback-4BJ5XU;
  SHA c44834d2cfb0c000d64af17188ae7820b830feeda28e012926443b7e0e0a8f25.
- canonical: C:/Users/astha/AppData/Local/Temp/yellow-q207-canonical-frjrc7;
  copied81 matches frozen d2e4e34a above.
- checksum drift: C:/Users/astha/AppData/Local/Temp/yellow-q207-drift-yDPCls;
  SHA9b7eb1c98e9e65ca54f900e2bd1655e8d7add034f8ac9dc9f2f77e1843d8f8dd.

### Personally executed genuine SQL81 upgrade and empty81 acceptance

Only the named NEW-ONLY databases were created on existing127.0.0.1:55503 from
yellow_order434_production. Before each creation I proved absence and pristine
template77 with all77 canonical checksums,127 tables,0 tenants and0 sessions.
Protected deploy/runtime URLs were read in process from the admitted Order442
seed.env/app.env keys; only pathname changed. URLs/passwords were never printed.

Command: bun test tests/fiscal-signed-receipt-durability.integration.test.ts,
with command-scoped YELLOW_ORDER440_SIGNED_DEPLOY_DATABASE_URL,
YELLOW_ORDER440_SIGNED_RUNTIME_DATABASE_URL and YELLOW_REQUIRE_ORDER440_SIGNED=1.
For yellow_order440_q207_upgrade_review_90607 only,
YELLOW_ORDER440_SIGNED_APPLY_UPGRADE=1 enabled real80-before81 setup. Canonical
78–80 first applied using one backend11476. The full proof then recorded actual
accepted/rejected/known-not-sent/in-flight/pending histories under old80 functions,
original request plus every one of three explicit retry keys, and complete eight
table snapshots. Hostile migration ACL rejection, late canonical-DDL rollback,
actual81 application, no-op, checksum drift rejection, byte-identical historical
replay/read projection and continuation of an old in-flight token all passed.

That complete run is retained as **11 pass,3 fail,459 assertions,56.21s**, session61020,
not relabelled green. Three fixture expectations were wrong: DateStyle was exactly
ISO,YMD (not ISO, YMD); the initial property had no ancestor; an unsigned INSERT
had untyped jsonb_build_object parameters and failed42P18 before the guard. I fixed
only the admitted test: exact catalogue text, a genuine ancestor and explicit SQL
casts. Failed test SHA697e9f5c271a4838bb5fe5521888e8d7b9b4cb366300049760f56987d4daac7e;
final test SHA f89a87b9fa9ae9891b558fbbe0faf38cafb8926ce73a9b51c231ec9cca753065;
fixture SHA8ed391f7a4a245010a34252489fe928598b8013119470cd9be304ab718fd9136.
The retained upgrade target remains81 with17 synthetic tenants; no reset/re-run of
its whole empty-target setup is claimed. Current CI must execute the final complete
upgrade suite on a new80 clone.

Separate yellow_order440_q207_sql81_review_90607 was then created new and migrated
78–81 canonically on backend7408. With APPLY_UPGRADE=0 the complete empty81 suite
passed **13 pass,1 explicit upgrade-only skip,0 fail,338 assertions,43.41s**,
session88160. All three corrected cases passed here. Coverage includes actual
source-bound signatures, private byte/hash retention and public variant privacy,
all-column ACL and direct-write denial, genuine ancestor/sibling/child/foreign-role
and revoked/inactive grants, unsigned new terminal INSERT/UPDATE55000, late
history/fact/outbox23514 with complete eight-table rollback, all three valid
terminal controls and NULL/mismatched bindings, both byte ceilings minus1/exact/+1,
BOM/invalid/overlong/surrogate UTF-8, and non-due/non-retry CNL with blocked day close.

### Actual authenticated-protocol simulation → worker →81 → authorized GET

This is real adapter/crypto/SQL/HTTP execution against a trusted synthetic fetch
and generated RSA/AES keys, not an actual provider account or certification.
Protocol fixture SHA148a62cdc985356b4275e81b16391f091236b317a9e41cd0d00068c4e9c84440.
The original journey a26a49a0f0b8a6f73d737878d201240e96f47beb94c520de4801cdc5ba8f64c4
failed **1 pass,3 fail,15 assertions,13.23s**: immediate new-worker lookup correctly
returned idle/busy during the database15-second guard. No production bypass was
made. The builder repaired only timing: assert that immediate idle result and zero
auth/POST/lookup delta, poll the exact tenant/submission database due expression
read-only within20s and the unchanged60s test deadline, then construct another
fresh adapter/worker. No DML lease-aging or reset was used for this journey.

On the same admitted synthetic target, my complete repaired command
bun test tests/fiscal-signed-provider-journey.integration.test.ts passed
**4 pass,0 fail,43 assertions,60.49s**, session45876. Final journey SHA
a48fd9c2efb633475a1bc42be12a24022fdca5005dfc8e0ed8e093a47cee3b35.
It covers response-loss then original-wire lookup without another POST, rejection,
CNL and genuinely signed source mismatch remaining unresolved. Recovery metrics
are three adapter instances, two authentications, one POST and one lookup. The
current receipt module8c52c013 (full hash below) handled its authorized GETs.

Separate bun test tests/operator-fiscal-submission-receipt.integration.test.ts
on the same isolated81 target passed **6 pass,0 fail,83 assertions,5.54s**: five pure
cases and genuine signed-session/database GET. It proves pending→accepted signed
DTO, exact no-store response, no raw/decrypted/source/claim secrets, missing/foreign
404, current scope/property/revoked403. Test SHA
9444a16ac34144d073dd890f535fbc5f90812a7e621c9a4631aa31229da0c05f.
That earlier standalone run used receipt modulebd2ed0daa9092e86cd916dcb89368ba2b3e27dbc28d219d97b4959b617a7a008;
the later full journey and current focused tests execute the hardened8c52 module.

### Actual runtime authority, clean schema and canonical referee

I personally invoked assertRuntimeReleaseReadiness through the real yellow_runtime
pool on81: **19 assertions passed**. Six separate committed target-local grants
covered app_role/PUBLIC/yellow_runtime × head.wire_text/history.response_sha256.
Each real runtime probe refused readiness. Unconditional precise REVOKE removed
only the added grant; baseline readiness and exact full relation/attribute ACL
snapshots were restored after every case. No global roles/memberships were changed.
Readiness source68b0a7377771ec33e4baf8721dc3b7a27744f6833d110067200772e9aad7de86
was unchanged before/after and remains current.

Native PostgreSQL16.15 pg_dump --schema-only --no-owner --no-comments, followed by
the canonical normalizeSchemaDump(stdout,true), produced identical clean schemas
from both independent81 targets: **1,645,755 bytes**, SHA
60b969a970baa8746f54b5f79eb8a3d5aa08bfafa0ceec1ffaa0dd2bd6f3e83a.
Artifacts: D:/Yellow/temp/q207-schema81-review-2dsder/, filenames
yellow_order440_q207_sql81_review_90607.normalized.sql and
yellow_order440_q207_upgrade_review_90607.normalized.sql. Neither contains residual
fault DDL/ACLs; all63 head/history effective column privileges match. Root, not I,
mechanically copied that identical artifact to tests/schema/expected.sql.

The separately admitted NEW-ONLY yellow_order440_q207_referee_review_90607 was
created after another absent/pristine77 check. Canonical78–81 applied on one
backend7652 and its81 ledger hashes matched source. Its dump exactly matched the
frozen expected schema above. I then personally executed the **unwrapped** native
psql --no-psqlrc --set ON_ERROR_STOP=1 --file tests/seed_fixture.sql (exit0), then
Python313/python.exe tests/run_invariants.py yellow_order440_q207_referee_review_90607
with command-scoped YELLOW_DSN and UTF-8 output. Session22425 exited0:

    RESULT: 11 passed, 0 failed (of 11)

Concrete referee results:50-thread exclusive race exactly1; private-versus-beds
0 private/6 beds;40-thread six-bed race exactly6; direct insert42501;162 commits in
1.20s (135/s); unbalanced journal rejected; balanced journal commits; sealed day
rejected;100 gapless numbers1–100;118 tenant tables with RLS/policies (A16/B0);
two security-invoker views (A2/B1). Final clean referee target81/128 tables/2 tenants.

All86 canonical input hashes remained identical before/after (81 sorted SQL paths,
migrate.ts, schema-drift.ts, seed_fixture.sql, run_invariants.py, expected.sql),
ordered path+NUL+SHA+LF map SHA
a3a9b2d0f0f681898e85b600c7bcd53206dc0433119a1705987565e7087009df.
Canonical1–80/runner/normalizer/seed/referee matched merged4ba1d6f bytes. Individual
runner SHA1c744395992ad99cb7eb44c5db811c4edddf2fb1169720aac96445d1042c6354;
normalizer5b3815c3709e23bf5b1dae47ce1f988e6f74f98818be5ae31826e8a63fdd3d36;
seed f8e8147800bc3ee24ba5020b70f95ad77a987c698d3c63dd664ed8d4cba1a409;
referee2afa95bb7c02cd9637ffc9c3df00d1ddf7cfc5d8d31c4fd8fad29b950c1a418d.
Template remains77/all hashes/127 tables/0 tenants; exact global pg_roles attributes
(excluding password) and pg_auth_members snapshot SHA remains
1a404b9f0aa6c85deaf9ee4d9db2351be8327733b8d1b2f88f6b5221e2a9496e.
All target/template sessions were empty after each proof. Existing databases and
stable preview were preserved; no new cluster, role, Docker, WSL or provider call.

### Current focused production review and proof

The public receipt boundary now inspects data descriptors on outer driver Arrays,
rejects proxies/accessors without evaluating length/index traps, accepts legitimate
Array subclasses/metadata, freezes detached DTOs and rebinds tenant/property/submission.
HTTP uses its existing session/tenant transaction and current property grants;
the reader receives actor identity explicitly. No adapter or idempotency key is
needed for a read. The repository commits claim before transport and uses a fresh
short reconciliation transaction. Original source and whole wire are retained for
fresh-worker lookup; unsigned new acceptance cannot become a terminal receipt.

Protected loading is default-off, exact duplicate-rejecting bounded JSON and real
adapter construction only, with no network activity while loading. Files are read
through opened handles with type/inode/size/time and final-path checks; POSIX adds
NOFOLLOW/NONBLOCK and owner/mode restrictions. Windows DACL protection remains an
explicit deployment requirement, not a claim inferred from POSIX bits. Invalid
configuration fails sanitized before pools/listening. The same frozen registry
drives HTTP availability and workers; the independent worker switch remains off.

Personally executed one command, bun test, with these13 exact files:
fiscal-submission-receipt.test.ts; fiscal-submission-worker.test.ts;
fiscal-submission-commands.test.ts; fiscal-submission-state.test.ts;
fiscal-submission-adapter-availability.test.ts; fiscal-submission-delivery-runtime.test.ts;
india-irp-provider-configuration.test.ts; fiscal-exact-json.test.ts;
fiscal-signed-jws.test.ts; india-irp-signed-receipt-binding.test.ts;
build-readiness.test.ts; operator-fiscal-submission-receipt.integration.test.ts;
server-fiscal-runtime.test.ts (all under tests/).
Result: **124 pass,8 explicit DB/Linux skips,0 fail,1197 assertions,4.47s**.
No DB URLs were configured for this command and no full standing suite was run.
The retained independent in-process receipt121 and worker/repository45 adversarial
probes also passed again on current source. These cover getter/proxy/descriptors,
UTF-8/BOM/base64 canonicality, acknowledgement calendars and unsafe integers,
deep freeze, exact max−1/max/+1, source/wire hash binding and transaction ordering.
The18MiB envelope positive boundary is unreachable under its constituent limits:
the constructed maxima are16,791,817 bytes; direct18MiB positive coverage is not claimed.

Current reviewed production SHA256 map:

    fiscal-submission-receipt.ts 8c52c0137618a76e879c2259ce52f848b7fa00b736fb244c10bc2d8c43292687
    fiscal-provider.ts c490079d6fe36a5bcd9d171bd621ccac48d7d2b2b7911257c9ecacd3af330e53
    fiscal-submission-repository.ts f308b1d6223f569e3993b26d05d1e0f2bc0f4acc44b6d9b168ef12c7663d2e36
    fiscal-submission-worker.ts d7ffcdc84a00f55210d3268fb5eec8bb683c3aac14964b776e1aefca48566ab1
    kernel/build-info.ts 68b0a7377771ec33e4baf8721dc3b7a27744f6833d110067200772e9aad7de86
    http/operator.ts eb2041b6970e72c04b4eba388589a0b292a3ad97f20c3c7ccabdebc662b1b900
    app.ts 72894b0fbf9770c906bff221172f44aa3bbb4afc8764add4a9c43476b4a322f3
    server.ts 073f63af06dae0c7a2351eb971ab529881b839c474cbea2654566595b95c79e6
    tax-fiscal/index.ts 09b5fed38185f1ee80dfcf02731d617e1b4a486a5a6d56b61d3218d45d3bf59c
    india-irp-provider-configuration.ts 66a40600a08845b9a89ca9876282fb7d041eb156efc6d47560035639641f2a53

Receipt test SHA5f43d8074f699af17e4514d4cb004da09b374e467a8d37f6efbc2d1341f1b574;
loader test cfbc09031e1f383571fee121b53c9b317eff149a8b6ccf084986bf7c937c43e7;
server test c03df61be3d9fbf20455a4e5391998d12024dddef5a896b8116b51b5aa8ee6ae.
No new production blocker was found in this bounded review. This is not overall
publication/integration approval: the following current compatibility failure and
all exact-source CI/ARM/Linux process/POSIX gates must be discharged first.

### Current81 compatibility failure retained — not waived

I inspected the admitted current-runtime fixture/test and historical78 test delta.
The successful lookup transport budget100→5000ms is limited to real signing after
an abandoned lease, not a timeout test; production lease15s and outer60s remain.
The max-one-pool commit-before-transport assertions are moved to current81, while
the old78 suite explicitly requires zero transport and full claim rollback.

New-only yellow_order440_q204_signed_review_90607 passed absence/pristine77 checks;
the canonical runner applied78–81 on backend13328, all four transactions on that
backend. I executed the **complete** bun test
tests/fiscal-submission-delivery-runtime.integration.test.ts with command-scoped
YELLOW_ORDER440_DELIVERY_DEPLOY_DATABASE_URL,
YELLOW_ORDER440_DELIVERY_RUNTIME_DATABASE_URL,YELLOW_REQUIRE_ORDER440_DELIVERY=1.
Session57297 recorded **6 pass,5 fail,88 assertions,31.23s**. Earliest failure is
line305: expected accepted/none but actual submitted/lookup. All five signed-success
paths failed similarly; discovery/denial/unavailable/deactivation passed.

The concrete fixture defect is createFiscalProtocolAdapter's result.verified check:
createSignedFiscalReceiptFactory.accepted intentionally returns a repository
reconciliation envelope with no verified property. The new adapter fixture rejects
every genuine signed factory result before converting it to the provider envelope.
The worker correctly treats that thrown transport result as unknown; this is not
a production acceptance bypass. I reported the defect without editing production
or the builder-owned fixture. Failure hashes: runtime fixture
d03820ede8edf6ddd7f412815216deb9c9572269e5d41311e332afe6e8d18af3;
runtime test4d8c1b3ca0ba3540f6087683bde1d0af63df933a5aa290a14235c5f60be0382c;
historical test6fdffc8f6f4e56db353c70b501d9147d176d59b8b058ea4efb2491e5da621a88.
Target is retained81/12 synthetic tenants/0 fault constraints; all reviewed hashes,
template and global metadata preserved, sessions[]. The harness stopped before
allocating the separately admitted historical target. No retry/reset is claimed.

### Historical77→78 compatibility — independently green

The unaffected historical proof then proceeded under its existing admission.
yellow_order440_durable_signed_review_90607 was still absent; after another exact
pristine77/checksum/zero-session check I created it once and left migration78 to
the full canonical durability suite's own genuine runner. Command:
bun test tests/fiscal-submission-durability.integration.test.ts, with only
command-scoped YELLOW_ORDER440_DURABLE_DEPLOY_DATABASE_URL,
YELLOW_ORDER440_DURABLE_RUNTIME_DATABASE_URL,YELLOW_REQUIRE_ORDER440_DURABILITY=1.
Session95668 exited0: **19 pass,0 fail,227 assertions,77.22s**.
The current worker's missing-source refusal passed with no provider calls, exact
delivery/finance preservation and a reusable, settled single-connection pool.
All original historical SQL, authority, concurrency, retry, late rollback and seal
ordering cases passed. Final target78/18 synthetic tenants/0 fault constraints;
all canonical and reviewed historical/production hashes remained unchanged,
template77/global metadata stayed exact and remaining target/template sessions[].
Historical test SHA6fdffc8f6f4e56db353c70b501d9147d176d59b8b058ea4efb2491e5da621a88.
This proves intentional current-binary incompatibility on78, not current receipt
support on78. The failed original current81 target remains untouched.

### Repaired current81 compatibility — independently green

After the explicitly admitted fixture-only repair I inspected its complete delta.
The factory result must have exactly its ten reconciliation keys, the correct
transport/lookup type and matching tenant/provider/attempt/document/payload hash;
only after genuine RSA/signature/source binding succeeds is it projected to the
five-field provider resolution. No production validator or applied SQL changed.
The new pure regression projects an original source, generates real signatures,
uses the actual worker and verifies its normalized reconciliation envelope.

Frozen fixture SHA64941395887ee2a5a5a5a248b14631df1e97ff4068de07fa28d72338c0d6e810;
runtime test SHA70d7fffe4771b5d007718c0a2af8781d4a6ac2e19d075dc6dc21893a492471cb.
New-only yellow_order440_q204_signed_repaired_review_90607 was absent. After another
pristine77/all77 checksums/127 tables/zero tenants/zero sessions check, I created it
once and applied canonical78–81 on backend5616, all four migration transactions
using that same backend. I executed the full runtime test command and the same
required command-scoped delivery environment as the failed run; no test filtering.
Session61636 exited0: **12 pass,0 fail,104 assertions,30.42s**.

All five former failures pass: one-connection claim-commit-before-provider plus
cleared tenant/transaction state, competing workers with exactly one submit,
aborted/late result ignored before signed lookup, a newly constructed worker's
original-wire lookup without resend, and signed acceptance only after explicit
known-not-sent retry. Genuine signed receipt/QR/head binding and financial snapshots
pass. Discovery/current-role denial/keyset bounds/unavailable/deactivation remain
green. The new pure factory-to-worker regression also executes (122.31ms).
Final repaired target81/12 synthetic tenants/0 fault constraints. All86 canonical
inputs and17 frozen reviewed production/test hashes remained identical; template77
and the global metadata hash above were unchanged. Target/template sessions[].
The earlier failed current target was neither reset nor reused. The serial heavy
database lane is now closed; root was notified before beginning its standing suite.

Disposition: no remaining finding blocks the bounded reviewed production/SQL81
source or these repaired compatibility changes from development publication once
the coordinator's remaining repository gates pass. This is **not merge approval**.
The exact published source must still pass full all-six CI, normal CodeQL, native
ARM64 crypto/protocol and actual Linux process/POSIX loader proofs, genuine current81
database/schema/referee/readiness gates and the final complete new80→81 upgrade
suite. The latter's local11/3 original run remains honestly distinguished from its
passed upgrade case and fresh81 discharge. No live provider registration, production
activation, native-preview promotion, Order440 completion or Phase7 closure is claimed.
