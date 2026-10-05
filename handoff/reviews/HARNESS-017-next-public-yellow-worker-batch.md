# HARNESS-017 — Parent execution evidence (not independent acceptance)

29 September 2026, initial live receipt. This supersedes no earlier receipt or
denial. Codex is the parent operator; Kaggle/Qwen performs the assigned remote
work. No paid implementation/review worker was substituted.

## Fresh connections and dispatch

The owner restored Worker 2's normal Arabian Nights sign-in. Its earlier denied
operations remain retained; no denied method, browser restart or stop was retried.
Each new provider-issued connection was read only from the corresponding Kaggle
Jupyter Server drawer, encrypted using the unchanged CurrentUser DPAPI adapter,
and bound to its exact owner/notebook and the separately named `build-0929b`
batch. Credential expiry remains at most 24 hours. No connection URL, token,
password, raw browser dump or private pairing material belongs in this receipt.

The existing read-only `kernel_info_request` primitive confirmed each live
Python kernel. It creates/restarts no kernel and executes no source. Resource
and job dispatch still require a unique idle Python kernel. New pre-send claims
are single-use; no preceding enrollment, batch receipt or claim was overwritten.

All three resource checks confirmed four CPU threads, about 31.35 GiB RAM and
two Tesla T4 GPUs (15,360 MiB each). Workers 1 and 2 retained the pinned Qwen
weights; Worker 3 requires a new pinned download. This is not model-ready proof.
All three new starts returned `state: running` and distinct owned temporary job
roots. Setup browser sessions were then closed to reduce laptop RAM use; this
does not stop the separately running remote jobs.

## Fixed source and actual test results

| Worker | Exact public source | Assigned tests | Observed result |
| --- | --- | --- | --- |
| 1 | PR97, `d708ff29e2e44df74a5c1a12e58a8cf656b14c8d` | `tests/project-status.test.ts` | 9 pass, 2 Windows-only skips, 0 fail |
| 2 | PR97, same revision | finance entry; reservation lifecycle; command surface | 8 pass, 1 fail, 0 skip |
| 3 | PR93, `01c9ffa4d35894c29c93bf66556d6c26848a24be` | `tests/operator-market-map.test.ts` | 9 pass, 0 fail |

Worker 2's retained failure is `Missing source boundary: function MovementGrid`
in the finance-entry test. It is evidence about the pinned public revision,
not proof that a newer local candidate has the same defect, nor an accepted fix.
Linux project-status results do not prove native Windows probe-tree cleanup.
Tests use pinned Bun 1.3.14 and a frozen install with lifecycle scripts disabled.

## Model work and progress

Each worker is preparing `unsloth/Qwen3.8-27B-GGUF`, revision
`4ca720788d1e01f1bff70c033e0d0028fd02e502`, file
`Qwen3.8-27B-UD-Q4_K_M.gguf`, 16,464,440,224 bytes, SHA-256
`322e194ff79741c7baa497c240f677f54b201b0efab44ca8e50f122b39123482`.
The runtime remains llama.cpp b11216, exact revision
`c8296709920f9c1ae168bfd5fe66f9f73637bd60`, CUDA SM75. Both upstream UI
download/build flags are off from initial configuration. Subprocess trees and
the complete job retain finite deadlines.

The three bounded outputs are inert patch/test proposals for diagnostics,
reservation/billing regression coverage and market-map lifecycle/provenance.
They are not executed, applied or accepted automatically. At the initial live
snapshot, five of eight assigned steps finished (62.5%); the three model outputs,
their hashes and GPU shutdown remain pending. Setup/compilation does not add
completion credit. The preceding 10/10 batch cannot inflate this batch's count.

The loopback-only, metadata-only live view is `http://127.0.0.1:38886/`.
It has no public relay, shell, pairing interface or proposal-execution endpoint.
At 07:21 UTC all three workers were still in `model-runtime-build`, with no new
model proposal produced. The obsolete preceding-batch progress server at port
38885 was identity-checked and stopped; its receipts and the live app were not
changed. Only the new progress server at 38886 remains needed for this batch.

The app confirmed an active five-minute thread follow-up,
`finish-current-three-worker-kaggle-batch`, for terminal-result capture and idle
shutdown. It stays quiet on unchanged state, prohibits retries/paid fallback and
generated-code execution, and pauses after the three finite jobs are accounted
for. Creation confirms monitoring is configured, not that its later capture or
shutdown actions have already succeeded.

## Parent checks

After the batch changes and metadata-handshake guards:

- `node --test tools/yellow-harness/worker-jobs/test_operator.mjs tools/yellow-harness/worker-jobs/test_progress.mjs`: 11 pass, 0 fail.
- `python tools/yellow-harness/worker-jobs/test_owned_job.py`: 10 pass, 0 fail.

These tests cover batch identity/expiry, cross-batch credentials, metadata-only
kernel selection, retained claims, inert outputs and honest progress. They do
not constitute independent security acceptance or prove the full harness ready.

