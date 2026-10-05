# HARNESS-011 — private Worker 1 diagnostic and CPU-only idle proof

29 September 2026, local date. Implementer evidence, not independent acceptance.

## Authority and connection

The founder explicitly approved opening the private Worker 1 notebook in Colab,
then enrolling its provider-issued Jupyter URL encrypted for up to 24 hours for
one resource check and one fixed synthetic Qwen coding test. No public relay,
paid compute, Drive grant, generated-code execution or source application.

The supported Run > Kaggle Jupyter Server > Open in Colab route connected Colab
to the existing Kaggle server. File > Open in Colab only imported the notebook;
that initial disconnected tab was not reported as a working connection. No
Colab compute or Pro account link was started. Fixed-origin existing-kernel
inspection from the laptop succeeded; no new kernel was created.

The provider URL is retained only through CurrentUser DPAPI; enrollment expires
2026-09-29T18:17:01.516Z. It is not exported in this review. Stopping or changing
the notebook session can invalidate it before that expiry. Browser output
redaction was imperfect: private URL/UI token material reached internal tool
output before filtering was corrected. Do not export raw conversation/tool
logs. Source, task and review artifacts contain no such material.

## Restoration and exact fresh pins

Source restoration completed at 2026-09-28T18:18:57Z on two Tesla T4 devices.
Compilation took 1782.16 seconds; weights remained the already approved 27B
variant, not a silent smaller-model substitution.

- Model: unsloth/Qwen3.8-27B-GGUF, Qwen3.8-27B-UD-Q4_K_M.gguf.
- HF revision: 4ca720788d1e01f1bff70c033e0d0028fd02e502.
- Model bytes: 16464440224.
- Model SHA256: 322e194ff79741c7baa497c240f677f54b201b0efab44ca8e50f122b39123482.
- llama.cpp source: c8296709920f9c1ae168bfd5fe66f9f73637bd60, b11216.
- Fresh binary SHA256: 5dc7eef956234d8e89724e945ae7c4d3690954dfccfd7b4ba339376135126378.
- Fresh runtime manifest SHA256: d9895cbc9892e30597aa99f6ea418a861e3add882b4217fee00c5d8755a19480.
- Diagnostic script SHA256: 6ade9a58f72e5cd339518f935c807bebc7b90a647e57742b8d39418390dafb95.

Credential-free build output is retained at
D:/Yellow/harness/state-workspace/artifacts/worker1-source-build-output.txt.
Historical manual-runner pins were not changed or treated as approving these
new build bytes. Whole executable module graph re-pinning remains required
before activating any changed transport.

## Failure and one-shot test receipts

The first direct resource diagnostic failed with FileNotFoundError. A read-only
kernel-info probe confirmed JSON-text websocket messages; a fixed read-only
reconciliation returned the previous error TYPE and no previous result. The
resource check was not replayed. The exact missing executable remains unproved.
Its attempt and unconfirmed receipts remain separate and intact.

One synthetic coding call completed at 2026-09-28T18:34:18Z, exit 0, elapsed
99.16 seconds. Request 4982da9e-d68f-4629-a2d8-ff762ec8e13e; executed source
SHA256 a0182225add4957035591f5fc1379125ff5ddfa0a918b24d84f8bf66fcd2379c.
The retained raw CLI text reports prompt processing 129.2 tokens/second and
generation 13.6 tokens/second. These are one-call CLI observations, not a
throughput benchmark or proof of 130–220 generated tokens/second. The structured
reportedRates field is empty because the initial parser looked at stderr while
the CLI printed rates on stdout; the call was not rerun to repair telemetry.

The 512-token maximum proposal includes CLI banner/prompt/spinner text and
omits the requested export. Completion is unverified and may be truncated.
It was never executed or applied. Receipt state is
diagnostic_completed_not_accepted_work, automaticDispatchReady false.
Retained evidence under D:/Yellow/harness/state-workspace/artifacts/:

- worker1-private-resources-attempt.json and resources-unconfirmed.json.
- worker1-private-reconcile-resources-result.json and its attempt receipt.
- worker1-private-synthetic-coding-attempt.json and synthetic-coding-result.json.

## Idle resource policy and observed UI limitations

After generation ended, the founder instructed GPU only while using it and
CPU otherwise. Worker 1 now has Settings > Accelerator > None checked and
the session is off, with Start Session visible. Credential-free screenshot
worker1-cpu-idle.png was saved at 2026-09-28T18:46:34.4722809Z. No CPU session
or additional inference was started merely to keep it idle. Files-only
persistence was selected earlier, but cache survival in a later session is
still unproved. The old private Jupyter connection must not be assumed live.

Compact editor semantic/AX actions did not consistently target the intended
menu row. An earlier Stop-session attempt may instead have restarted the kernel
and cleared cell outputs; the UI did not establish a successful stop then.
Local diagnostic/build evidence remains retained. Fresh screenshot-coordinate
selection subsequently verified None and the off state. No factory reset or
intentional deletion of cached files was performed.

Worker 2 was unchanged. Worker 3 TPU setup was requested for a separate account;
no Worker 3 session/model/connection proof is claimed. Only the IAB surface was
available; Chrome creation was unavailable there. The installed BrowserAct
isolated-profile route requires its own creation confirmation before proceeding.

## Focused validation and remaining boundary

Parent-executed offline tests: Jupyter plus owned-diagnostic Node suites 11
passed, 0 failed; fixed Python diagnostic 4 passed, 0 failed. Earlier API/DPAPI
16, weights 9 and source-runtime 4 passes are separate invocations. A requested
independent reviewer could not start because its configured model was
unavailable; no substituted/default reviewer or independent acceptance is
claimed.

This is a genuine bounded private Qwen diagnostic, not native automatic T3
worker registration, Paperclip assignment/review acceptance or full harness
completion. No generated-code execution, source application, new paid worker,
approval change, CompSet denial rewrite, public relay, Yellow operational
mutation, PR, merge or Yellow referee is claimed.
