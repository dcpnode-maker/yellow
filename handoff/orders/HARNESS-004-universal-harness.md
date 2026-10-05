# HARNESS-004 — Universal Harness, one UI with reusable background engines

Status: IN PROGRESS. Date: 2026-09-28.

## Founder direction

The founder explicitly wants one fast UI named **Universal Harness**, combining
Goose's task-execution role, T3's multi-agent coding workspace and Paperclip's
work assignment/tracking role. Background dependencies are allowed. The same
screen must cover tasks, agents, results, code/preview, costs and controls.
Provider scope remains Codex GPT, Claude-capable execution, Gemini keys,
Antigravity, finite Kaggle workers and later cloud models; parallel and ordered
handoff are required. Broad laptop operation uses standing routine grants.

## Architecture decision

Reuse T3's desktop/web app and native agent adapters as the single user surface.
Reuse Paperclip as the sole durable job coordinator. Keep T3's existing durable
conversation/checkpoint engine; it owns execution sessions, not a competing job
scheduler. Bridge job IDs to execution receipts idempotently. Do not implement
the new WorkerPlanReactor contemplated in HARNESS-003. Goose is an optional agent
backend where it provides useful capability, not a mandatory third UI/process.
This is an implementation direction pending build, resource and execution proof.

## Scope and isolation

- This order, append-only decisions/ledger/reviews, and
  `tools/yellow-harness/review/**` in the Yellow harness-app worktree.
- Public source acquisition into new `D:/Yellow/harness/paperclip`, pinned first
  to release `v2026.916.1`; record peeled commit and compatibility with adapter
  APIs before implementing. A newer exact commit may be selected only with a
  recorded source-based reason. Preserve MIT notices and upstream provenance.
- Local branches `phase-0/yellow-personal-harness` in the T3 and Paperclip forks.
- Reviewed local dependency installs/build artifacts; no global changes. Keep
  at least 5 GiB free on D:. Measure RAM before enabling resident services.
- Synthetic state beneath `D:/Yellow/harness/state-pilot`, loopback services on
  verified free ports, tracked process ownership. No existing application state,
  browser profiles, secrets, databases or installed provider config changes.
- T3 bridge: new `apps/server/src/universalHarness/**`, associated focused tests;
  necessary typed contracts in `packages/contracts/src/` and exports;
  existing authenticated RPC/HTTP registration, server layer wiring,
  orchestration/Git worktree services only as needed for the execution bridge.
- UI: T3 `apps/web/src/components/**`, `apps/web/src/routes/**`, existing sidebar
  entrypoint modules, shared `packages/client-runtime/src/` API/query/state for
  integrated Jobs/Agents view. Reuse existing visuals/pickers; do not iframe a
  second dashboard or hide job management solely in settings.
- Paperclip external adapter under `D:/Yellow/harness/adapters/t3/`, using its
  supported adapter extension seam. Prefer no Paperclip core source changes.
