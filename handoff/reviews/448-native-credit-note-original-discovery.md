# Order448 — Independent original-invoice credit discovery evidence

**Status:** native API, Q229 containment and combined local standing accepted;
functional source published as ffb03441. All six CI jobs in34187393111 and normal
CodeQL34187390750 pass. Earlier status/browser failures and their repairs remain
below as history. No local promotion, main merge or Phase7-complete claim.
**Reviewer/executor:** root Codex coordinator, not the implementer of the448 service,
command, route or actual database test. A separate native_helper_release_proof
agent performed read-only source review and did not implement448.

## Source and focused review

Reviewed the exact four-selector snapshot, one parameterized CTE/scalar binding,
non-strict VOLATILE existing read capability, current scope/property grant checks,
concealed absence, exact receipt bytes and method-disjoint GET/POST route. No
implementation blocker was found. The database capability executes even when the
binding is absent, so revoked authority cannot become an unauthoritative null.

The source reviewer found one omitted pure negative assertion: authenticated
discovery without the read token scope. Root added only that403/zero-capability-SQL
assertion, leaving the actual database test body unchanged. Root personally ran:

`bun test tests/india-native-fiscal-credit-note.test.ts tests/operator-fiscal-credit-note.integration.test.ts`

Result: **28 passed, 0 failed, 3 explicit database skips, 434 assertions**.
The skips are not the actual database proof described below.

Frozen application hashes: service9a3559a5b81c5fc065725a43059938a829687634ffa28ebe79883ded2d4374bc;
command78827c51b5c5a5d930c908186e263f43ffa250b16c870ddfa71dd9e0e480a445;
context index0106b855a7ef892885848132cda8adeffccfaef97e166996c930b8b6d307847c;
operator7abe9f78b8e3d4ef8c56407d9ef971c5e6fd92c9e52271965c98e9ddb2557dbd;
appcf4795f62bbb43a582a8ecf7dfdda9869d3b7d93171fa3cf9416507649cd69bc.
The mixed operator/app working files also contain preserved unrelated UI edits;
the selective candidate contains only the reviewed448 imports/method/GET.
Typed test4b7aaf663c4b5b1c1f2a42382dfad62d13749a6e82d89ea071711aa8a2ffa86a.
Original actual-execution HTTP test9faa5faddfa1260d7160610f97405b138dd865f2b54f78935b721020b77d1e3b;
after the additional pure assertion9be09778252338de255376e7960bf17f81b37f49bd06a41b0e2d7c150262b99e.

## Q228 personally executed native proof

Root fully read both private helpers before execution: native-proof.ts
7c4a3f78efe32dfa18c841708f98183de967ef745ae0c0cc932b684ede6d717a and
native-run.ps1 cd1ad4c2b85f3dcea836069ebe03d828f6a853ea7768a32f48596f52de6d7bf3.

First command: `native-run.ps1 -Mode Preflight`. Snapshot
20260907-221325-187-preflight.json SHA256
abf85e7bcf1625e50f3c2f2f3c531c04e1ee8d99521184046fc3d41cb239bf24.
Its canonical snapshot57108e11d5dfe907979360e10e6938257ff59a665475733876e470eb96a39877
exactly matched the retained prior447 after-state. Target actual88/1,375rows,
21 canonical permissions,129tables/119RLS/119policies/28forced/2views; companions
unchanged, zero sessions. PG16.15 port55503, postmaster15956, app7568/9508.

Root separately invoked `native-run.ps1 -Mode Execute -ExecuteAfterHandoff` with
that exact snapshot path/hash. Actual signed-session test passed **1/0/34** in
8.18seconds. It proved404 before issue, genuine authorized credit issuance, exact
receipt equality through credit-ID and original-ID GET, concurrent reads, concealed
foreign/unknown/non-original cases, current grant403, stale-token revocation403,
direct missing-original authorization failure and unchanged complete financial
and fiscal-submission graphs during every read/denial cohort.

Actual log20260907-221507-931-actual-signed-session.log SHA256
65d4b5d5b062a8e08f23c1030b31008cee5227c4eadb368b6a0d73361fd1d3a0.

