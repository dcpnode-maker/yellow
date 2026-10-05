# HARNESS-007 current worker restoration and finite tests

2026-09-28, implementer observation; independent acceptance remains open.

Worker 2, Arabian Nights notebookce88a28cae: restored file permissions had first
blocked executable startup. Owner execute was restored without changing binary
bytes, but a fresh version probe returned 127 because `libllama-common.so.0` was
absent. The exact seven versioned ELF libraries existed; retained SONAME aliases
did not. The scoped repair validated each ELF SONAME and recreated only relative
`.so` / `.so.0` links within the exact private runtime, without overwrite.

Fresh version: `0.5.0-dev (build 1, commit c829670)`; runtime SHA256
`6ca3b066ff9348d12549bd9e970cf8efe220a2c419322af1b4a8313d8652aab1`.
Model: 16,464,440,224 bytes, SHA256
`322e194ff79741c7baa497c240f677f54b201b0efab44ca8e50f122b39123482`.
CUDA0/1: Tesla T4, 14,911 MiB each, 14,806 MiB free at the fresh device check.

One newly added, inspected finite synthetic coalesce_nights prompt completed at
2026-09-28T09:59:53Z, subprocess exit 0, 27.93 seconds. Layer split 1:1,
2,048 context, 384 maximum tokens, no speculation, reasoning off. Actual reported
prompt throughput 146.0 t/s; generated throughput 13.8 t/s. The answer remains an
unexecuted proposal. Exact failed dependency diagnostics remain in the notebook.
Local evidence scripts and transcribed result are below `state-pilot/artifacts/worker-2-*`.
The local proposal excludes comments, explicitly not an exact raw stdout capture.

Worker 1: fresh pinned model download/hash completed (141.66 seconds including
checksum). Its exact c829670 CUDA runtime compiled in 1,532.95 seconds; both
T4 devices passed the fresh check. One finite synthetic prompt completed at
2026-09-28T10:08:54Z, exit 0, 91.03 seconds, same 2,048 context/384-token/layer
split/non-speculative test. Actual prompt throughput 128.3 t/s and generated
throughput 13.8 t/s. Local transcribed evidence: worker-1-finite-result-20260928.json.
Both sessions were then stopped through their exact notebook UI controls, with
`off (run a cell to start)` visibly verified. No historical output is substituted
for these current session results. Neither proposal was executed or applied.

No public relay, paid API, new model variant, generated-code execution or source
application occurred. Stop only the two exact owned sessions once evidence is
retained; no broad account/session/process shutdown is authorized by this proof.

## Throughput claim provenance

Official Qwen model card: https://huggingface.co/Qwen/Qwen3.8-27B.
The primary author repository https://github.com/ARahim3/kaggle-tpu-lab,
qwen38-27b/README.md, reports roughly 130 single-stream decode tokens/sec on
TPUv5e-8, BF16, TP8, using speculative decoding and a runtime patch. That is
different hardware/runtime from our dual-T4 Q4_K_M non-speculative tests. The
author explicitly notes a stock-MTP state-correctness problem and patch/fallback.
Treat it as a candidate recipe, not independent Yellow performance or stability
proof; its bundled tunnelling is not authorized and was not run.

Public 202 t/s material concerned an H200 author benchmark, not these T4s.
No reproducible YouTube/Instagram 130–220 t/s result for our exact pinned dual-T4
configuration was verified. Do not claim videos were watched/transcribed.
The model choice is a verified coding baseline, not an uncensored/security-bypass
ranking or a claim of best overall performance. No new variant downloaded.