- Pilot launcher/tests under T3 `scripts/yellow-pilot*`, concise user guidance
  `docs/user/universal-harness.md`, and build/verification evidence in review/**.

## First executable acceptance slice

1. Build and launch the existing T3 surface against validated synthetic settings
   with all provider probes/generation disabled. Verify actual app rendering.
2. Start a separate loopback Paperclip pilot with a synthetic company and paused
   agents, using supported Windows database/runtime paths. Show actual connected
   status and jobs in Universal Harness; disconnected state must be explicit.
3. Use typed narrow APIs, a server-side connection credential where required,
   and existing local auth. UI must not receive coordinator/provider secrets or
   arbitrary URL credentials. Remote origins cannot claim local control.
4. Bind Paperclip run IDs to deterministic T3 command/thread IDs and immutable
   worktree bases. Repeated requests reconcile existing work, never silently
   issue a second provider turn. Uncertain dispatch fails closed for inspection.
5. Reuse Paperclip ownership, budgets, scheduling and cancellation. Adapter abort
   interrupts its execution thread and waits for acknowledged state; never kill
   the shared T3 server or another agent. No automatic source-checkout fallback.
6. Exercise synthetic worker fixtures for parallel isolation, ordered checkpoint
   handoff, cancellation, restart and unavailable providers before live activation.

## Remaining full-product gates

The first connected screen is not completion of the full product. Continue with
native standing grants and serialized Windows actions; official provider auth
and discovered model entitlement; finite outbound-only Kaggle worker transport;
resource/cost admission, zero paid fallback unless expressly authorized; and
same-task performance/quality acceptance. UI startup and whole-process memory
must be measured. No unverified claim that T3 is faster than Goose.

No billable model generation, Kaggle start/stop, public tunnel, startup daemon,
credential copying, UAC/security bypass, production Yellow runtime mutation,
irreversible external action, public PR or merge under this order. A separate
nonimplementing agent must personally execute integration/state-transition proof
and record findings before completion. The founder's approval of background
dependencies removes the earlier one-runtime preference, not these boundaries.

## 28 September connected-pilot checkpoint

Acceptance 1–3 implemented locally: authenticated read-only Jobs/Agents/Runs,
isolated loopback T3/Paperclip and actual browser refresh proof. T3 commit
`e9362f737747c11221300c234dc99b1b7d4386c4`. Acceptance 4–6 has a nonactivated
SQLite receipt foundation only, adapter commit
`c71b1392495f27f2b0e403e58ece493c2a407652`; no live dispatch/transport. Parent
tests initially 15 bridge/auth + 6 pilot + 14 receipt passed. Independent Luna
personally ran them and accepted the read-only synthetic pilot, not activation.
Its settings-guard finding was fixed and independently rechecked. See
`tools/yellow-harness/review/CONNECTED-PILOT-2026-09-28.md` and the independent
review receipt. This order remains **IN PROGRESS**.

Final pilot hardening commit `a80bed3ec9a8ece0fd0c72023aa8c94c42c35de8`;
independent focused suites now cover37 distinct tests. Built coordinator health
is independently200/ok/ready and parent browser reconnected with preserved
synthetic records. Acceptance 1–3 synthetic-pilot checkpoint is delivered;
4–6 and remaining full-product gates are still open. No completion shortcut.

## Draft-job and external-adapter continuation

T3 `aff473c14717aa4dccfe229000bd584c0bab2e61` adds explicitly authorized,
unassigned backlog drafts with stable-key retries and user-assignment labels.
Parent actual authenticated UI retained YEL-4; nonimplementing Luna independently
retained YEL-5 and proved same-key replay creates no duplicate or execution.
External adapter `8f8746e86fdaa3fc12a8fcc642a166a3fa099280` now has its supported
inert entrypoint and immutable linked-worktree verifier. Fixture and actual
pinned-loader proof do not activate it. Current focused foundations cover
73 distinct cases. Independent draft/label findings are closed; cross-run
reconciliation and effect-time workspace/cancellation fences remain open.
See `handoff/reviews/HARNESS-004-ADAPTER-AND-DRAFTS.md` and the connected receipt.
The local pilot is runnable with five retained jobs, three paused agent records
and zero execution runs. HARNESS-004 remains **IN PROGRESS**.

## Cross-run reconciliation continuation

Adapter successor `14329a1c5fe314747fdf361f241eefa534b7e643` adds a transactional
company/issue guard across different coordinator run IDs, preserves legacy
receipts and returns explicit reconciliation evidence after observation loss.
Parent reproduced four regression failures before the guard, then personally
passed all51 adapter/receipt/workspace/pinned-loader cases. Nonimplementing
Luna personally reran all51 with zero failures/skips and exercised blocked-run
abort: one dispatch, no new receipt and no interruption of original work.
This foundation is independently accepted, recorded in
`handoff/reviews/HARNESS-004-CROSS-RUN-RECONCILIATION.md`. Live activation remains
disabled; this order is still **IN PROGRESS**. The founder moved market/proxy
work to its existing CompSet Studio chat, keeping this lane on the harness.
