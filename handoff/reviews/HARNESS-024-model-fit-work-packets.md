# HARNESS-024 — capacity-fit trial evidence

Status: Worker1 trial running, not accepted. Parent is writer/integrator; no
independent acceptance claimed. Founder asks Qwen capacity-fit concrete work,
then parent checks it; strong models architect/integrate, cheaper models do leaves.

## Changed task design and local proof (2026-09-30)

Prior HARNESS023 review-only prompts, missing runner/fixture context, 1024-token
outputs and Worker2's18448>10000 packaging failure remain retained. Nothing is
replayed or relabeled as accepted. New fit-0930e uses Worker1 only initially.

- Exact public source d708ff29e2e44df74a5c1a12e58a8cf656b14c8d, two complete
  public Git blobs. No dirty/private source, credentials or real hospitality data.
- Deliverable: one complete `tests/cdp-invoke-worker-regressions.test.ts`, Bun
  imports, ten explicit case groups including12 argument-data corpus cases.
- Prompt SHA2562b1925f27f3e63f18455f0c58c93cb6a1037c03c331c79e3a855aff44743ca1b;
  conservative input UTF8 upper bound7332, not tokenizer/VRAM measurement.
- Fixed16K runtime context/4096 generated tokens/480s call/3600s whole job;
  runtime/model pins unchanged. Reasoning off. Trusted dispatch21175bytes,
  below unchanged40000-byte transport limit, preflight before credential access.
- `node --test .../test_fit.mjs .../test_operator.mjs .../test_compat.mjs`:
  initially16/0; subsequently17/0 after minute freshness test, actual rerun passed.
  Python work-packets unittest5/0; complete artifact checks are triage,
  not executable acceptance. Original missing-module RED preserved in transcript.
- Python AST parses fixed prepare/status/result/proposal sources. Worker2/3 and
  generic old-job fit dispatch rejected. Full inert text digest required, no
  remote model-output execution. Result-log tails explicitly not complete output.
- Native runtime persistence: complete new binary/shared-library set plus
  SHA256 manifest under owned working cache before session stop. Old caches
  aren't overwritten; current compile, future session survival still unproved.

## Actual live dispatch

Existing owned BrowserAct Worker1 profile confirmed exact ankitg37 notebook,
session off, normal Start session clicked once. Provider Adding data/Running
observed; no factory/kernel reset. Run / Kaggle Jupyter Server / actually
observed VSCode field used privately, no raw URL exported. Fresh CurrentUser-DPAPI
connection expires2026-10-01T12:47:21.445Z (<=24h), no public relay.

Exact existing Python kernel metadata reply confirmed. Fresh bounded resources:
4CPU,33659383808B total RAM, twoTeslaT4 each15360MiB,14912MiB free;
2529959936B working free, pinned weight file present. No new model download.
New prepare claim/result retained once; at12:50UTC current state running,
public baseline exit0/completed1of2, weights verified, native compile3%.
Smoke/output/cache proof pending. Workers2/3 intentionally not admitted.

Private artifact receipts remain `D:/Yellow/harness/state-workspace/artifacts/`
under exact `worker-1-jobs-fit-0930e-*` names, no secrets in Git.
Read-only minute observer PID15552/loopback38887 updates ControlPlane file with
zero model calls. Historical38886 untouched. Existing minute follow-up updated
to this batch, never duplicate/replay. Parent will retain complete text and inspect
before separately scoped local verification. Native compile percentages aren't
overall Yellow progress. All work remains unaccepted until actual proof.

Actual local final pass:17Node/5Python/16PowerShell checks, scoped diff check
passed. One-shot console confirms exact fit1/2steps50%, Worker1compile27%,
Workers2/3notadmitted, zero viewer model calls. Earlier viewerPID26776 was still
the old loaded script; exact command line checked before stopping only that
viewer, replacementPID21736 confirmed with the expected script. Codex/T3/shared
services were not stopped. At12:57UTC fresh Worker1 compile32%, active1/3,
new inference/output pending. The fixed minute follow-up is confirmed ACTIVE.
UI scroll CLI unsupported-selector error retained; resolved by visible drawer
scroll position only, no notebook/kernel/control change.

## Candidate alternative, not installed

Official Hugging Face Qwen3-Coder-30B-A3B-Instruct card and unsloth GGUF card
checked: coding-focused MoE,30.5B total/3.3B active, non-thinking, llama.cpp route.
No throughput/VRAM fit proof on these notebooks, no replacement download or model
call. Compare a pinned quantized candidate only if the concrete27B trial fails
quality; don't substitute blindly or assume smaller models give equal quality.

## Remaining outcome

Fresh synthetic inference, complete new file, parent inspection/executable
verification, useful integration and idle shutdown are still pending. Zero
accepted fixes. Native Windows/high-risk/harness/ecosystem acceptance not claimed.

## Terminal outcome — 30 September 2026, 13:33 UTC

This dated result supersedes the pending snapshot above, preserving its history.
Worker1 completed the public baseline and synthetic Qwen smoke, then delivered
one complete ten-test-group Bun file in 181.75 seconds (reported generation
13.5 tokens/sec; prompt processing 337.4 tokens/sec is a different metric).
Native runtime reached 100%; its binary/shared-library cache manifest was retained.
Future-session cache survival has not been established.

Fixed result and proposal read operations each ran once. Full inert output is
10120 UTF8 bytes; locally recomputed SHA256:
`e8aaed8db56da58da60d41a0d70c6448a999acc6b462747410c093f4f35386e7`.
Receipts: worker-1-jobs-fit-0930e-result-00e9e754-104e-4a12-9a4d-27c46ebbba65-result.json
and worker-1-jobs-fit-0930e-proposal-37df3030-d30d-4caf-a34c-ab79ad0b41fd-result.json
under the existing private artifact directory. No log excerpt substitutes for text.

Parent inspected the complete source without executing it. It uses Bun imports,
the actual helper and the ten requested groups. A concrete defect remains: the
argument corpus includes an empty string but unconditionally asserts that the
function declaration does not contain that string; every string contains the
empty string. The null-byte/newline corpus uses literal escaped labels rather
than actual control characters. Delivery is useful but not accepted; zero fixes
applied and zero generated-code executions. Corrected verification is a separate
successor, not an automatic replay.

Terminal state proved ownedProcessCount=0 and jobThreadAlive=false before shutdown.
Normal Kaggle Run -> Stop session produced Session stopped; exact
ankitg37/notebook14389f1658 subsequently showed Draft Session off. Workers2/3
were not admitted. The finite follow-up is paused to prevent duplicates; the
read-only observer already stops remote polling when terminal. Historical terminal
proof must not be represented as fresh running workers or ecosystem completion.