The wrapper **did not pass**: its final containment guard rejected six global
tx_code additions from the existing ordinary fixture. Every1,375 prior row had
already passed exact multiset preservation, and catalogue/ledger/functions,
outside/companions and permissions remained exact. The two synthetic cohorts
produced1,574 final rows. Saved after-canonical SHA256
d2f3dd4b69f50aaa3ef112864387a87b8c4d8e843f50d69970e9bad0857d863a.
Preservation failure log SHA256
a91dfbe08d28ca28fc31b38abaafa2d8f61497dd9f71c6164d1ecfd7fb51ad6a;
failure JSON3d3e27222e2b46695b698eae41af0d47278edcbc4f51e074ef5ef02df5cf1b0b.
Host identity and absent staging listener remained exact. No retry or cleanup.

Q229 admits a separate read-only post-audit of exactly those six fixture-created
definitions and their exclusive new-cohort ownership; it may not blanket-exempt
tx_code or rewrite this failed wrapper as a pass.

## Candidate and release boundary

Seven-path candidate d0e6ba48fe5b3cda11bfb640d47c61bc657b0b37, manifest
ae99d23a7fe60bb8f838b1c64f85de01d00a5c48d234fdadb1b420cb9fe62361,
diff04641215e895e71b8b629b7c911f2b03d963b3411abdcc2abea9ac0d3725e81d.
Preparation preserved the complete real index and all flags; no source artifact,
dependency copy, runtime or published reference changed.

Q231 admits an exact combined candidate with Q230's independent test-oracle fix,
then standing and publication for source CI. This review does not yet claim that
candidate green, final acceptance, local availability, main merge, provider
activation, UI completion or whole Phase7 completion.

## Q229 actual read-only post-audit — 2026-09-08

Root personally executed the separately admitted post-audit successfully. Final
receipt `.yellow/evidence/order448/postaudit-logs/20260908-031416-267-bd51d0f7-final.json`
has SHA25626101a7c9a05247489e06672ac1bd2e7c159e84718b269c05367ab31ad000fb7;
its audit JSON has SHA2566558d9dfb1685e500e32774f62eda2fa454933bb4b352d9ac659f3ff316766bc.
The final helper SHA256 is9e7cb06f1d63b9975c53b7fce341e8b612b0746b4b25624266680835a53a5ee9.
The two retained failed read-only attempts remain evidence: the first detected
the explicitly reviewed Q230 source-pin change; the second exposed array-parameter
transport. Root's final two-selector repair uses JSON strings and
`jsonb_array_elements_text`, without changing preservation or ownership checks.

All1,375 prior row hashes are preserved within1,574 final rows. Exactly six complete
tx_code additions belong exclusively to the two new fixture cohorts:

| Tenant / property | ROOM | CGST | SGST |
| --- | --- | --- | --- |
| 7c4d9277-882a-403b-b627-f83ba0638589 / 73ace86b-4481-484c-b588-327dc56ccd04 | O434_CFCE3233BFDD | N434_CGST_dc148254da | N434_SGST_56b7df5bfe |
| 918f670b-c8a0-49fc-a3cb-e1a2076df499 / 4dc3d9d4-251f-4bec-9160-7b1bbc15a538 | O434_3ECF03B16AF8 | N434_CGST_5e4b8dbf6f | N434_SGST_38d5bc9ab2 |

ROOM definitions are Room revenue1 / revenue / Rooms / guest→revenue; tax
definitions are their CGST or SGST name / tax / liabilities.tax /
guest→tax_payable. The audited reference census is6 tx_code routes,4 tax semantic
routes,18 posting lines and2 valuation sources; package elements and payment
operations reference none. Ownership checks include the related tenant/property
and account/journal graph, not a blanket dictionary exception.

Both fresh canonical snapshots hash to
ee35062228047f656400e54ec2c62a2d5d061f67324f451ff5134cabbc814120. Against retained
after-snapshot d2f3dd4b69f50aaa3ef112864387a87b8c4d8e843f50d69970e9bad0857d863a,
the sole allowed difference is Q230's tests/build-readiness.integration.test.ts
source hash90adfcd2…→59f51458…; database, catalogue, ledger, outside targets and
host preservation comparisons remain unchanged.

The credit_note_sql_builder agent personally read the final helper selectors,
audit and receipt, independently rehashed all six complete dictionary rows and
reproduced retained-row and snapshot comparisons from saved files only. This is
evidence corroboration, not another database execution or independent approval
of its own LaneA/helper implementation. Q229's bounded post-audit passes; Q228's
original wrapper remains failed and its API result remains1 pass /34 assertions.
No rerun, cleanup, database write or broader release claim is implied.

## Q231 combined standing — retained failed result

