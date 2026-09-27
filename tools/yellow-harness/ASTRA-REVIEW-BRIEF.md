# Astra 6 Ultra review brief: personal Yellow app-builder harness

This GitHub handoff branch is a sanitized snapshot of Orders 681–686 and their
new harness files, rebased for review onto the current public `origin/main`.
It deliberately excludes older local-only Git history and the pre-existing
`tools/build-continuity/` implementation. The full working copy for local
adapter tests is
`C:\Users\astha\.codex\worktrees\yellow-harness-controller\yellow`.
Do not infer that the public handoff branch alone can run the bridge end to end.

## Founder intent — the target, not current status

Build a personal, Windows-first harness with a Codex-class chat and project UI.
Its primary cloud model is Astra by default, but the founder can switch that
role to another top model. The primary model works with the founder, defines a
project, splits it into scoped tasks, chooses and coordinates multiple workers
in parallel, reviews their output, and presents an integrated result. Workers
may include other Codex GPT models, approved cloud/free API models, models on
the founder's GPU and TPU Kaggle notebooks, and later local/VPS/mobile models.
Route by capability, observed quality, availability, quota, latency and cost;
preserve task context and receipts across model changes. The founder also wants
native Windows device control with minimal routine permission friction and an
interface as approachable as the Codex app. The harness is for personal/team
Yellow development, not a public general-purpose product.

The founder explicitly wants open-source code reused, forked and modified
where its licences permit, not a wholly from-scratch imitation. Review the
candidates in [UPSTREAM.md](UPSTREAM.md), especially Graft, Headroom,
TrueForge, Goose, Paperclip, OpenClaw, DeepSeek Harness, Browser Use,
UniHarness, FreeLLMAPI, OmniRoute, vLLM and SGLang. Select a coherent core and
adapters; combining every framework indiscriminately is not the requirement.

## What exists at this checkout

- `controller.py`: non-resident offline SQLite task approval, capability,
  lease and immutable-proposal contract. It does not run a model or device tool.
- `continuity-bridge/adapter.py`: a narrow adapter to the pre-existing
  `tools/build-continuity/` OpenRouter free-model proposal worker. Its default
  CLI mode is an offline preview; live provider activation remains untested
  and subject to independent review. It does not apply model code.
- `tools/build-continuity/`: an older bounded free-route proposal pipeline and
  a separately prepared localhost OmniRoute gateway. There is no verified
  authenticated provider balance or successful model generation in this lane.
- No harness desktop UI, mobile app, persistent multi-machine transport,
  Kaggle worker enrollment, general agent loop, OS-level control, or proven
  equivalence to Codex/Claude exists yet. No upstream harness source has been
  copied into the new controller.
- GPU Worker 2 measured: two Tesla T4 GPUs (15,636,037,632 bytes each), four
  logical Xeon CPUs, 33,659,383,808 bytes system RAM. A pinned 16.5 GB
  Qwen3.8-27B GGUF has downloaded and passed SHA-256 verification; inference
  quality/speed have not yet been measured. The official llama.cpp b11216
  prebuilt binary failed on Kaggle's older glibc. The first pinned source-build
  configure failed because CMake could not locate `CUDA::cuda_driver`; a
  read-only probe found `libcuda.so` under `/usr/local/nvidia/lib64`, and a
  configure/build retry with that explicit path is underway. No model-load,
  inference or coding benchmark has passed yet.
- TPU Worker 1 had TPU v5e-8 selected and queued at the last authenticated
  view. Its separate browser session currently cannot resolve the private
  notebook page, so current queue/runtime status is unverified. The hardware
  probe and model test have not run. Do not infer measured performance from
  advertised 8-chip capacity.
- The Windows laptop has very limited spare RAM (founder reported about
  3.3 GB free). Minimize always-on gateways and avoid assuming a local 27B
  model can run there.

See Orders 681–686 and their tests for precise scope and proof. Existing
orders/reviews are governance inputs, not evidence that the whole Yellow app or
harness has shipped.

## Architecture decisions requested from Astra

1. Choose the best maintainable open-source base to fork or embed for the
   personal Windows app and agent loop. Identify components best left as
   adapters. Check exact licences, provenance, release health and transitive
   footprint before copying code. Proprietary Codex/Claude internals are not
   open source and must not be represented as reusable code.
2. Specify the primary-model/worker protocol: task envelope, dependency DAG,
   worktree isolation, concurrency, tool permissions, review gates, durable
   checkpoints, cancellation, failure recovery, and quality scoring. How does
   Astra choose between GPT family workers, GPU/TPU notebooks, and official
   API routes without spending paid credits silently?
3. Decide whether to retain one of OmniRoute or FreeLLMAPI as a gateway, or
   use direct adapters first. Include explicit provider consent, current
   free-quota/price checks, no rate-limit evasion, secret storage and model
   identity in receipts. Distinguish subscription access from API credits.
4. Design an outbound-only, authenticated Kaggle worker transport suitable
   for finite interactive notebook sessions. Keep Yellow source, secrets and
   guest data out of notebooks unless separately authorized; no public
   unauthenticated listener. Account for session expiration and queueing.
5. Define native Windows control as a local capability broker: which routine
   actions may be pre-authorized once, which require founder approval, how
   elevation, process control, filesystem, browser and network actions are
   scoped and audited. The goal is fewer needless prompts, not bypassing
   account, product or OS safety boundaries.
6. Sketch the usable UI: a primary chat with switchable model, project/task
   tree, worker fleet, cost/quota meter, live traces, code diffs and review
   queue. State how to deliver this with low laptop RAM and accessibility.
7. Give a staged plan and first 2–3 bounded orders with acceptance tests.
   Define a Yellow-specific benchmark against the founder's current Codex
   workflow (accepted code and regression rate, elapsed time, human effort,
   spend, RAM and recovery), rather than claiming "best in the world" without
   comparable evidence.

Please provide a decision and rationale, not just a menu of frameworks. Flag
anything that needs the founder's spending, credentials or policy decision.
