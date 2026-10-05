# Windows capability reuse and implementation handoff

Reviewed 28 September 2026 under HARNESS-001; source follow-up under HARNESS-003.
This is a research/design artifact,
not an executable security review or evidence that laptop control is built.
No upstream software was installed, no desktop was operated, and no provider or
Kaggle session was contacted by this subreview. The only local commands inspected
repository instructions/state and toolchain/OS availability.

## Decision

**Reuse the native libraries and authenticated transport already in T3 Code.**
Read-only inspection of `D:/Yellow/harness/t3code` at
`719a76ca1dbf5490f1aa33ffb9966301e02be9a9` supersedes the earlier proposal to add
Windows-MCP or FlaUI for the first adapter. No additional OS automation dependency
or resident service is needed for that slice. T3 remains a build/acceptance
candidate, not a measured performance winner. Keep the earlier Python controller
as contract/reference material, not a second scheduler or the finished harness.

The desktop manifest already pins MIT `@crowecawcaw/xa11y` 0.13.0, `ffi-rs` 1.3.2
and `playwright-core` 1.60.0. Snapshot code uses xa11y for Windows UI Automation
and screenshot capture; Win32 FFI reads foreground-window identity and restores
focus. The pinned xa11y declarations also provide element press/focus/setValue/
typeText and InputSim pointer/keyboard operations. Those dependency APIs are not
yet T3 native-control MCP tools. Its existing `device_*` tools control mobile
simulators/emulators, so a Windows desktop grant needs a distinct capability.

Extend T3's provider-scoped MCP credentials, typed host transport and main-process
IPC with standing desktop grants. Existing browser automation supplies useful
patterns for action receipts, serialization and interruption. Do not expose native
control to embedded preview pages. UFO/FlaUI/Windows-MCP remain researched options
for a later demonstrated gap, not planned dependencies.

