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
