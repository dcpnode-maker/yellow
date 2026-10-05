# HARNESS-011 — Free workers and the complete build/review path

Status: IN PROGRESS. 28 September 2026. Phase 0, local development only.

## Authority and fixed design

The founder explicitly asks to finish free-worker connections and the complete
automated build/review workflow now. They ask for AI Studio verification of the
three previously supplied Gemini accounts. Preserve HARNESS-004 / SOL6-HANDOFF:
T3 is the sole UI/session host, Paperclip the sole durable task coordinator.
Reuse the existing adapter, execution receipts and isolated linked worktrees;
do not introduce another scheduler. Goose/DSH remain optional model transports.

## Exact scope

- This order; append-only DECISIONS.log / handoff/LEDGER.md; question/review files
  named HARNESS-011-* in the harness-app governance checkout.
- D:/Yellow/harness/adapters/t3/**: fixed-origin free-provider adapters, private
  Kaggle API transport/enrollment, secure credential references, assignment and
  workspace preparation, bounded artifact staging/validation, independent review
  receipts, reconciled Paperclip task transitions, paired focused tests/docs.
- T3 apps/server/src/universalHarness/** and paired focused tests; authenticated
  existing server.ts/ws.ts and orchestration/http.ts harness seams only.
- T3 packages/contracts/src/universalHarness.ts, harnessRuntime.ts,
  harnessPreparation.ts, new harnessWorkflow.ts, rpc.ts, environmentHttp.ts,
  index.ts and paired focused tests for these wires;
  packages/client-runtime/src/state/server.ts and existing API bindings only.
- T3 apps/web/src/components/universalHarness/** and focused UI tests for worker
  status/enrollment, verified assignment choices, build artifacts and review.
- T3 scripts/yellow-workspace*, yellow-harness* and focused lifecycle tests;
  docs/user/universal-harness.md for the actual supported workflow.
- Separate retained state D:/Yellow/harness/state-workspace/**, one scoped clean
  synthetic linked test worktree, and credential-free build/review evidence.
- Existing user-owned AI Studio/Kaggle sessions: read-only account/tier/resource
  checks; secure local enrollment when the founder supplies missing credentials.
  Fixed free-tier Gemini generation is permitted only after account billing and
  the exact model's free pricing are verified. No paid/unknown-cost fallback.
- A bounded real synthetic build plus separate independent review through the
  completed path. Only host-owned allowlisted tests may execute; a worker cannot
  supply shell commands, executable bootstrap, credentials or primary authority.
- Founder continuation explicitly authorizes restoring the previously pinned
  Qwen3.8-27B model/runtime in both private notebooks and using them for T3.
  Reuse cached weights when valid, otherwise the exact existing Hugging Face
  revision/hash. An official hash-pinned prebuilt CUDA runtime may replace the
  slow source compilation; do not choose a smaller or different model silently.
- Routine isolated development has standing founder approval. Store that exact
  scope instead of repeated per-file grants; this does not grant a remote worker
  credential administration, account billing, live deployment or host secrets.
- Existing Paperclip process adapter may act only as a finite authenticated
  dispatch proxy to T3's workflow execution endpoint. Model calls, code staging
  and validation remain in the T3 host; Paperclip owns all queued/running records.

## Required proofs

Start from a Paperclip task; verify exact company/project and clean isolated
Git base, assign an eligible worker, dispatch one immutable plan, reconcile a
bounded artifact, execute host-owned checks, then obtain a separate reviewer
decision bound to task/run/base/artifact/test digests. Revalidate those at the
acceptance effect. Accepted means accepted in that isolated worktree, never a
main-branch merge or live deployment. Missing output, unknown dispatch, stale
review, cancellation, authentication loss and cost/quota exhaustion must remain
explicit blocked/failed/unconfirmed states, not success or transparent replay.

Independent nonimplementing review personally executes relevant ownership,
credential, source-staging and workflow tests before acceptance is claimed.
Preserve canonical Yellow's dirty tree/index and all pre-existing tasks/data.
Source manifests must be regenerated and hash verified after edits, not bypassed.

## Boundaries

No public relay (founder declined); no residential proxy/security bypass; no
billable API, account setting/billing change, notebook token guessed from cookies,
installed provider credential rewrite, unsolicited model download, unrestricted
worker shell, Yellow operational database mutation, main merge or public PR.
Private Kaggle automation requires an explicit user-owned API credential. Until
enrolled, display the missing connection honestly and continue compatible work.

state.sh remains unavailable: the attempted WSL Bash launch failed because
/bin/bash is absent. No Yellow referee/PR gate is claimed by local harness tests.

## Founder continuation, 29 September 2026

Accelerators are for active compatible accelerated work only; idle notebooks
must switch to None/CPU and release GPU/TPU allocation while preserving cached
files. Worker 1's completed diagnostic has been settled and its GPU session
released. Automatic lifecycle/dispatch acceptance remains open.

The founder adds TPU Worker 3 under the supplied separate account and requests
the same private Kaggle/Colab/local-harness setup. Isolated login and bounded
resource/model compatibility checks are in scope; never copy the CUDA/T4 runtime
onto TPU as if compatible. New private credential enrollment/security-sensitive
access requires confirmation for that specific worker and duration. No public
relay, Colab paid compute/Pro linking, Drive grant, generated-code execution or
unknown-cost fallback is authorized by this continuation.
