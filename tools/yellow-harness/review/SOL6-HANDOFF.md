# Universal Harness — Astra independent review and Sol 6 handoff

28 September 2026. Review complete; implementation acceptance **not granted**.
Founder requested an immediate economical handoff to GPT-6 Sol. Stop expanding
this review and continue from the concrete source and findings below.

## Final founder intent and architecture verdict

One fast screen named **Universal Harness** combining task execution (Goose's
role), a multi-agent coding workspace (T3's role), and work assignment/tracking
(Paperclip's role). Background dependencies are expressly allowed. Preserve
Codex/GPT, Claude-capable work, Gemini API keys, Antigravity, finite Kaggle
workers and future cloud models; support parallel work and ordered handoff.
Broad laptop operation should use persistent routine permissions.

**Adopt T3 as the one UI and execution-session host; Paperclip as the only job
coordinator.** Reuse existing adapters and Windows primitives. Goose remains an
optional execution backend, not a compulsory third UI. This architecture is
reasonable but is not yet built, benchmarked, integrated or production-ready.
Do not copy Paperclip scheduling into T3 or activate the old Python scheduler.

The review compared 19 OSS candidates. Goose was provisional; the founder
clarified it was one option. T3 has direct Codex app-server, Claude, OpenCode and
Antigravity adapters, provider profiles, worktrees, checkpoints and desktop UI.
Paperclip already provides jobs, ownership, budgets, schedules and cancellation.
Its external adapter source includes AbortSignal, onCancellationReady,
onDispatch and runId: reuse those hooks. Both selected roots are MIT licensed.

## Exact local assets

- Governance worktree: `C:/Users/astha/.codex/worktrees/harness-app/yellow`, branch
  `phase-0/harness-app`, base `c8cb60ada0e0f8aa981c04948a42adf94cc169e1`.
- T3: `D:/Yellow/harness/t3code`, branch `phase-0/yellow-personal-harness`,
  v0.0.42 / `719a76ca1dbf5490f1aa33ffb9966301e02be9a9`.
- Paperclip: `D:/Yellow/harness/paperclip`, same branch name, v2026.916.1 /
  **`d554c4789ed3930f8a53ac9fdf6503b3187097da`**, verified by clone/rev-parse.
  Use this actual acquired pin; earlier landscape reference to another commit
  is not the source identity of this checkout.
- Orders HARNESS-001 through HARNESS-004 are uncommitted. HARNESS-001 prototype
  repairs deferred; HARNESS-003 custom scheduling superseded. **HARNESS-004 is
  current.** Numeric 681–700 orders already collide with product work elsewhere.
- Review files here: UPSTREAM-LANDSCAPE.md, EXISTING-CONTRACT-AUDIT.md,
  WINDOWS-CAPABILITIES.md, and this handoff. Read those instead of re-researching.
- Only T3 source addition: uncommitted `scripts/yellow-pilot.mjs`. No core
  scheduler, bridge, UI, provider or native-control implementation was made.
- No commits, PRs, merges, live provider calls, account changes, Kaggle actions,
  model weights or Yellow runtime changes were performed by this review lane.

Preserve the dirty canonical Yellow checkout and controller/GPU worktree. Other
lanes continue independently. Do not import their unreviewed changes wholesale.

## Independently executed evidence

Controller audit agent ran current baseline: controller 9 tests, 8 passed and
1 Windows symlink skip; bridge 11 passed. It independently reproduced:

1. Windows case aliases and overlapping paths admitted simultaneously; controller
   also admits reserved/ADS/metadata paths rejected only by some downstream checks.
2. A lease may expire/reassign before provider dispatch, yet the stale worker still
   invokes the provider; rejecting its final result does not fence the side effect.
3. Controller accepts a task pinned to old HEAD after checkout moves; bridge has
   a separate base check. No unified apply/acceptance boundary exists.
4. No authenticated coordinator/reviewer ownership, durable cancellation or
   accepted/integrated outcome. Completed currently means proposal received.
5. Public sanitized handoff omits tools/build-continuity, required by its bridge.

These are activation blockers, not proof of a currently exposed remote exploit.
Keep them as regression requirements in the new integration. Full reproduction
commands, source hashes and receipts are in EXISTING-CONTRACT-AUDIT.md.

## Build/pilot state at handoff

- Node 24.19.0, Bun 1.3.14, Python 3.13.1 available. Rust SDK absent from checked
  conventional locations; dotnet reports no SDK. No global installs performed.
- T3 filtered dependencies installed successfully with pnpm **11.10.0**, frozen
  lockfile, scripts disabled (12/16 workspaces, 1004 packages). Initial download
  timed out; reduced concurrency 4 and fetch timeout 300000 completed using cache.
- `node scripts/yellow-pilot.mjs check` **passed**, including real ServerSettings
  schema decoding and a child os.homedir() check against the synthetic profile.
- Synthetic state: `D:/Yellow/harness/state-pilot`; all six providers disabled,
  nonexistent executable paths, telemetry/update checks disabled, no live data.
- Web build `node node_modules/vite-plus/bin/vp run --filter @t3tools/web build`
  transformed 6004 modules but **FAILED** in t3code:third-party-licenses with a
  fetch ConnectTimeoutError. Do not call this a successful build. Preserve and
  satisfy the licence-notice step; do not remove it to make a green result.
- Reviewed Electron install script was started, then **interrupted** at founder's
  fast-handoff instruction. Recheck installation before attempting desktop launch.
- Neither app/server/DB was launched. No rendered UI or speed/RAM benchmark exists.
  Paperclip dependencies were not installed. Its AGENTS quickstart says PGlite,
  but actual config.ts currently uses embedded-postgres/postgres: follow source.
- T3 build session 44445 ended exit1; Electron install session 92348 ended exit1.
  Clone/install sessions completed. No review-owned dev server is running.
- Last D: free space about 12.98 GB. Keep >=5 GiB free. Whole-app RAM unmeasured;
  laptop has ~15.35 GiB physical, typically only ~3–4 GiB free during this session.

## Integration sequence for Sol

1. Finish T3 baseline build and isolated UI proof. Then provision a separate
   loopback Paperclip pilot with synthetic company/paused agents. No resident
   startup service until measured. Do not run authenticated generation yet.
2. Build a narrow authenticated T3→Paperclip facade and native main-workspace
   Jobs/Agents view. Paperclip owns tasks/budgets/runs. No iframe, renderer secrets
   or separate dashboard. Preserve issue status versus execution status, unknown
   cost versus zero and explicit stale/disconnected state. Costs need date ranges.
3. Add external Paperclip `t3` adapter only for jobs needing T3's existing chat,
   approval, diff and checkpoint experience. Durable runId/request-digest binding
   maps to deterministic T3 commands. Duplicate same digest reconciles; different
   digest rejects; uncertain dispatch pauses rather than repeating a billed turn.
4. One workspace owner: Paperclip-created isolated checkout is attached to T3;
   do not duplicate worktree lifecycle. T3 WS bootstrap currently falls back to
   source checkout in some cases: execution bridge must reject that fallback.
5. Rotation across providers uses a new conversation, explicit result and pinned
   revision. Never exchange opaque provider resume tokens. Cancellation requests
   owned-thread interruption, awaits acknowledgement, never kills shared T3.
6. T3 already has xa11y0.13.0 UIA actions, ffi-rs Win32 focus and Playwright browser
   tools. Extend existing MCP/IPC. No need to install Windows-MCP/FlaUI initially.
   One actuator per desktop; effect-time grant/revocation and stale-target checks.
7. Official provider auth/model discovery next; finite Kaggle relay/lease adapter
   separately. No quota/key evasion, undisclosed paid fallback or private-source
   egress. Same-project Gemini keys share project quota. Astra UI access does not
   establish API entitlement. Preserve the other lane's current Kaggle work.

## Important integration traps

T3 full-access defaults map to very broad provider shell permissions. Scoped
desktop-tool grants alone do not sandbox that shell. Standing permissions can
remove routine product prompts; they cannot defeat UAC or provider constraints.

Fresh T3CODE_HOME alone does not isolate startup: AnalyticsService obtains
identity from real OS-home Codex/Claude files even with telemetry sending off.
The pilot launcher constructs a separate USERPROFILE/HOME/APPDATA/LOCALAPPDATA,
allowlists child environment and validates disabled-provider settings before
startup. Invalid upstream settings can silently fall back to enabled defaults.
The launcher itself has not received independent code review or runtime proof.

Use focused mock-provider tests for restart/duplicate/cancel/parallel isolation,
then an independent reviewer-executed acceptance run. Do not claim the complete
Universal Harness, OS authority, Kaggle quality or a speed advantage is delivered.

Sources: https://github.com/pingdotgg/t3code ;
https://github.com/paperclipai/paperclip ;
https://github.com/aaif-goose/goose . Exact source links and comparison evidence
are retained in the adjacent review documents.
