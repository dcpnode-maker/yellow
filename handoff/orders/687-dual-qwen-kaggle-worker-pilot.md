# Order 687 — Dual Qwen3.8 Kaggle worker pilot

Status: EVALUATED — both GPU models and manual task pilot verified; automatic
harness integration remains separate. Branch: `phase-0/yellow-harness-controller`.
Founder request: start both personally operated Kaggle GPU notebooks and make
Qwen3.8-27B usable for synthetic harness-development tasks. This supersedes
Order 682's stop-after-hardware-probe instruction for these two explicitly
requested pilot sessions; it does not convert them into permanent servers.

## Scope

- This order and new or edited `tools/yellow-harness/model-eval/**` files.
- Worker 1: `ankitg37/notebook14389f1658`; Worker 2:
  `arabiannights/notebookce88a28cae`. Verify account and GPU identity in each
  signed-in notebook. Use public model weights and synthetic prompts only.
- Pin the already-tested official-base-derived Unsloth Qwen3.8-27B Q4_K_M
  GGUF revision and SHA-256; pin llama.cpp commit. A reproducible setup may
  use Kaggle Files-only persistence and `/kaggle/working` for weights/runtime,
  with measured space and hash checks before use. No unverified cache claim.
- Run a bounded synthetic inference in **each** worker, record status, elapsed
  time, GPU memory and correctness. Keep sessions active for the current
  harness-development pilot only while the founder asks; document Kaggle's
  finite runtime and idle cutoff. Never claim a live harness connection until
  a separately scoped, authenticated job/receipt path is exercised.

## Out of scope

No Yellow guest or business data, private repository upload, provider keys,
public listener/tunnel, proxy, unattended persistence workaround, account
creation/sharing, commercial serving or paid upgrade. No automatic model-output
application to source. The worker gets task text only after a separate
minimum-data handoff design and founder authorization where sensitive data is
involved. Do not mutate the production Yellow runtime or the T3/Paperclip
integration branches under this order.

## Acceptance

1. Versioned setup/inference cells or script and local contract tests pass.
2. Both notebook sessions visibly run the pinned GGUF and pass the same
   synthetic coding rubric, or each failure is precisely recorded.
3. Restart behavior is tested or explicitly unverified; active session status
   is reported as a timestamped observation, not an always-on guarantee.
4. No claim that Qwen is the best model or that the harness is connected based
   on one prompt. Separate quality and connection gates remain open.

## Receipt

`tools/yellow-harness/model-eval/DUAL-WORKER-RECEIPT-2026-09-28.md` records
the exact downloads, CUDA builds, both fresh inferences and first parallel task
results. Local runner/probe contracts: 23 passed. Reviewed evaluation-only
candidate plus generated and operator-added tests: 16 passed. No runtime source
application or automatic authenticated harness connection is claimed.