## Terminal capture and idle shutdown — 29 September 2026

At 07:41 UTC all three jobs were terminal. Their runtime compilation subprocess
trees hit the unchanged 1,500-second cap and returned `TimeoutExpired`. The
bounded model-generation step never started; no proposal or model-review log
exists to inspect or hash. Do not interpret retained model weights, passed
tests, or a late compilation percentage as working Qwen inference.

| Worker | Terminal receipt timestamp (UTC) | Finished assigned steps | Retained runtime evidence |
| --- | --- | --- | --- |
| 1 | 07:22:23 | 1/2 | Build interrupted in mtmd/qwen2vl and chat-peg-parser; project-status test log retained |
| 2 | 07:30:03 | 3/4 | Build interrupted in CLI targets; all three test logs retained, including the finance-entry failure |
| 3 | 07:34:33 | 1/2 | Build interrupted in common/arg and mtmd/minimax-m3 targets; market-map test log retained |

Each final read-only `inspect-runtime` receipt reported `ownedBuildProcesses:
[]`, no retained binary, `runtimeVerified: false`, `weightsVerified: true`,
`sourceVerified: true`, `generatedCodeExecuted: false` and `sourceApplied:
false`. This accounts for the owned jobs, not unrelated/shared processes. Source
and model pins, single-use claims and encrypted enrollment expiry stayed
unchanged. No job was replayed/retried, no model substituted, and no paid-worker
fallback or generated-code execution/application occurred.

Detailed failure/test receipts and their read-only inspections are retained at
`D:/Yellow/harness/state-workspace/artifacts/`. SHA-256 digests:

- Worker 1 details: `worker-1-jobs-build-0929b-status-cd79fc8a-d58f-43a3-8fba-4357b1acf621-result.json`; `0392f1e5fe66f69835baec585b39cdffdd0410600fb479244d7bbdd6796c9896`.
- Worker 1 inspection: `worker-1-jobs-build-0929b-status-450343eb-4a4f-4d97-a17e-8b5c19f7d1c6-result.json`; `20dedcaf31a42d04befeaaea90cf8d2beb966341bd3fe52370c816f6cf576e70`.
- Worker 2 details: `worker-2-jobs-build-0929b-status-1083f00d-8e4b-4da5-b2dd-8336367eb2bf-result.json`; `cabf2a8c138b94b4db67144dc5204eff09d5859fa961541999713df4e8ddbbb6`.
- Worker 2 inspection: `worker-2-jobs-build-0929b-status-853a1c6b-3f3f-4744-bad0-8f05b8c6d8c4-result.json`; `ea88afcdccd40efebd638841091a44ec69c2ad534dcf3b7c77240d2defd68001`.
- Worker 3 details: `worker-3-jobs-build-0929b-status-275bcc32-edd9-4d0a-8907-1e72f9c11763-result.json`; `97c1b5f0aa22b3f08fbab13a3194c16a138a296e97f9757f0a00bacb066d06e6`.
- Worker 3 inspection: `worker-3-jobs-build-0929b-status-d427a8c2-fb8c-48f4-a47b-f31c68f06a65-result.json`; `01388c96b4f618e13511115958fb306c6d0a8433d9fef3674de9b5519d85a0fd`.

After each worker's logs were retained and its owned-build-process list was
empty, the parent used its normal owner-authenticated Kaggle notebook UI to
click **Stop session**. A fresh state then displayed `off (run a cell to start)`
and **Start session**, proving that accelerator session off:

- Worker 1: `ankitg37/notebook14389f1658`.
- Worker 2: `arabiannights/notebookce88a28cae`.
- Worker 3: `dcpnode/notebook28fded2af7`.

Only the three browser sessions opened for this shutdown check were closed.
Earlier denied methods remain denied and retained; the supported UI shutdown
is not an API-stop bypass, a shared-kernel restart, or Windows cleanup proof.
No live app, T3, database or other shared service was restarted.

The final loopback progress snapshot remains **5/8 (62.5%)**, with all workers
terminal and `modelReady: false`. After intentional shutdown the legacy live
view reports `connection-unavailable`; this is not evidence of a new failed
dispatch or permission to reconnect/retry. The failure receipts above and the
fresh supported UI checks distinguish compilation failure from planned idle
shutdown. The follow-up `finish-current-three-worker-kaggle-batch` is paused
after terminal capture, retention and idle shutdown to prevent duplicate runs.

## Still required after this unsuccessful batch

Repair and validate the runtime bootstrap under a separate bounded authorization
before another model job. This heartbeat did not retry or implement a new
bootstrap. All five test groups finished (26 passed, 1 failed, 2 Windows-only
skips), but zero of three Qwen proposals were produced. Any later
application-source integration needs its own exact order and relevant
independent reviewer-executed proof.
Existing PR97 native-cleanup, licence/referee and acceptance blockers remain;
no claim of complete Yellow or complete universal-harness readiness is made.
