# HARNESS-003 — bounded worker plans in the adopted app

Status: SUPERSEDED for worker scheduling by HARNESS-004. No scheduler, contracts
or worker-plan UI were implemented. The isolated pilot launcher remains in scope
for verification under HARNESS-002/004.
Date: 2026-09-28. Personal harness tooling; no hospitality runtime changes.

## Intent

Implement the founder's parallel/rotation requirement in the T3 source fork at
`D:/Yellow/harness/t3code`, branch `phase-0/yellow-personal-harness`, preserving
upstream UI, provider instances, agent adapters and the existing durable engine.
T3 remains a build/acceptance candidate, not a proven performance winner over Goose.

## Scope

- This order and append-only handoff ledger/decision/review artifacts.
- `tools/yellow-harness/review/**` in the governance worktree.
- In the separate T3 fork: `packages/contracts/src/workerPlans.ts`, its tests and
  exports; `packages/contracts/src/orchestration.ts` and `settings.ts` as needed.
- `apps/server/src/orchestration/**`, `apps/server/src/persistence/**`,
  `apps/server/src/ws.ts`, `apps/server/src/server.ts`, and focused associated
  tests for worker-plan state, projections, dispatch, cancellation and recovery.
- `packages/client-runtime/src/operations/**`, `apps/web/src/components/**`,
  `apps/web/src/routes/**`, and shared client state/query modules required for a
  small project worker-plan panel using existing provider/model selectors.
- `scripts/yellow-pilot.mjs` and focused tests for launching the fork against an
  isolated synthetic home without live profile reads/provider calls.
- `docs/user/worker-plans.md` explaining the implemented behavior and limits.

No dependency/version/lock changes, hospitality migrations, unrelated upstream
features, external publication, account sign-in, billable inference, real Kaggle
operations, live project import, OS administration or global installations.

## Required behavior

1. Reuse existing provider instances/model selections. Each worker has a bounded
   explicit task, named role and separate thread/worktree. Preserve AGENTS rules.
2. Persist bounded plans with parallel-independent and ordered-handoff modes in
   the existing event/receipt/projection authority. Default concurrency one;
   allow two only as an explicit plan setting, with no unbounded child fleet.
3. Ordered handoff starts a new provider conversation from an explicit result
   and immutable checkpoint; never transfer opaque provider resume tokens.
4. Recover pending state after restart without silently duplicating a provider
   turn. An uncertain dispatch pauses for reconciliation; fail closed on missing
   checkpoints/providers. No automatic paid fallback or quota/key evasion.
5. Cancellation stops queued work and requests interruption of owned active
   turns. Show requested versus acknowledged cancellation accurately.
6. Reuse existing bootstrap/worktree preparation, factoring it out of WS code
   if necessary; do not invent a second scheduler or database. Worker outputs
   remain proposals until reviewed; no automatic merge into the source checkout.
7. A small existing-app surface creates, inspects and cancels plans. Browser and
   desktop share it; new mobile editing may be explicitly unavailable initially.

## Verification

No authenticated generation is necessary for this slice. Exercise synthetic
providers/fixtures: parallel isolation/admission, ordered handoff, duplicate
commands, crash/restart boundaries, cancellation and unavailable providers.
Run focused contracts/server/web checks, build the changed app, and inspect it
against the isolated pilot profile. A nonimplementing reviewer must execute
state-transition/recovery proof and record results before this order is complete.
The larger laptop-control, Kaggle transport, quota-aware routing and real-provider
acceptance goals remain open and must not be represented as delivered here.
