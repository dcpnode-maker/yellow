# Order 128 — Post-108 lineage reconciliation and model routing

**Status:** COMPLETE — governance/design only; no product integration performed
**Phase:** 5 · delivery control
**Branch:** `phase-5/post-108-lineage-reconciliation`
**Base:** `952478d17bcebd67e696d5cb76eec37e89cabcf3` — merged `origin/main`
after cumulative PR #77
**Risk tier:** 3 — provenance-sensitive coordination over security, occupancy,
authentication, posting and financial-close candidates
**Owner:** Codex coordination; independent non-implementing review remains mandatory
for every admitted Tier-3 executable

## Founder intent

Keep Yellow lean and truthful while using the most suitable model at each stage for
accuracy, speed and efficient credit use. The local founder workbench must show real
evidence-backed progress without becoming a second source of truth, exposing model or
host secrets, or implying completion from plans, schemas, UI, branches or self-reports.

## Admission facts

- `origin/main` is exactly `952478d17bcebd67e696d5cb76eec37e89cabcf3`.
- Local `main` remains `5f49c82d308a5f1732c9a066b478713c97b66f77`,
  two local governance commits ahead of its old base and 286 commits behind the
  integrated remote line. Its durable backup is
  `origin/backup/final-codex-handoff-5f49c82`; do not merge it into the current line
  merely to remove divergence.
- Orders 019–108 are integrated. Post-108 work exists only across local branches and
  worktrees unless a remote-tracking ref is explicitly proven.
- Historical post-108 lineages reuse Order numbers 112 and 113 for different finance
  and security artifacts. Preserve the evidence; do not silently overwrite, rename,
  or treat either lineage as canonical without an explicit reconciliation decision.
- Order 124 is independently approved at review commit
  `a978d581523880ad1d5f89a415b61a7b3f63d6b3`; a separate Daybreak-requested
  read-only run reached the same APPROVED result after personally reproducing the
  parent exploit and executing the complete native-WSL proof. Orders 126 and 127
  remain planning-blocked on their documented prerequisites. Their existence does
  not prove product completion.
- Order numbers 128–140 were unused across all current refs when this order was
  admitted.

## Post-108 evidence map

| Artifacts | Exact evidence | Classification | Remote/current-line treatment |
|---|---|---|---|
| Finance planning pack 109–115 | metadata tip `3bce2e1`; diff from `89cd032` is decisions, plan, orders and questions only | Order 109 READY; 110–115 DRAFT/BLOCKED; no product implementation | Local-only. Preserve policy evidence but close this numbered pack as superseded; reissue coherently as 133–139 only when finance execution resumes. |
| Cyber 116–118 | approved executables `f15e142`, `6fa7744`, `09070d9`; Order-118 approval `ec4c563` | independently approved Tier-3 chain | Local-only and already composed into approved Order 123; do not integrate the side branches separately. |
| Supply/API 119–121 | approved executables `7ba93e4`, `0ca144b`, `bc27020`; Order-121 approval `87d4ea6` | independently approved Tier-2/3 security chain | Local-only and already composed into approved Order 123; do not replay twice. |
| Proof maintenance 122/125 | fixture executables `8bdd977` and `2bbf901`; verified in Order-123 matrix | proof-only, no product authority | Local-only; admit only through Order 123. |
| Cyber integration 123 | executable `be279bb`; independent approval metadata `9f97bd0`; canonical review branch `ebd70b8` | APPROVED integration candidate | Local-only. Primary source candidate for Order 129 after exact composition on merged `origin/main`. |
| Day-seal authority 124 | executable `b93574d`; builder metadata `8d95c83`; independent review `a978d58` | APPROVED Tier-3 candidate | Local-only. Compose once after Order 123 and rerun the complete current-line proof. |
| Occupancy caller binding 126 | planning tip `5d7d7f0` | DRAFT/BLOCKED | Exclude from Order 129 until its documented parent-red and independent review exist. |
| Runtime database authority 127 | planning tip `a1cd58a`, based on obsolete `5f49c82` planning line | DRAFT/BLOCKED | Exclude; rewrite its future order from the eventual approved Order-126/current-line base. |
| Legacy security-number branches 112/113 | remote-backed `85cc5e7` and `0ec1b77` | historical/superseded by actor-bound Order 121 and current-line SECURITY DEFINER Order 108 | Never import their duplicated order identities into the future finance sequence. Preserve Git history only. |

