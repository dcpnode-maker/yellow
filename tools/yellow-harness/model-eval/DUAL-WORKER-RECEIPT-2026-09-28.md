# Two Qwen worker pilot — 28 September 2026

Order 687. Both personally operated notebooks were running GPU sessions at the
04:57 IST observation. Worker 1 is Ankit G37's `notebook14389f1658`; Worker 2 is
Arabian Nights' `notebookce88a28cae`. Worker 1 was deliberately switched from
the unavailable TPU to GPU at the founder's earlier request. Neither is a TPU
worker in this receipt.

Both hardware probes identify 4 logical CPU cores, 33,659,383,808 bytes RAM and
2 × Tesla T4 with 15,636,037,632 bytes each. Both model downloads produced
16,464,440,224 bytes and verified SHA-256
`322e194ff79741c7baa497c240f677f54b201b0efab44ca8e50f122b39123482`.
The Unsloth GGUF revision is `4ca720788d1e01f1bff70c033e0d0028fd02e502`;
the official-base Qwen3.8-27B Q4_K_M quantization is used, not an evaluated
"uncensored" derivative.

The original prebuilt llama.cpp runtime required newer glibc than Kaggle's
2.35. Both notebooks instead built official tag b11216, verified commit
`c8296709920f9c1ae168bfd5fe66f9f73637bd60`, with CUDA 12.8, architecture 75,
and the mounted CUDA driver library. Both device checks enumerated CUDA0/CUDA1.

| Measured item | Worker 1 | Worker 2 |
| --- | --- | --- |
| Weight download and SHA check | 126.58 s | 127.64 s |
| CUDA source build | 1521.77 s | 1522.46 s |
| Fresh bounded inference incl. model loading | 89.63 s | 88.28 s |
| Prompt throughput reported by CLI | 135.8 tokens/s | 147.8 tokens/s |
| Generation throughput reported by CLI | 13.1 tokens/s | 13.6 tokens/s |
| Sampled peak GPU memory | 7381 / 8425 MiB | 7231 / 8323 MiB |
| Process exit | 0 | 0 |

Each fresh output contains the same complete `coalesce_nights` function as the
previous evaluation-only `qwen38_sample_output.py`; complete code was inspected.
The four local rubric tests pass for empty/disjoint, overlapping/adjacent,
non-mutating and reversed-date cases. No generated code was executed remotely
or applied to Yellow. A single deterministic prompt is not model-selection or
representative autonomous-coding proof.

Weights and compiled runtime are in `/kaggle/working/yellow-qwen38`. Worker 2
visibly has Files-only persistence selected. Worker 1 persistence and both
restart reuse paths remain unverified. The runtime build cost is paid once per
retained runtime, but no restart-saving guarantee is made yet.

At 04:57 IST both workers were dispatched bounded manual development tasks:
Worker 1 a generic strict JSON parser proposal, Worker 2 independent adversarial
tests, under `SYNTHETIC-HANDOFF.md`. No source, private data or provider credentials
were sent. Complete outputs were inspected before local evaluation.

- Worker 1 returned the complete parser in 35.04 s after its model hash check;
  the whole notebook cell took 78.572 s. Reported generation was 12.6 tokens/s.
  The manually copied function is only `fixtures/harness_candidate.py`.
- Worker 2's first attempt returned exit 0 in 84.86 s, but exhausted the output
  cap during its eighth test and assumed incorrect byte lengths. This was
  rejected, not executed and not counted as passing.
- Separately named compact retry `worker2-parser-tests-v2` returned exit 0 in
  50.49 s and produced 13 complete tests, at reported 13.6 generation tokens/s.
  It still omitted the multibyte UTF-8 requirement and inserted an unnecessary
  relative import path. The complete inspected output is retained only in the
  isolated evaluation fixture; the omission was not hidden.
- The 13 model-generated tests passed against Worker 1's proposal. Three
  separately authored operator checks for over-limit multibyte text, exact
  multibyte boundary and an escaped duplicate key also passed. Command:
  `python -m unittest discover -s tools/yellow-harness/model-eval/fixtures -p
  'test_*.py' -v` — **16 passed**. Runner/probe contracts separately report
  **23 passed**. Both test commands and `git diff --check` succeeded locally.

This demonstrates actual two-worker proposal/test collaboration, not a measured
speed advantage over Codex or a production parser implementation. Generated code
was executed locally only after inspection, in the evaluation fixture. It was
not executed remotely, applied to Yellow, or imported by the harness runtime.

There is no public listener, tunnel, permanent server or automatic harness
connection. These are finite Kaggle sessions with runtime/idle limits. The
durable authenticated task/receipt adapter, cancellation, restart and safe
source application still need separate integration and reviewer-run proof.

At the 05:14 IST final check, both read-only status cells again enumerated two
T4 devices, found the expected model/runtime files and displayed the saved fresh
inference/task receipts. Worker 1's UI showed Draft Session running (1h26m),
and Worker 2's captured screen showed an active Draft Session (1h9m), GPU T4 x2
and Files-only persistence. Proof image: `evidence/worker2-2026-09-28.png`.
Session uptime differs; no synchronization or permanently loaded-model claim
is made. The direct inference processes exit between finite jobs.

Worker setup/task evidence is locally committed as `20816fd7`. No public push,
PR or runtime activation was performed. T3's isolated desktop build/launch
receipt is retained separately in the harness-app worktree; its pilot scripts
are locally committed as `72afd864`, with providers disabled. Its measured
local process tree was stopped after the smoke, not the Kaggle sessions.
