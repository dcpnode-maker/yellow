# HARNESS-011 — actual Codex terminal turn through T3

28 September 2026. Implementation/actual local proof: root. Nonimplementing
source/fixture reviewer: founder-approved `/root/harness_acceptance_luna`.
The reviewer did not perform or approve a remote model execution.

## Actual result

The retained workspace profile on port 38883 uses the existing Codex subscription
login. No paid API credential, new model login, public relay or approval-mode
change was used. Native desktop UI automation was not used to grant approvals.

Real role chats, created once and subsequently reconciled by exact identity:

- Astra planning/research: `1c86eb4c-8a8f-41ca-bfda-11f78822e42a`,
  `gpt-6-astra`, medium effort, standard tier, approval-required.
- Sol build orchestration: `dc04df35-bb2e-441a-ae70-a364710962f3`,
  `gpt-6-sol`, low effort, standard tier, approval-required.

One finite read-only Sol turn was dispatched through T3's existing authenticated
orchestration endpoint. The local owner CLI used only read/operate scopes with
a two-minute lifetime and a final revocation; it never prints the issued token.

Message `c5a6d2d1-cbb4-4848-9c8b-f8e99607c67f`;
turn `01a0e837-fef8-7233-8263-7728681dd72b`.
The exact command's one-time approval request was
`e303fa94-de01-472d-abc9-d371730e2bd6`. No accept-for-session/always decision.

Command:

```powershell
Get-Location
git branch --show-current
git rev-parse HEAD
Get-Content -LiteralPath PROJECT.md -TotalCount 12
```

The requested executable was the already installed bundled PowerShell. The
helper checked the complete command string, current turn/thread and sole request
before dispatching `accept`; an exclusive receipt prevents replay.

Actual observed state: completed; session ready. Sol reported
`C:/Users/astha/.codex/worktrees/harness-app/yellow`, `phase-0/harness-app`,
HEAD `b0156db5c4399a833d9d80055ebcb3935e4dc575`, and the PROJECT.md precedence.
Observed activities: approval.requested, tool.started, approval.resolved,
tool.completed, checkpoint.captured. No source edit was requested or performed.

## Commands and limits

From `D:/Yellow/harness/t3code`:

```powershell
node --experimental-transform-types scripts/yellow-harness-roles.mjs
node --experimental-transform-types scripts/yellow-harness-roles.mjs proof
node --experimental-transform-types scripts/yellow-harness-roles.mjs inspect
node --experimental-transform-types scripts/yellow-harness-roles.mjs approve-readonly
node --experimental-transform-types scripts/yellow-harness-roles.mjs observe
node --experimental-transform-types --test scripts/yellow-harness-roles.test.mjs scripts/yellow-harness-codex-proof.test.mjs
```

Do not rerun proof/approval: the original request/approval identities remain in
`D:/Yellow/harness/state-workspace/codex-readonly-proof.json` and its separate
`.approval.json`. Read-only observation is allowed. Unknown dispatch has no
transparent retry or provider fallback. Subscription usage is amount unknown,
not zero plan usage; paid API calls in this bounded path: zero.

Initial model-option verification failed before inference dispatch because the
server's canonical options use an array, not the legacy object shape. The
helper now validates the canonical options and rejects duplicate option IDs.
The first terminal approval remained pending until the exact-only helper was
independently reviewed; no approval controls were relaxed.

Parent latest focused result: 10 passed, 0 failed, 0 skipped. Reviewer personally
executed the complete post-dispatch-binding delta: 10 passed, 0 failed. Both
preflight and post-acknowledgment checks reject mismatched role identities,
projects, model options and approval/interaction modes.
Focused four-file formatting and lint passed. This is not a whole T3 build,
Yellow database referee, live GitHub PR flow or independent release acceptance.

## Worker restoration, separate evidence

Worker 1's current exact 27B weights passed length/hash verification. Official
b11216 CUDA archive was initially truncated to 107691802/172252243 bytes and
was not extracted or executed. A bounded same-official-source range resume
recovered exact SHA256
`058181c6679888d06385f6ca81b9f6cc0490f35cbd385e4a7fcafd1f8cb32289`.
The truncated file is retained separately, not silently replaced or deleted.

The official prebuilt CLI then failed because Kaggle's system libraries lack
GLIBC_2.38/GLIBCXX_3.4.32. No system libraries or model/runtime pins were changed.
The same approved source revision was compiled locally for CUDA architecture 75.
The initial new builder's timeout review was NO-GO: the stage limits summed to
55 minutes and a surviving child could escape cleanup after the leader exited.
Both defects were repaired with a shared deadline and whole-group cleanup test
before any notebook execution. The reviewer personally executed 4 source-builder
and 7 prebuilt-helper tests successfully, without a remote inference call.

The actual private notebook completed compilation at 2026-09-28T14:26:55Z;
build stage elapsed 1545.92 seconds. Its version/device checks passed, exposing
CUDA0 and CUDA1, both Tesla T4 with 14911 MiB each. The verified runtime was
promoted to `/kaggle/working/yellow-qwen38/runtime-source-b11216/llama-cli`.
Exact runtime revision: `c8296709920f9c1ae168bfd5fe66f9f73637bd60`;
binary SHA256 `75c29f81fa85f095178c99b4dcd6453168d5a4bdd02cd05a83d863396e022ccb`;
runtime-manifest SHA256
`d28f7516c5477d491a87f48510a0fc401a95fc9f072e1f13b7fb74bb9ec7ff55`.
The receipt explicitly reports `inference_executed: false`; a successful compile
is not a loaded model, fresh generation, throughput benchmark or connected worker.

Worker 2 is not currently accessible through the connected browser controls.
Older finite notebook inference is historical, not live worker connectivity.
No private API enrollment, automatic transport or accepted worker artifact is
established. Public relay remains declined. Manual results remain unsigned
advisory proposals, not coordinator authority.

## Skills and plugin discovery

The existing Codex home is referenced in place, not copied. A bounded call using
T3's native Codex skill-probe implementation returned 287 enabled skill entries
for the harness implementation project, including installed Claude Cowork skills.
A separately bounded native `plugin/installed` request returned 111 installed,
enabled plugin entries with zero marketplace-load errors. Counts are entries,
not distinct names, because provider aliases can repeat. Both checks sent zero
model-generation requests and changed no plugin, credential or approval settings.
Discovery does not establish that every connector is authenticated or that
desktop-only tools work inside T3. Separate Claude account/CLI discovery and
cross-provider skill execution have not been established.

## Readiness boundary

Codex running a real repository terminal turn through T3 is established. Full
Codex/Claude parity, automatic free-worker build/review, independent accepted
artifacts and a current self-contained installer are not established.
No CompSet activation/handover, approval-history rewrite, canonical Yellow edit,
production DB mutation, merge, public PR, or paid API fallback occurred.