None of the local-only rows is called durable or merged merely because it is reachable
from a worktree. Order 129 must push one reviewed current-line candidate and must not
push every stale side branch as a substitute for reconciliation.

## Reconciliation decision

The following sequence is selected for future execution. It does not itself move a
branch, alter product code or authorize a self-merge.

1. Close the unimplemented finance planning pack 109–115 as **SUPERSEDED-BY-REISSUE**
   when Order 129 assembles governance. Preserve its founder-approved policy text and
   Git history; do not carry seven permanently open order files into `main`.
2. Reserve 133–139 for the same finance sequence after the delivery-status work. This
   removes the 112/113 collision and keeps the finance dependency chain contiguous.
3. Compose only approved Order-123 executable evidence followed by approved Order 124
   onto exact merged `origin/main`. Exclude Orders 126/127 and all standalone duplicate
   side branches.
4. Keep local `main` untouched until Order 129 merges. After its worktree is proven
   clean and `origin/backup/final-codex-handoff-5f49c82` is reverified, replace—not
   merge—its checked-out ref/tree with the resulting `origin/main` using a recoverable
   ref-move procedure approved in Order 129. Never merge `5f49c82` into the current
   line.

## Required Order-129 proof

- exact ancestry, source-blob and changed-file mapping for every admitted commit;
- exact-parent hostile security reds for the admitted Cyber findings;
- focused Orders 116–124 suites, including Order-108 containment and Order-124
  business-day authority;
- native-WSL isolated Phase-3/current-line matrix with every mapped suite green;
- migration integration, database acceptance, founder status and complete standing
  test suite;
- TypeScript, import boundaries, licence policy, dependency audit, schema drift and
  protected hashes;
- fresh isolated `./setup.sh --db-only` with `11 passed, 0 failed of 11`;
- independent non-implementing Daybreak-requested security review of the exact composed
  candidate, with personally executed proof and all host timing/symlink stops disclosed.

## Scope

1. Produce an exact ancestry and changed-file map for every candidate after Order 108,
   including Orders 109 and 116–127, their review branches, current worktrees and
   remote durability.
2. Classify every artifact as independently approved, built-unreviewed, draft/blocked,
   proof-only, superseded, duplicate-numbered, or integration metadata. Cite the exact
   implementation and review SHAs; never infer status from a branch name or order UI.
3. Reconcile the duplicate 112/113 identities without deleting history. Recommend the
   smallest explicit alias/supersession decision that leaves one unambiguous canonical
   future sequence.
4. Identify which approved commits can be replayed onto `origin/main`, in dependency
   order, without importing unrelated draft product work. Record conflicts and require
   fresh proofs on the resulting exact current-line candidate.
5. Recommend the safe local-`main` reconciliation mechanism while preserving its
   existing remote backup. Do not move the ref under this order.
6. Record the model-routing matrix and the collision-free next-order sequence below.
7. Keep the already-running founder workbench clearly separated from development
   telemetry. It may display its existing authenticated Order-108 snapshot and live
   service checks; it must not claim Git/model activity that is not implemented.

## Model routing

Models are requested for their role; a request is not proof of the model actually
provided by a host. No model may self-review or self-merge.

| Work | Requested model | Effort | Authority |
|---|---|---:|---|
| Lineage, architecture, integration and final validation | OpenAI GPT-5.6 Sol | high/xhigh | Coordinator and only writer for shared-state work |
| Authentication, tenant, database-authority and Cyber review | OpenAI Daybreak Blue | high/max | Read-only independent reviewer; personally executes hostile proofs |
| Bounded TypeScript/API/UI implementation after scope is fixed | OpenAI GPT-5.6 Terra | high | Builder only |
| Mechanical fixtures, documentation and deterministic test scaffolding | OpenAI GPT-5.6 Luna | medium | No approval authority |
| Optional extra review | Claude, only when founder invokes it | founder-selected | Never an operational dependency |

