# Order 684 — Worker 2 Qwen3.8 coding evaluation

Status: IN PROGRESS. Branch: `phase-0/yellow-harness-controller`.

## Intent

Determine whether the strongest current open Qwen candidate is a dependable
coding worker on the measured Kaggle GPU Worker 2 (two Tesla T4 GPUs), using
only synthetic tasks. This is a measured evaluation, not an assertion that the
model or the Yellow ecosystem is production-ready. Orders 681–683 remain open
until their separate acceptance evidence is complete.

## Scope

- This order and new or edited files under `tools/yellow-harness/model-eval/**`.
- Probe Worker 2 disk, CUDA devices, compiler/runtime availability, and free
  quota before any large download. Keep Worker 1's account/session untouched.
- First candidate: official `Qwen/Qwen3.8-27B` (Apache-2.0) via the Unsloth
  GGUF quantization `unsloth/Qwen3.8-27B-GGUF`, revision
  `4ca720788d1e01f1bff70c033e0d0028fd02e502`, file
  `Qwen3.8-27B-UD-Q4_K_M.gguf`. The published file is about 16.5 GB, requiring
  a split across the two 15.6 GB T4s. Pin and record the llama.cpp runtime
  version/commit and use its documented layer split; do not assume aggregate
  VRAM makes a working or fast inference service.
- Test with a bounded context and output cap on synthetic Python coding
  problems; record exact model/quant/runtime revisions, load time, prompt and
  output tokens, generation rate, per-device memory, errors, and a rubric.
- If the model cannot be made reliable within a bounded trial, record the exact
  failure and propose a smaller fallback in a separate scoped order. Do not
  silently select a model by parameter count or unverified benchmark claim.
- No Yellow source, credentials, business/guest data, account changes, tunnel,
  public model server, paid resources, or unattended background sessions.
  Model output never edits Yellow. Stop the Kaggle compute session after the
  trial and preserve the local receipt.

## Acceptance

1. A locally versioned notebook cell/script and local syntax/contract tests.
2. A visible Worker 2 load and coding result with measured speed/memory and
   correctness, or a precise blocked/failure receipt.
3. A recommendation that separates official base-model results from any
   community "uncensored" derivative; no derivative is trusted without a
   separate provenance and same-rubric quality test.
4. GPU compute session shutdown verified, or explicitly reported unverified.