Primary package evidence: [xa11y publisher repository](https://github.com/xa11y/xa11y/),
[pinned package metadata](https://registry.npmjs.org/@crowecawcaw%2fxa11y/0.13.0),
[pinned published API](https://unpkg.com/@crowecawcaw/xa11y@0.13.0/native.d.ts).

## Current upstream evidence

The following are source-level findings, not laptop benchmarks. Root licenses do
not prove that all resolved dependencies, binaries or model weights share them.
Pin source commits and produce a resolved dependency/license inventory before
copying code or installing a release.

| Candidate | Windows and callable interface | Source/license and release evidence | Decision and footprint implication |
| --- | --- | --- | --- |
| Open Interpreter | Current project is a Rust coding-agent rewrite based on open-source Codex; documents Windows, ACP, Codex exec protocol and MCP. Its computer-use integration delegates to agent-browser/trycua. | Apache-2.0; `rust-v0.0.45`, 20 Sep 2026. Repository push observed 27 Sep. | Credible interchangeable coding-worker candidate. It is not the old Python computer API project and not a native desktop broker. Do not add another resident loop merely for GUI control. |
| Microsoft UFO | Windows-first UIA, native COM and screenshot control; callable MCP collection/action servers and Windows sessions. | MIT; `v3.0.10`, 22 Sep 2026. | Reuse UIA/COM concepts or bounded modules. Avoid the complete orchestration/retrieval stack initially: requirements include LangChain, FAISS, sentence-transformers, pandas and matplotlib. |
| Agent S | Python CLI/SDK, Windows/macOS/Linux; supports model-provider adapters and computer-use actions. | Apache-2.0; latest API-reported release `v0.3.2`, 16 Dec 2025; repository push observed 5 Sep 2026. | Optional planner/vision evaluation. Default installation includes PaddleOCR/PaddlePaddle and scientific dependencies. Setup declares Python `>=3.9, <=3.12`, incompatible with the inspected Python 3.13.1 environment. Not the low-footprint first actuator. |
| OpenClaw Windows Hub | Native WinUI companion and Windows-node capability registry. Official docs describe local authenticated loopback MCP without a running OpenClaw Gateway. | Hub MIT; stable `v2026.9.4` listed 15 Sep 2026, with newer alpha releases. Separate source repository and release train from the main MIT OpenClaw repository. | Useful native shell/device-registry alternative, not WSL-only. Its first-run default can provision WSL; do not invoke that flow for this architecture. A source build currently requires .NET SDK 10.0.400+, Windows SDK and Node. Do not adopt its full gateway solely for device operations. |
| UI-TARS Desktop / Agent TARS | Windows-capable visual desktop operator, TypeScript SDK/operator modules; Agent TARS also has CLI/headless server and MCP. | Apache-2.0. Monorepo release `v0.3.0` corresponds to Agent TARS; current desktop package manifest says `0.2.4`. Do not conflate their versions. | Optional screenshot-grounding/action-parser adapter. Avoid a second Electron shell and local vision model. Current desktop manifest includes Electron 34.1.1 and native operator dependencies; those exact dependencies need freshness/security review before reuse. |
| Windows-MCP | Native Windows 10/11 Python MCP, selectable tools; UIA snapshots, screenshots, app/window actions, keyboard/mouse, files, processes, PowerShell and registry. | MIT root; `v0.8.6`, 26 Sep 2026. Current manifest requires Python 3.14+. | Superseded for the first adapter by T3's existing xa11y. If a later gap justifies reuse, disable telemetry and audit `fuzzywuzzy`/`python-levenshtein`; root MIT alone is insufficient. |
| FlaUI / pywinauto | FlaUI wraps Microsoft's UI Automation for .NET Windows applications; pywinauto offers Python Win32/UIA APIs. Neither requires its own model or orchestration loop. | FlaUI MIT, latest listed `v5.0.0`; pywinauto BSD-3-Clause, latest listed `0.6.9`. | Reference/fallback only for a demonstrated xa11y gap. No extra native backend is needed for the first T3 slice. |

Primary references for the table:

- [Open Interpreter README](https://github.com/openinterpreter/openinterpreter),
  [0.0.45 release](https://github.com/openinterpreter/openinterpreter/releases/tag/rust-v0.0.45).
  Its README explicitly identifies the old Python project as a separate community
  fork. Do not describe the new project as Python-only or use its historical license.
- [UFO repository](https://github.com/microsoft/UFO),
  [v3.0.10](https://github.com/microsoft/UFO/releases/tag/v3.0.10),
  [MCP design](https://github.com/microsoft/UFO/blob/main/documents/docs/mcp/overview.md),
  [UIA backend](https://github.com/microsoft/UFO/blob/main/documents/docs/configuration/system/system_config.md),
  [requirements](https://raw.githubusercontent.com/microsoft/UFO/main/requirements.txt).
- [Agent S](https://github.com/simular-ai/Agent-S),
  [package/runtime requirements](https://raw.githubusercontent.com/simular-ai/Agent-S/main/setup.py).
  Published benchmark results are not Yellow or this laptop's acceptance evidence.
- [OpenClaw Windows documentation](https://docs.openclaw.ai/platforms/windows),
  [Hub source](https://github.com/openclaw/openclaw-windows-node),
  [Hub license](https://raw.githubusercontent.com/openclaw/openclaw-windows-node/main/LICENSE),
  [Hub releases](https://github.com/openclaw/openclaw-windows-node/releases),
  [Hub build requirements](https://raw.githubusercontent.com/openclaw/openclaw-windows-node/main/DEVELOPMENT.md).
- [TARS repository](https://github.com/bytedance/UI-TARS-desktop),
  [releases](https://github.com/bytedance/UI-TARS-desktop/releases),
  [desktop manifest](https://raw.githubusercontent.com/bytedance/UI-TARS-desktop/main/apps/ui-tars/package.json).
- [Windows-MCP tools, transport and telemetry](https://github.com/CursorTouch/Windows-MCP),
  [manifest](https://raw.githubusercontent.com/CursorTouch/Windows-MCP/main/pyproject.toml),
  [releases](https://github.com/CursorTouch/Windows-MCP/releases).
- [FlaUI](https://github.com/FlaUI/FlaUI),
  [FlaUI releases](https://github.com/FlaUI/FlaUI/releases),
  [pywinauto](https://github.com/pywinauto/pywinauto),
  [pywinauto releases](https://github.com/pywinauto/pywinauto/releases).

The Windows-MCP manifest directly declares `fuzzywuzzy>=0.18.0` and
`python-levenshtein>=0.27.1`; the
[fuzzywuzzy license](https://github.com/seatgeek/fuzzywuzzy/blob/master/LICENSE.txt)
is GPLv2. This does not pass Yellow's permissive-only adoption rule as an
unexamined bundle. Remove the fuzzy imports/dependencies in the bounded fork and
prove exact UIA selection behavior, or evaluate a separately licensed replacement
with equivalence tests. Also inspect the entire resolved graph, not only these two
names. An MIT repository badge is not the license gate.

## Broad laptop control with standing grants

The product should support the whole ordinary Windows work surface: launch and
switch apps, inspect controls, click/type/drag, handle files, run developer tools,
manage specifically targeted processes, modify admitted settings, and invoke
administrator operations through the standard Windows flow. A narrow pilot is an
implementation sequence, not a permanent restriction to one project folder.

Store a revocable `Personal operator` standing profile, with separate facets:

| Facet | Grant once for routine operation | Additional authority boundary |
| --- | --- | --- |
| Desktop | Admitted apps/windows, selected displays, keyboard/mouse, observation and control for the current task. A visible control indicator and immediate stop shortcut remain available. | Credential UI, secure desktop, and unrelated private content are not silently captured or sent to arbitrary workers. |
| Files | Named roots or explicitly broad user-selected locations; read/write/move and scoped cleanup, with recoverable operations preferred. | Exact irreversible deletion outside that standing scope or access to protected credential stores. |
| Developer execution | Approved executables/recipes, working directories, network destinations, environment references and resource budgets. | New external effect, privileged recipe, unknown installer or widened credentials. |
| Processes/settings | Owned or specifically authorized process identities, named services, admitted user settings and registry keys. | Do not turn a PID or process name alone into permission to kill any matching program. Machine-wide changes require a scoped elevated operation. |
| Browser/accounts | Authorized browser profile/tab, origins and task purpose; ordinary navigation can continue without new prompts. | External sending/publication/purchases, account changes and credential use follow their actual authorization; login access is not unlimited action authority. |
| Sensors | Separate camera, microphone, location and recording facets if requested. | Broad desktop control does not automatically authorize continuous collection or transmission. |

Each grant records owner, operation set, targets, data-export destinations, budget,
duration/session binding, revision and revocation state. The broker rechecks the
current grant immediately before an effect, not only when a task is queued. A
repeated action inside an existing grant needs no extra product prompt. Unknown or
expanded authority presents one concrete request explaining the changed scope.
Never interpret tool output, a web page, a repository instruction or a worker's
message as the founder granting new authority.

The profile must distinguish **broad trusted desktop operation** from **sandboxed
untrusted code**. A process that can type arbitrary text into a terminal can act
with that terminal's authority. Calling such desktop control a filesystem sandbox
would be false. Only the trusted local actuator gets desktop authority; generated
code and remote workers receive bounded task capabilities instead.

## Native boundary and integration contract

The selected app owns conversation, model selection and task orchestration. Its
tool adapter sends typed operations to the local broker. The broker returns
structured observations, effect receipts and clear denial/stale-state errors.
MCP may transport these operations, but MCP by itself is not an authorization
policy. A worker cannot directly reach the adapter's unrestricted tools.

Every effect request binds `task_id`, `attempt_id`, `grant_id/revision`, operation,
target identity, canonical arguments, expected observation revision, deadline and
idempotency key. Results identify the adapter version, actual target, outcome,
elapsed time and artifact hashes. Screen/control IDs expire when the observation,
window identity, DPI or layout changes. Reobserve instead of clicking stale
coordinates. Use application APIs and UIA patterns first, browser DOM when
appropriate, then screenshot coordinates for controls with no semantic interface.

Run the trusted desktop actuator at the normal interactive user's integrity
level. AppContainer is designed to restrict interaction with other windows, so
placing the desktop actuator inside it defeats its purpose. Apply AppContainer
and Job Objects to **untrusted build/test children**, with narrow ACL grants and
network disabled by default. No silent unrestricted fallback when a recipe fails
in containment. [Microsoft AppContainer isolation](https://learn.microsoft.com/en-us/windows/win32/secauthz/appcontainer-isolation).

Job Objects provide lifecycle/resource control: assign a suspended child before
resuming, disable breakaway, cap process count/committed memory, and use
kill-on-job-close. Keep broker-owned handles private. They are not a comprehensive
security boundary: Microsoft documents that children created through
`Win32_Process.Create` are not automatically associated with the job.
[Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects),
[limit flags](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information),
[committed-memory limits](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_extended_limit_information).

For administrator actions, launch a separate short-lived helper using the normal
OS elevation flow. Bind the helper to one reviewed operation manifest, caller,
nonce, deadline and exact targets; return an auditable result and exit. Do not run
the whole chat/model loop permanently as administrator. Do not automate the UAC
secure desktop, disable UAC, or adopt `UIAccess` as a general privilege shortcut:
Microsoft explicitly excludes non-assistive applications from its intended use.
[UIAccess and integrity boundaries](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-securityoverview).

Store provider credentials in the broker's current-user protected store. DPAPI
usually binds decryption to the same user/machine; it does not isolate a secret
from all other code already running as that user. Avoid machine-wide DPAPI and
keep plaintext out of UI state, logs, command lines and worker envelopes.
[CryptProtectData](https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata).

For broker-managed files, validate final opened-handle identity, allowed root and
access mode. Defend against junction/reparse escapes, hard-link aliases, alternate
streams and path replacement. A Git worktree shares administrative state; keep
trusted Git operations in the broker and use scratch exports for hostile code.
[Final paths by handle](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfinalpathnamebyhandlew).

If the selected product retains Electron, preserve its supported renderer
isolation and permission model rather than disabling it to connect tools. If a
later measured need justifies Tauri, restrict custom commands explicitly and
keep secrets out of the webview. Tauri permissions do not protect against unsafe
Rust implementation code, and a system WebView is not a RAM guarantee.
[Tauri process model](https://v2.tauri.app/concept/process-model/),
[Tauri capabilities](https://v2.tauri.app/security/capabilities/).

## Required proof and performance budgets

These are proposed acceptance thresholds, not results. Measure the selected real
application fork before changing UI technology. Count all descendants, renderers,
adapters and gateways; excluding a sidecar from the measurement is not a saving.

- Thirty-minute ordinary chat/diff/task trace: aim for combined idle private
  working set <=350 MiB and active p95 <=650 MiB. Report measured failure honestly
  and remove duplicate resident components before weakening the budget.
- Start with one local build/test job and a 1 GiB committed-memory job budget.
  Stop admitting new local jobs below 1.5 GiB available physical RAM. Large builds
  may need a separately budgeted worker; do not kill unrelated user applications
  to meet the target.
- Reopen saved project <=3 seconds; p95 input response <=100 ms; keyboard-only,
  visible focus, screen-reader labels, 200% scaling and reduced-motion checks.
- On stable native fixture apps, UIA observe p95 <=500 ms and an ordinary action
  plus reobserve p95 <=1 second, excluding provider inference. Bound tree depth,
  node count, screenshots and logs; include large/slow UI trees in the test.
- Thirty consecutive routine operations inside a standing grant produce zero
  redundant product approval prompts. A target/scope expansion produces exactly
  one specific request. Revocation prevents the next effect, including queued
  actions; already completed effects are not falsely reported as recalled.
- Test stale control IDs, closed/replaced windows, PID reuse, DPI/multi-monitor
  changes, focus theft, lock/sleep/resume, disconnected RDP and user interference.
  Failure must not redirect input into another window.
- Test cancellation, broker crash, owned-child cleanup, blocked network,
  out-of-root access, credential canaries, reparse/hard-link races and oversized
  outputs. Independently execute these proofs; a source inspection is not enough.
- Verify elevation denial/cancellation and helper manifest tampering safely in
  a synthetic fixture. Do not use real account, registry or service mutations as
  exploratory tests. Live administrator proof belongs to its separately scoped
  implementation order.

Run native UI control as a single actuator lane. Multiple model workers may
reason in parallel, but they may not race for the same keyboard, focused window
or desktop. Browser tasks can parallelize only across explicitly isolated profiles
or sessions whose adapters do not share that actuator.

For Yellow work, tool access does not relax PROJECT.md. PostgreSQL remains the
business authority; respect occupancy choke points, append-only records, RLS and
transaction-local tenancy, bigint money, property-local business dates, token-only
payments and atomic outbox effects. Use synthetic fixtures. High-risk proposed
changes still require independent reviewer-executed proof and the canonical
11/11 gate before a reviewable Yellow PR. No remote worker gets a production DB
credential or authority to operate the live application simply because its model
can propose code.

## Actual local readiness observation

Read-only probe in this session found Windows 11 Home Single Language build 26200,
15,720 MiB visible RAM and 3,866 MiB free at the instant sampled. Free RAM is
transient, not a guaranteed budget. Available commands reported Node 24.19.0,
Bun 1.3.14 and Python 3.13.1. `dotnet` exists but `dotnet --list-sdks` returned no
SDK. Rust/Cargo were not on PATH or in the conventional user `.cargo/bin` paths;
this does not prove they exist nowhere on disk. No compiler or dependencies were
installed. These observations make an automatic full UFO/Agent-S/WinUI/Rust build
claim premature.

## Next bounded native slice

1. Reuse the pinned xa11y and Win32 helpers already in T3. Add typed list/observe/
   focus/press/set-value operations, authenticated through the existing MCP and
   desktop IPC path. The server and local main process must both enforce a
   host-bound desktop grant; no additional daemon or Python runtime is needed.
2. Wire only observation, application selection and synthetic fixture editing
   through that native adapter and standing grant. Prove
   stale-target rejection, revoke/cancel and single-actuator ownership. Keep file,
   process, registry, shell and elevated operations disabled until their individual
   typed contracts are implemented and independently exercised.
3. Add broader user-granted filesystem/developer/process capabilities, then a
   separately reviewed elevation helper. Preserve all routine grants across app
   restarts with explicit revocation and receipts. Add sensor/recording capabilities
   only if requested. Measure before enabling automatic startup or a resident fleet.

The restriction in step 2 is a temporary acceptance boundary. The founder's
product goal remains a broad personal laptop operator with few routine prompts;
the completed feature must be assessed against that goal, not relabeled complete
after one Notepad demonstration.

## T3 source integration and permission caveats

Relevant existing paths, relative to the inspected T3 checkout:

- `apps/desktop/src/snapShot/SnapShotAccessibility.ts`: foreground UIA tree and
  3-second accessibility deadline. `SnapShotAccessibilityProcess.ts` provides a
  child process with 1-second start/4-second result limits and completion cleanup.
  This contains hangs; it is not a malicious-code sandbox.
- `apps/desktop/src/electron/WindowsForeground.ts` and
  `WindowsForegroundFocusWorker.ts`: normal-user foreground identity/focus. The
  cached element/title/bounds matching is not an authorization token. Revalidate
  HWND, PID/process identity and observation freshness before acting.
- `apps/server/src/provider/Layers/ProviderService.ts:869`: fail-closed
  environment/project tool availability, checked when a provider session starts.
  `apps/server/src/mcp/McpInvocationContext.ts` carries capabilities.
- `apps/server/src/mcp/McpSessionRegistry.ts`: 32-byte bearer credentials hashed
  in memory and scoped to environment/thread/provider session. Its 24-hour sliding
  liveness is not a finite desktop action lease or immediate settings revocation.
- `apps/server/src/mcp/PreviewAutomationBroker.ts`: existing connection-pinned
  queue/response transport and no action retry on timeout. It permits failover
  after host disconnect; native desktop grants must instead remain bound to the
  selected host. Timeout leaves a potentially unknown mutation outcome.
- `apps/desktop/src/preview/Manager.ts:1437`: per-tab action serialization,
  interruption epoch and cleanup. Native input needs one lock per Windows desktop.
- `apps/desktop/src/ipc/methods/snapShot.ts:33`: trusted main-window sender check;
  use the pattern for native methods. Keep preview sandbox and Node restrictions.
- `packages/contracts/src/settings.ts`, `packages/contracts/src/ipc.ts`,
  `packages/client-runtime/src/state/preview.ts`,
  `apps/web/src/components/preview/PreviewAutomationHosts.tsx`, and
  `apps/server/src/auth/RpcAuthorization.ts` are the existing settings/schema/
  transport integration points; a sibling desktop capability must not alter the
  meanings of browser/mobile grants.

The current default in `packages/contracts/src/orchestration.ts:135` is
`full-access`. Codex maps it to `never`/`danger-full-access`; Claude to
`bypassPermissions`; OpenCode permits wildcard and external-directory actions.
Preserve existing user/provider choices. A scoped native grant governs the new
native toolkit, not an unrestricted same-user provider shell. Actual process/OS
confinement is separate sandbox work, and the application must not imply otherwise.

Check the current grant revision at the effect boundary, not only at credential
issuance. Revoke/stop increments the revision, drains queued actions, invalidates
observations and releases owned input state. Require explicit reattachment after
host loss. Keep normal UAC for elevated operations. Existing capture contracts cap
text at 32,000 characters and trees at 10,000 nodes; measure actual memory/latency
before adjusting. No tests or provider/desktop actions were run in this source
review, so these are implementation entry points and required proofs, not proven
end-to-end native capabilities.