The coordinator remains responsible for requirements, architecture, integration,
evidence review and final claims. There is at most one writer. Security workers do not
edit authentication, authorization, cryptographic, migration or tenant-boundary code.

## Collision-free future sequence

These numbers are reserved by this plan but are not open orders until their own files
are deliberately created from the then-current canonical base.

1. **129 — Approved post-108 current-line integration.** Admit only independently
   approved executable commits, rerun their proof on the composed candidate, and keep
   draft finance work outside the integration.
2. **130 — Truthful local delivery-status projection.** Define one sanitized atomic
   receipt schema, a fixed-root loopback adapter, dedicated founder/control-plane read
   authority, and authenticated workbench rendering for Git/order/test evidence. No
   `.git`, repository, agent-log, environment or Docker-socket mount enters the app.
3. **131 — Authenticated model-event feasibility.** Research the actual Codex/Claude
   host event surfaces. No model heartbeat, selected-model label, token use, prompt,
   reasoning, tool argument or completion percentage is exposed without an
   authenticated, documented source.
4. **132 — Live model-activity projection, conditional.** Create only if Order 131
   proves a safe source. Unknown or stale data fails visibly to `unavailable`; model
   self-report can never advance build/review state.

## Security boundary for Order 130

- Git, order, review and test evidence remains authoritative; the dashboard is only a
  bounded projection.
- A separate loopback-only adapter reads fixed local sources and atomically publishes
  sanitized JSON. Browser input never selects a path, ref, command, repository or test.
- Test receipts contain commit, suite, start/end time, exit result, counts and a receipt
  hash. Raw console logs are not parsed or rendered.
- Untrusted subjects, order prose and test names are length-capped, stripped of control
  and bidirectional characters, normalized to enums/counts where possible, and rendered
  with `textContent` only.
- The app container receives only the sanitized receipt, never `.git`, the worktree,
  agent logs, environment data, Docker access or host credentials.
- Every observation includes source commit, observed time and stale/unknown semantics.
  Progress uses deterministic denominators only; no subjective whole-project percent.
- Rich delivery telemetry receives dedicated local founder/control-plane authorization;
  the existing availability-read permission is not sufficient.

## Scope files

- `handoff/orders/128-post-108-lineage-reconciliation.md`
- `handoff/LEDGER.md`

No product, runtime, schema, migration, test, script, dependency, Compose, generated or
future-workbench artifact is in scope.

## Forbidden

- Product implementation, branch integration, cherry-pick, rebase, merge, push, PR or
  local-`main` ref movement.
- Deleting branches, worktrees, review evidence or duplicate-numbered historical files.
- Treating current Order-124 services or builder output as independent proof.
- Starting Orders 129–132 before their stated admission gates.
- Installing paid services, proprietary runtime dependencies, arbitrary skills or
  model plugins without a bounded need and supply-chain review.
- Claiming live model activity, external CI, deployment, finance completeness or
  independent review from this governance order.

## Definition of done

- [x] Exact post-108 branch/ref/worktree/remote map is recorded with SHAs.
- [x] Each candidate has an evidence-based status and dependency classification.
- [x] Duplicate 112/113 handling and local-`main` reconciliation are decided explicitly.
- [x] Order 124 receives independent non-implementing Tier-3 review on its exact frozen
      candidate; Orders 126/127 remain blocked unless their documented gates clear.
- [x] A minimal Order-129 integration set and full fresh-proof command list are defined.
- [x] Collision-free Order numbers 128–132 and model roles are reserved.
- [x] Truthful delivery-status security boundary is defined; model activity remains
      research-required.
- [x] Only the two Scope files differ from the exact base, and repository state remains
      clean after commit.

## COMPLETE

Order 128 is complete as a governance and delivery-control artifact. It creates no
claim that post-108 executables are integrated, that local `main` moved, or that live
model activity exists. The next writable task begins only when Order 129 is deliberately
created from the then-current canonical `origin/main`.
