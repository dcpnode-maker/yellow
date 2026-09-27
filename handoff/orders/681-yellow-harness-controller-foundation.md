# Order 681 — Yellow harness controller foundation

Status: IMPLEMENTATION IN PROGRESS. This is development tooling, not a Yellow app release.
Branch: `phase-0/yellow-harness-controller`.

## Intent

Give the founder one auditable, low-memory coordinator for bounded coding work while
keeping external model providers and Kaggle notebooks replaceable. Start with a
local, offline controller and a worker contract; prove its safety before connecting
remote compute or giving any worker machine-level authority.

## Scope

- This order: `handoff/orders/681-yellow-harness-controller-foundation.md`.
- New files under `tools/yellow-harness/**` only: controller, tests, worker
  contract, source evaluation, and operator documentation.
- Independent review, if required, at `handoff/reviews/681-yellow-harness-controller-foundation.md`.

## Requirements

1. Queue tasks in a private SQLite file outside the tracked worktree. Every task
   has a unique id, exact base commit, order, bounded input/output paths, goal,
   required capability and explicit approval state. No model-generated commands
   execute through the controller.
2. Claim with a lease and worker capability match. Heartbeats and completion
   require the matching worker and lease token. Expired leases may be reclaimed;
   stale tokens cannot complete them. Store results as proposals, never as source
   edits. Make duplicate completion idempotent only for the same payload.
3. Reject absolute/traversal paths, symlinks escaping the checkout, overlapping
   output paths, mismatched base commits, unapproved tasks and unknown workers.
   Do not accept production credentials or guest/hotel data in task manifests.
4. Provide a local CLI and repeatable tests for queue, lease, capability and
   rejection behavior. It must work without any model API, Kaggle quota, GPU or
   database service.
5. Evaluate the founder's referenced repositories, including Graft, as upstream
   options/adapters. Do not run an upstream initializer that modifies canonical
   `AGENTS.md`, global Codex settings, hooks, or project runtime in this order.

## Out of scope

- Public network listener, hosted worker enrollment, VPN/tunnel, unattended shell,
  OS administrator rights, credential transfer, provider charging, OTA scraping.
- Kaggle accelerator session or model download until a bounded benchmark,
  account/quota state and permission for Yellow's business-development use are
  verified. Kaggle resources are not continuous servers.
- Yellow application code, migrations, app/database/runtime deployment, and
  changes to existing `tools/build-continuity/**`.

## Founder statement and external-service gate

On 27 September 2026, the founder stated that the current test-phase Yellow
worker plan is a personal project and asked for that statement to be recorded.
This records the founder's characterization; it is not a determination that
Kaggle authorizes workers building a product intended for commercial use, nor
permission to share Kaggle accounts. The published terms still need to cover
the specific Yellow worker use before Kaggle accelerators are activated.

## Acceptance

- Focused tests pass for success and hostile inputs without external services.
- Source diff stays within this Scope list and contains no secrets or guest data.
- Operator guide states exactly which parts are runnable and which integrations
  remain unverified. Independent review is required before any future network or
  machine-control adapter is activated.
