# HARNESS-018 — Restore useful Qwen workers with pinned runtime and small tasks

Founder directive, 29 September 2026: reduce Codex credits by doing real work on
the three free Kaggle workers; give Qwen pinpointed tasks in a finite queue, not
an ecosystem-sized context. The preceding build-0929b timeout batch stays closed.

## Exact scope

- `tools/yellow-harness/worker-jobs/{operator.mjs,owned-job.py,progress.mjs,
  test_operator.mjs,test_owned_job.py,test_progress.mjs,README.md}`.
- This order and `handoff/reviews/HARNESS-018-pinned-runtime-microtasks.md`.
- Fresh batch `micro-0929c`, exact three existing notebook identities, new
  single-use claims and DPAPI connection files expiring in at most 24 hours.
- Start Worker 1 first through supported owner-authenticated Kaggle UI; collect
  resources, then validate pinned runtime/devices and one synthetic Qwen response.
  Do not count connection, downloads, compilation or retained tests as model work.
- Reuse the exact model/revision/hash. Replace this batch's repeated compile
  with the official b11216 Ubuntu CUDA12.8 runtime and its matching CUDA libraries,
  pinned by release-asset byte lengths and SHA-256. Validate archive paths, runtime
  libraries and actual GPU loading; fail closed, no source-build/model fallback.
- Cache verified artifacts only in the project-owned worker directory. No
  accelerator restart, shared-kernel kill, cache deletion or unrelated process kill.
- After Worker 1 inference is proved, use each available worker for three small
  independent public-source proposals, each fixed source slice, question, test
  target, <=8K context, <=1024 output tokens and <=180 seconds. Source/model setup
  has the existing 3,300-second whole-job maximum; no arbitrary model prompt/tool.
- Existing public PR97 d708ff29 and PR93 01c9ffa4 source pins only. No unpublished
  local repairs, live hospitality data, credentials or raw conversation export.
- Retain proposals and digest as inert artifacts. Parent inspects and verifies
  any later integration under an exact application order. Honest task progress;
  failed tests remain visible and independent acceptance is never inferred.

## Forbidden

No replay of prior start/recovery claims; no paid model/API fallback, public
relay, Drive grant, permission/control change, generated-code execution, own PR
merge, live Yellow/database restart, broad process kill or fabricated completion.
Prior Worker 2 denials remain preserved; normal owner-authenticated UI is required.

## Acceptance

Paired tests before implementation: pins, safe extraction, cache integrity,
per-task context limits, exact batch identity and no cross-batch replay. Actual
private worker proof must include GPU/model response, task outcomes/digests and
idle accelerator shutdown. Measure model output rather than promising savings.
If a download/runtime compatibility check fails, retain it and stop that attempt;
do not conceal a second method as the first successful run.

Status: implementation in progress; no worker or model readiness claimed yet.