Root fully inspected helper validate-combined.ts
fa39620823a2ed1c9a78f70ab297e6535457df1dae40369f66440e23e2ad89c5,
then personally executed it on the single existing source artifact. It verified
all2,065 previous blobs and all2,072 combined blobs, preserved the complete real
index/staging/flags and tracked working source, and reused the existing dependency
junction without another checkout or dependency copy.

Tree c3f69e9a6b173617691a8114dd33090c78247766 contains only the seven reviewed448
functional paths plus Q230's test-only readiness replacement repair from52467d4f.
Full standing: **1,919 passed, 1,407 explicit skips, one failure**,34,347 assertions
across537 files. Log SHA2566060c58ad47c55a2fcb7589ca4ee0ac8cea8bb1bc183df43f6e46883043a80c9.
Typecheck,187 import boundaries and licence gate exit0. The licence gate's local
installed-package census is not evidence of a frozen CI dependency installation.

The only failure is the native Windows canonical-status process exceeding its
existing4,500ms bound after Historical records and before Service output. The
next optional native discovery/Docker/Compose block has no bound; the captured
log cannot distinguish which call consumed the time. Q232 admits the scoped
whole-probe repair and deterministic proof, not a relaxed deadline or silent retry.
No fiscal assertion failed, but the overall standing receipt remains false.

## Q232 independent focused status repair

Root's final scoped native status repair is frozen at state.ps1 SHA256
00d38b22a18e47fc5d2de4fb0e3296970022431c7f7dc9cd25ab99e9ed2bbf6f and
working tests/project-status.test.ts SHA256
63a91d8237d3f64869fd058d7bdd1278b1ebcfff8bd57f3428fd132c694ad461.
Root's full focused run:7 passed,4 explicit Unix skips,0 failed,117 assertions.
The non-implementing credit_note_sql_builder agent personally inspected and ran
the same file:7/0,4 skips,117 assertions,15.72s; typecheck and scoped diff-check
also pass. Both source hashes remain unchanged. New slow-probe cases prove owned
child exit and absent delayed sentinel; success preserves the exact SQL argument.
No blocking scoped finding. The review covers Q232 only, not the reviewer's own
Order448 source. Unix/WSL/native-database proofs were not executed by this review.

Q232 records the earlier hold-process, batch-return, newline/sentinel and natural
exit cleanup failures and repairs. Those attempts and Q231's failed full-suite
receipt remain retained. Previously staged paused UI/history test hunks are not
part of the Q232 unstaged repair. The revised isolated ten-path full standing
suite, source publication and exact-source CI remain pending.

## Published exact functional tree and retained transient failure

Commit ffb03441a16d50aa050c5d6f715d35ed9223601b / tree
e4125e6e01b3e6336717bf6997887d74b7da5ef0 is pushed to existing draft PR92.
Only the seven448 paths plus Q230 and two Q232 paths were published; real staged
UI/history was preserved through exact forward/reverse index projection.

Refreshed standing receipt a40f06ead4b934491501ef3a5e0a7120845d3523231f026e87393bc3668471c0
remains failed:1,920 pass,1,407 explicit skips, one unchanged Order195 seven-browser
geometry case exhausting its existing30s deadline. Root inspected that unchanged
harness and personally ran the same artifact's focused file:5/0(51),8.83s; no
browser/test child remained. The exact transient wait stage is not established.
No UI/deadline edit was made. One explicit unchanged full run then passed
1,921/0,1,407 skips,34,390 assertions across537 files in207.22s; typecheck,187
boundaries and licence command pass. Licence census0 is not CI dependency proof.
Its standing SHA256 is9b0f22c18e15ab120084e52479a7afc668765f4ea4b896626d72ec4446aef28a;
full log62628197ec52d0c530731c039a782f70c70cf41306759f76d8279d5433a281cd.

Root inspected and executed unchanged validator8fa4a23ba985ac328e6f216b0935d2d5825f946a27535b3959e0b38bd76c04b2
and publisherc0b83ceba84e328bd6fc82fb311b6c7c88e3ff4feb1ef41a1fa61a803c14d488.
The non-implementing helper reviewer found no concrete blocking issue after
checking actual filesystem-based gate selection. Publisher manifest
276ebf786d8d91f5da990eb8dc602f7839f3fbb8c498c5cb28123672e4ad3124 pins the
green standing, failed receipts, exact ten paths, complete artifact and unchanged
working/index state. Publication preserves2,071 outside staged entries and all
flags. Exact-source CI remains pending. No native test rerun, main merge, local
promotion, external-provider activation or phase-completion claim.
