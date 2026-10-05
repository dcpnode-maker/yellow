# HARNESS-004 — independent adapter foundations and draft-job review

28 September 2026. Reviewer: **/root/harness_luna_review**, GPT-6 Luna,
nonimplementer, expressly approved by the founder. Parent is the sole writer;
this receipt records the reviewer's personally executed proof, not delegated
implementation or execution activation.

Final reviewed source bytes are committed locally as:

- T3: `aff473c14717aa4dccfe229000bd584c0bab2e61`.
- External adapter: `8f8746e86fdaa3fc12a8fcc642a166a3fa099280`.
- Pinned Paperclip: `d554c4789ed3930f8a53ac9fdf6503b3187097da`, unchanged core.

## Personally executed by the reviewer

From `D:/Yellow/harness/adapters/t3`, with the existing host-owned Git executable
supplied through `YELLOW_TEST_GIT`, the reviewer executed:

- `node --test adapter.test.mjs`: **16 passed**.
- `node --test workspace-binding.test.mjs`: **10 passed**.
- `node --test plugin-compatibility.test.mjs`: **1 passed**, importing the actual
  pinned Paperclip external-adapter loader under an isolated environment. The
  loader accepts the package; its no-argument factory remains inert and reports
  `runtime_not_configured`. It registers no agent and invokes no provider.

From `D:/Yellow/harness/t3code`:

```powershell
corepack pnpm --filter t3 exec vp test run src/universalHarness/draftJob.test.ts src/universalHarness/paperclip.test.ts src/auth/RpcAuthorization.test.ts
```

Initial draft follow-up: **23 passed**. Final assignment-label repair:
**24 passed in 3 files**, 4.11 seconds. These are repeated suites, not 47 distinct
tests. The earlier unchanged launcher8 and receipt14 suites retain the independent
proof recorded in HARNESS-004-READ-ONLY-PILOT.md. Total distinct focused cases
across current foundations: **73** (24 + 8 + 14 + 16 + 10 + 1).

## Actual draft creation and replay

The reviewer inspected the explicit one-shot proof's marker, fixed loopback
origin, synthetic company, paused agents, unassigned backlog records and zero-run
preconditions before performing its one allowed mutation.

The first command using a literal `D:/...` import failed **before script load**
because Node treated `D:` as an unsupported URL scheme. The corrected command was:

```powershell
node --import file:///D:/Yellow/harness/paperclip/server/node_modules/tsx/dist/loader.mjs scripts/yellow-pilot-draft-proof.mjs
```

It retained **YEL-5**, ID `c51a24d1-eb60-4642-9857-161b09a457e2`, and established:
**4→5 jobs**, **same job ID on same-key replay**, **3 paused agents**, **0→0 runs**.
No fixture deletion, model call, assignment, provider action or automatic retry.
The documented command now uses the working file URL. The independent script
exercises the server helper/coordinator, not an authenticated browser RPC.
Parent authenticated browser proof separately created and retained YEL-4.

The current draft postcondition checks company, backlog status, both assignee
fields, executionRunId, title, priority and normalized description. The RPC
requires `orchestration:operate`; snapshot read permission does not grant writes.
Inputs cannot control destination, assignment, status, execution or providers.
Lost or invalid write acknowledgements are unconfirmed, never falsely rejected
or automatically replayed. Same-key retry protection is Paperclip-owned and
expires after seven days; unfinished forms are not persisted across full reload.

## Retained P2 and closure

**P2: user-assigned issues appeared Unassigned** because the original allowlist
kept only assigneeAgentId. The parent added required nullable assigneeUserId,
preserved it through snapshot projection, and labeled user assignments separately.
The added test covers user-only, agent-only and neither assignment; missing user
assignment data fails closed rather than inventing an unassigned state. The
reviewer inspected this exact delta and personally reran the 24-test suite.
**P2 closed; no remaining finding in this narrow draft/label review.**

## Execution activation remains unapproved

The entrypoint, receipt and real Git-worktree fixtures are foundations only.
Two concrete runtime gaps remain:

1. Outcome-observation failure leaves an accepted receipt unresolved and may
   propagate to Paperclip. Before activation, prove that this cannot cause a new
   run identity to dispatch the same work again, or implement cross-run no-retry
   reconciliation. Current same-run receipt tests do not prove that boundary.
2. Workspace validation is point-in-time. A live execution runtime must fence or
   revalidate ownership, immutable base and mutations at the effect boundary.
   The verifier alone is not an atomic dispatch fence.

Authenticated live transport, independent lease/budget/entitlement authorization,
remote cancellation/start fencing, finite transport observation and Paperclip's
accepted-artifact handoff remain unwired. The reviewer approves the synthetic
draft slice and the inert foundations' narrow fixture/loader evidence, **not
worker dispatch, native Windows control or full harness completion**.
