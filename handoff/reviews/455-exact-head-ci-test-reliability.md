# Order455 independent acceptance — partial, 2026-09-08

Reviewers: root (Astra) and independent `receipt_oracle_acceptance` (Sol).
Windows independent execution: `windows_test_acceptance` (Sol), not implementer.
No whole-order/source-CI approval yet.

## Receipt disclosure shape — pure proof accepted

Exact test SHA256:
`16056326b64e11372ef018761369abc5131252b03d7aaae3eef94948fa315938`.
Root reviewed the complete delta. The23 allowed top-level fields and9 verification
fields match the accepted public projection. Exact own-key membership/count and
data-property/scalar checks reject forbidden/extra/missing/nested fields without
searching opaque signed values for substrings. Existing authentic signed-pair and
database equality assertions remain unchanged.

Both reviewers independently executed:
`C:/Users/astha/.bun/bin/bun.exe test tests/fiscal-signed-receipt-durability.integration.test.ts`
with all four signed-durability DB gates removed. Agent5pass/14skip/0fail,
3,783 assertions477ms; root5pass/14skip/0fail,3,783 assertions367ms.
The14 database/hook skips are explicit. Actual DB execution and exact-source CI
remain required; this is not proof of those paths.

## Windows helper — not accepted at4eccca91

Exact SHA256:
`4eccca91e4988c4fee3ea0e4794858932f70e54015f38dd1e6ffd3f9560c0c41`.
Independent focused high-output1pass/0fail,8assertions4.235s; focused ownership
negative1pass/0fail,9assertions3.624s. One subsequent full file is RED19pass/1fail,
34assertions49.03s. At line495 the first wrong-start rejection probe exceeded its
1,200ms child bound: null exit, timeouttrue, SIGTERM,0 stderr bytes. No retry.
An earlier anchored pattern matched zero tests; it is not counted as proof.

The guard binds exact PID/parent/start/executable/end-anchored File argument, and
the isolated proof kept the unrelated child alive. The original8,205-byte Unicode
payload on both streams, nonzero7, three retained1,024-byte files/tails and10s
outer test ceiling are preserved. Root admits consolidating only the new negative
proof's three PowerShell startups into one host within its existing8s ceiling;
fresh frozen-source execution is pending.

Original CI34244482395 Windows and database failures remain recorded in Q243.
No production supervisor, crypto, SQL, live app, fixture or provider change is
covered by these test-only repairs.

## Windows consolidated helper — accepted locally, 2026-09-09 local

Frozen test SHA256:
`8d2ca721079bc5ae1a30545261b036f13b45455e529006601afec967bd2ae451`.
Root read the complete test and personally executed the focused high-output case:
1pass/0fail,19filtered,8 assertions,3.33s. Root then executed the complete file once:
20pass/0fail,37 assertions,44.36s, exit0. The consolidated negative case took
2,722.89ms and high-output took3,169.64ms in that full run.

Independent non-implementer `windows_test_acceptance` inspected the same frozen
source and personally executed one complete file:20pass/0fail,37 assertions,
44.60s (wrapper44,677ms), exit0. Source hash remained unchanged. Command for both:
`C:/Users/astha/.bun/bin/bun.exe test tests/order444-native-review.test.ts`, with
bundled native PowerShell first in PATH and `YELLOW_REQUIRE_ORDER444_NATIVE_REVIEW=1`.
Independent transcript: `.yellow/evidence/order455/windows-independent-full-file-20260909T000225+0530.txt`,
SHA256 `b58ae1c3f0c92b504723b1651e2f562d6002d8c5186137a1a0568e67a0952a1d`.

No deadline, Unicode payload, stream cap, tail requirement or identity assertion
was relaxed. No current-run matching process or fixture directory remained in
the independent post-check. Two legacy PowerShell orphans, PID17336/PID7408,
started on2026-09-07 and definitively predate these runs; recorded, not terminated.
This accepts the test-only Windows repair, not a production supervisor change.
Receipt actual-database acceptance and repaired exact-source CI remain open.
Original CI and the older19/1 full-file failure remain retained above.

## Native current81 receipt acceptance — 2026-09-09

Independent nonimplementer receipt_oracle_acceptance inspected the complete
bounded native runner and snapshot helper, including minimal r2/r3/r4 repairs.
Root read them independently and inspected each new preflight receipt. Failed
predecessors are retained: missing optional ledger42P01, culture-sensitive name
sorting, and UTC DateTime string roundtrip falsely adding330 minutes to age.
Each stopped before DB mutation. No deadline, data predicate or financial guard
was relaxed. Final runner0f76edae/snapshot607cc254 use exact bundled7.6.5, protected
fresh receiptebfed650/control-r4 and complete baselinebaa39ec1.

Reviewer personally executed once:
`pwsh.exe -NoLogo -NoProfile -NonInteractive -File .yellow/evidence/order455/native-receipt-current81.ps1 -Action Execute -ExpectedRunnerSha256 0f76edaeb3bfee19ab512ae2d0ceb8316d9c838a06aaf4da90cff1131a4cbd6f -ExpectedSnapshotHelperSha256 607cc254a61380d1b8069c978cae0ca2e4fe0b53c889b5397eed23bdfd64b481 -ExpectedPreflightSha256 ebfed650b6ca8911e84e30ae2c2f5929834ff87a10ef38db78224cc9826bd6fd -RootHandoff`.
Exact executable is the pinned bundled native PowerShell7.6.5 path in the order.

Exit0, wrapper about4m58s; exact78–81 applied once; unchanged test16056326 reports
16pass/one-upgrade-only-skip/0fail,4,177 assertions/17tests/35.07s. It exercises
actual bound signed artifacts, field disclosure, invalid/oversized evidence,
late-write rollback, authorization/tenant isolation and immutable terminal rows.
No authentic external-provider transport is claimed by generated signatures.

Root separately parsed every resulting stage and compared complete companions/
global state, not only counts. Baseline and execute-pre are byte-identical
baa39ec1. All59 prior databases/global state stay equal at77,81-empty and81-post.
Target-only frontier/ledger77→81,127→128 tables,0→12 synthetic tenants and
submissions; final sessions0/residue0|0. Target is retained, no cleanup/retry.
Stage SHA256: target77=18a77f5b794116da5408e1ec1308d18e5b182b6a0cd3f84c6e0b66165464ac1e;
81empty=e4a04c67043d2be8616dec10a1764e3da16792f4ecd88cd82d1c8e9623c9846e;
81post=7faf84ff23119e61318dd7965bee68b6b35786fa017f7b91bdb4f2afb9c87207.
Testlog=a9122b5c4173cbbe4672f10f9ac2caa476cc228b02398e1f2af020d4fc9ef54d;
migrationlog=89f5ab7379379c98a17bb8ae6cdc0b8acb9e47a76f4a899d9179f1e2fc06cea2.

This accepts current81 only. Unchanged CI already has the separately required
80→81 lane; repaired-source acceptance must be17pass/no skips/0fail there.
Exact-source standing/publication/CI and current local promotion remain pending.
