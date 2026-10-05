# Private Kaggle public-source jobs

Operator-driven finite jobs, using the existing private Kaggle Jupyter and Windows
DPAPI adapters unchanged. This is not native T3 execution-factory acceptance.

## Current result - 2026-09-29 local date

All three authorized notebooks resource-checked and connected privately with
24-hour encrypted enrollments. Each has4 CPUs, approximately31.35GiB system RAM
and two TeslaT4 GPUs reporting15360MiB each. All three generated a bounded Qwen
27B public-PR advisory review; no paid-model fallback was used for these calls.

| Worker | Public source | Source tests | Reported prompt / generation t/s |
|---|---|---|---|
| 1 / Ankit G37 | PR97 d708ff29 | four suites,19pass0fail |367.6 /13.4|
| 2 / Arabian Nights | PR94 3aeffa35 | one pass, one original missing-import failure |358.0 /12.8|
| 3 / dcpnode | PR93 cb178fc1 | one suite,5pass0fail |341.7 /13.3|

These speeds are CLI-reported for these small fixed prompts, not a controlled
capacity benchmark. Prompt processing is not output-token generation. Model
findings contain speculation/truncation and do not establish independent high-risk
acceptance. The original failing PR94 test remains in all receipts.

Weights: unsloth/Qwen3.8-27B-GGUF at4ca720788d1e01f1bff70c033e0d0028fd02e502,
Qwen3.8-27B-UD-Q4_K_M.gguf,16464440224bytes,
SHA256322e194ff79741c7baa497c240f677f54b201b0efab44ca8e50f122b39123482.
llama.cpp sourcec8296709920f9c1ae168bfd5fe66f9f73637bd60 /b11216,CUDA SM75.
The first builds fetched an unpinned upstream UI asset fallback; do not describe
the entire native dependency graph as independently accepted/pinned. No web model
server or UI-asset execution was started.

## Local commands

Use Node24 on the configured laptop from this checkout:

    node tools/yellow-harness/worker-jobs/operator.mjs status worker-1
    node tools/yellow-harness/worker-jobs/operator.mjs details worker-1
    node tools/yellow-harness/worker-jobs/operator.mjs proposal worker-1
    node tools/yellow-harness/worker-jobs/progress.mjs

Progress: http://127.0.0.1:38885. Read-only GET/ and/status only. No public tunnel,
execution route, pairing token, model prompt or proposal on the progress page.
The10-step denominator is fixed to seven test files and three model reviews;
setup/download/compilation do not count. A red test is visibly red even after the
batch finishes. This is not whole-harness or Yellow build progress.

Never replay start/recovery commands blindly. One-shot source/claim/result files
are preserved before dispatch, including uncertain execution. Recovery retains
the original build timeout and only resumes after the old thread/owned build has
settled. Worker3's wrong read path was corrected before its only model generation.
No notebook/kernel/browser reset is needed. Generated text is inert; applying it
requires coordinator inspection and ordinary scoped verification.

Private connection material, input selectors, claim files and full result receipts
remain in the approved private host state, not Git. The exact3 notebook identities
and enrollment expiry are validated on every use. There is no arbitrary worker
shell from model output, key export, public relay, live hotel data or paid fallback.

Remote polling stops at completed/terminal nonrecoverable jobs. The local progress
server remains available for the requested view (initial measured working set71.5MB).
The finite model processes exit; accelerator-session shutdown/CPU mode is separate
from that process exit and must preserve reusable artifacts before a session reset.

## Continuation batch `build-0929b`

HARNESS-017 adds a separate finite batch without replacing any original claim,
credential or receipt. All three exact notebooks remain the only identities.
New proposals address Windows build diagnostics, reservation/billing recovery
regressions and market-map lifecycle regressions. Only exact public PR source is
sent; local unpublished repairs and real hospitality data are excluded.

    node tools/yellow-harness/worker-jobs/operator.mjs enroll worker-1 '.drawer-outer-container input[id="OBSERVED_BASE_URL_INPUT_ID"]' build-0929b
    node tools/yellow-harness/worker-jobs/operator.mjs wire worker-1 build-0929b
    node tools/yellow-harness/worker-jobs/operator.mjs resources worker-1 build-0929b
    node tools/yellow-harness/worker-jobs/operator.mjs start worker-1 build-0929b
    node tools/yellow-harness/worker-jobs/operator.mjs status worker-1 build-0929b
    node tools/yellow-harness/worker-jobs/operator.mjs proposal worker-1 build-0929b
    node tools/yellow-harness/worker-jobs/progress.mjs build-0929b 38886

Replace only the fixed worker ID for Workers 2/3. A fresh connection is enrolled
once, encrypted locally and expires in at most24 hours. No command replays a
failed/unconfirmed send. GPU sessions must be off/CPU when no job needs them.
The progress denominator is eight assigned steps (five fixed test suites and
three inert Qwen proposals), not overall Yellow completion. Previous-batch
results cannot contribute to this batch's percentage. Initial runtime configure
disables upstream UI download/build; source/runtime/model hashes remain pinned.
Linux project-status tests do not constitute native Windows process-tree proof.
Observe the provider's base-URL field ID first; the drawer also contains a
different lab URL, which the private-base validator rejects. Capture is bounded
to30 seconds (an actual local capture took23.4 seconds); credential expiry and
kernel execution deadlines are unchanged. `wire` sends one read-only kernel-info
request to the already existing kernel; it never creates/restarts a kernel or
executes code. Resource/job dispatch still requires the sole Python kernel idle.

## Capacity-fit trial `fit-0930e` (HARNESS-024)

One Worker1 trial first: a complete Bun regression file for the exact public
CDP helper, with full helper and existing tests, ten concrete case groups, a
16K context ceiling, 4K output ceiling and 480-second finite generation window.
The input byte bound is conservative, not a measured tokenizer or VRAM proof.
Local packet and 40KB transport preflights occur before private connection access.
Old batch failures/proposals remain unchanged; Workers2/3 are not admitted yet.

    node tools/yellow-harness/worker-jobs/fit-operator.mjs preflight
    node tools/yellow-harness/worker-jobs/fit-operator.mjs prepare worker-1
    node tools/yellow-harness/worker-jobs/fit-operator.mjs status worker-1
    node tools/yellow-harness/worker-jobs/fit-operator.mjs result worker-1
    node tools/yellow-harness/worker-jobs/fit-operator.mjs proposal worker-1

`prepare` is single-use with a pre-send claim. Never replay failures or uncertain
execution. Fresh enrollment uses the existing operator's `fit-0930e` batch and
the actually observed VSCode base-URL field; protected URL expires within24h.
`result` retains terminal log excerpts, NOT a complete proposal. `proposal`
retains the full inert text and verifies SHA256. Parent reads it before any
separately scoped local test/application. Generated code never runs on Kaggle.
The new complete native binary/library set and manifest are copied and verified
in `/kaggle/working` before shutdown; survival of a future session is not assumed.

`fit-progress.mjs` serves only GET `/status` on loopback38887 and polls metadata
once per minute without model calls. It updates the existing PowerShell status
file, marks old/stale evidence as unknown, and stops remote polling on terminal
or ambiguous operations. Its two steps count the baseline and concrete proposal
only, never overall ecosystem completion. Historical38886 remains separate.
