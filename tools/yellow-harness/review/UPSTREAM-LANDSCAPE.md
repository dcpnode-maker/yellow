# Open-source harness landscape and product-fork decision

Date: 2026-09-28. Scope: HARNESS-001 architecture/research only.
Author: independent upstream-selection review agent.

## Decision

**Fork T3 Code as the one product foundation.** Reuse its desktop application,
web UI, server, provider adapters, durable orchestration, Git checkpoints and
review surfaces. Extend its existing boundaries for Yellow policy, Windows
capabilities, resource budgets and finite Kaggle workers. Do not build another
chat UI or agent loop, and do not run a second orchestration framework beside it.

Adoption candidate:

- Upstream: <https://github.com/pingdotgg/t3code>
- Release: `v0.0.42`, published 2026-09-16 04:59 UTC.
- Exact commit: `719a76ca1dbf5490f1aa33ffb9966301e02be9a9`.
- Root license: **MIT**, inspected at the release tag.
- License: <https://github.com/pingdotgg/t3code/blob/719a76ca1dbf5490f1aa33ffb9966301e02be9a9/LICENSE>
- Release: <https://github.com/pingdotgg/t3code/releases/tag/v0.0.42>
- Source pin: <https://github.com/pingdotgg/t3code/tree/719a76ca1dbf5490f1aa33ffb9966301e02be9a9>

The tag SHA was obtained with `git ls-remote` and agrees with the release's
linked commit. No clone, installation, authenticated account query or provider
call was performed by this research lane. This is an adoption decision, not a
claim that the candidate passes Yellow's acceptance tests.

The founder's clarified priority is a modified existing app that preserves
Codex/Claude-style work, rather than a new UI over an isolated model loop.
T3 already exposes the necessary agent-backend seam. Goose remains a good
model-neutral agent, but adding a direct Codex session adapter to Goose would
duplicate work that T3 already contains.

## Why T3 fits the requested fork

Source inspection found these implemented boundaries, not merely marketing
claims:

1. `apps/server/src/provider/Services/ProviderAdapter.ts` normalizes session
   start, turn dispatch, interruption, approvals, user questions and stop. It
   explicitly declares model-switch, compaction and conversation-rollback
   capabilities.
2. `apps/server/src/provider/Layers/CodexAdapter.ts` integrates the Codex
   app-server protocol, including Windows sandbox notifications and native
   multi-agent child-thread signals.
3. `docs/internals/providers.md` describes distinct provider instances, account
   isolation, native Antigravity process ownership, OpenCode instance lifetime,
   approval scope and capability limits. It explicitly distinguishes a native
   tool denial from a real sandbox.
4. `docs/internals/overview.md` describes a durable event log: command receipts,
   events and projections commit together; reactors perform later side effects.
   Checkpoints use hidden Git refs, and unsupported conversation rollback fails
   before filesystem reversion.
5. Existing Electron desktop, web and mobile clients share connection/domain
   state through `packages/client-runtime`. Windows installation is documented;
   the desktop bundles its server runtime.

Pinned sources:

- [Provider contract](https://github.com/pingdotgg/t3code/blob/719a76ca1dbf5490f1aa33ffb9966301e02be9a9/apps/server/src/provider/Services/ProviderAdapter.ts)
- [Codex adapter](https://github.com/pingdotgg/t3code/blob/719a76ca1dbf5490f1aa33ffb9966301e02be9a9/apps/server/src/provider/Layers/CodexAdapter.ts)
- [Provider constraints](https://github.com/pingdotgg/t3code/blob/719a76ca1dbf5490f1aa33ffb9966301e02be9a9/docs/internals/providers.md)
- [Architecture](https://github.com/pingdotgg/t3code/blob/719a76ca1dbf5490f1aa33ffb9966301e02be9a9/docs/internals/overview.md)
- [Install guide](https://github.com/pingdotgg/t3code/blob/719a76ca1dbf5490f1aa33ffb9966301e02be9a9/docs/user/install.md)

These are source-verification findings. No runtime behavior was independently
executed during this research.

## Broad comparison

This is a bounded landscape review of serious candidates and newly discovered
alternatives, not an assertion that every repository on the internet was found.
The table distinguishes product fit from model quality. An adapter does not
grant model entitlement, API credits or access to another product's private
features. RAM is unmeasured for every candidate on this laptop.

| Candidate | Reusable app / Windows evidence | Providers and parallel work | License / release evidence | Decision |
| --- | --- | --- | --- | --- |
| **[T3 Code](https://github.com/pingdotgg/t3code)** | Complete Electron desktop, web and mobile control surface; native Windows installer/documented server | Existing Codex, Claude, Cursor, Grok, OpenCode and Antigravity agent adapters; workspaces/checkpoints and normalized session capabilities | MIT verified at `v0.0.42` / `719a76ca`; active release and substantial current code; README still warns early/bugs | **Selected product fork**: most direct reuse of the requested multi-agent desktop |
| **[OpenCode](https://github.com/anomalyco/opencode)** | Complete desktop; current `v1.18.32` uses **Electron**, not Tauri; Windows x64/ARM64 assets | Native multi-provider agent loop, Gemini/API/custom endpoints, ChatGPT connection documented; subagents and worktree source | MIT verified at `545f51d26cc39a907d2867492d498d9607ea5fa4`; release Sep 21 | Strong runner behind T3 for Gemini keys and compatible inference; not needed as a second product shell |
| **[Goose](https://github.com/aaif-goose/goose)** | Rust core plus Electron/React desktop; Windows release assets | Broad native providers, Responses support, MCP and ACP; Codex ACP currently lacks resume/fork and defaults `auto` to full access | Apache-2.0 verified; `v1.52.0` / `302b60806639ea9f0ae8f053f49f8bf0e88b26f4`, Sep 23 | Mature fallback agent backend; T3 avoids building the missing direct Codex integration |
| **[Cline](https://github.com/cline/cline)** | IDE/CLI/SDK plus newly published Tauri+Bun+Next.js desktop example; Windows installer | Broad model providers; subagent and worktree code/docs exist | Apache-2.0 repo; `desktop-v0.0.37` / `3da9771ea528538e301b080f5a9946bb56411f5c`, Sep 26 | Strong runner; desktop is explicitly an example and less direct than T3 for preserving multiple existing agent backends |
| **[Kilo](https://github.com/Kilo-Org/kilocode)** | IDE/CLI platform; Windows CLI and VS Code Agent Manager documented | Worktree fleet/manager, broad providers and BYOK; independent sessions do not automatically share a Swarm board | Current root MIT verified at `7d977bce994af36f0edf752cb53e3aefc7aeb214`; active Sep 26; latest GitHub release returned a JetBrains tag | Useful existing tooling; full IDE shell is unnecessary for the chosen desktop |
| **[Roo Code](https://github.com/RooCodeInc/Roo-Code)** | VS Code extension, not a standalone app | Modes/agent workflows within editor | Apache-2.0 repo; **archived**; last commit May 15, `v3.54.0` | Do not choose an archived base for new foundation work |
| **[OpenHands](https://github.com/OpenHands/OpenHands)** | Current Agent Canvas has a Windows desktop installer; no longer accurately described as Docker-only | Multiple local/remote backends, OpenHands agent and ACP agents including Codex/Claude/Gemini | MIT license inspected at `v1.24.0` / `7dc6805406ea3c76cb4a3ce407c3c72d481b0ac6`, Sep 25 | Serious runner/control-plane alternative; extra agent-server/automation stack and isolation setup are unnecessary on this laptop |
| **[Aider](https://github.com/Aider-AI/aider)** | Terminal pair-programmer; not a Codex-class desktop product | Strong bounded coding worker; broad model support, no equivalent complete fleet UI | Apache-2.0 repo; latest release `v0.86.0`, Aug 2025; main last commit May 2026 in observed metadata | Optional bounded worker, not app foundation |
| **[gptme](https://github.com/gptme/gptme)** | Tauri desktop now exists for Windows/Linux/macOS; older terminal-only descriptions are stale | Native Gemini/OpenAI/etc., subscription routes documented, ACP/MCP and multi-agent coordination | MIT repo; `v0.34.0`, Sep 18; active Sep 27 | Credible lightweight alternative, but would replace more of the existing Codex agent behavior than T3's direct integration |
| **[TrueForge](https://github.com/truefoundry/trueforge)** | Chat UI and embeddable SDK; local one-process SQLite mode | Model-neutral agent loop, approvals/subagents; documented sandbox initially Daytona | MIT verified at `f94b3106d6eb5c14a287677c3079d96597b9c3cf`; active Sep 27; release API returns chart tags | Useful generic harness, lacks this turnkey Windows desktop/device-control fit |
| **[Codex OSS](https://github.com/openai/codex)** | Rust CLI/app-server with native Windows assets; proprietary desktop UI is separate | Best direct authenticated GPT/Astra route; sessions, tools and native subagent machinery; custom endpoint wire protocol is Responses-only | Apache-2.0 verified; `rust-v0.157.1` / `36650394c5b38c2990ccf2a3457165ca3e9d9726`, Sep 26 | Primary backend through T3's existing adapter; do not build a replacement desktop around it |
| **[AgentMux](https://github.com/agentmuxai/agentmux)** | Rust backend with **CEF bundled Chromium**, not a current Tauri shell; Windows build documented | Structured multi-provider panes, interagent messages, swarm, device/browser panes; no Antigravity claim verified in inspected README | Apache-2.0 stated by upstream; `v0.57.6`, Sep 26; observed HEAD `f5e487dc830cc5b3d062f8c140e1e8865095589c` | Strong second shortlist choice; more expansive workspace authority and less directly verified Codex/Antigravity seam than T3 |
| **[OpenWork](https://github.com/different-ai/openwork)** | Electron desktop for Windows/macOS/Linux over OpenCode | Broad native model support/ChatGPT; skills and MCP sharing; emphasis on Cowork/team control plane | **Directory split**: desktop/core outside `ee/` MIT; `ee/` source-available EE license; older releases FSL. Latest `v0.18.54`; observed HEAD `d4d658cc` | Desktop/core are viable OSS; do not describe entire repository as permissive MIT. T3 is closer to coding-agent fleet goal |
| **[Vicoa](https://github.com/vicoa-ai/vicoa)** | Desktop/mobile/VPS agent workspace; self-hostable | 40+ agent integrations claimed, built-in Codex/Gemini/Antigravity, parallel worktrees | **AGPL-3.0**, genuine copyleft OSS, not permissive; `v0.1.32` | Promising feature match, but not a permissive code-copy base under Yellow's existing dependency policy |
| **[Hydra](https://github.com/jpdlr/hydra)** | Electron Windows/macOS/Linux app | Codex/Claude parallel sessions, session resume, MCP manager, budgets and headless queue | MIT stated; `v0.2.52`; observed HEAD `d8ad5611` | Good focused alternative; fewer verified existing provider integrations than T3 |
| **[Agentrium](https://github.com/talayash/agentrium)** | Tauri Windows/macOS app | Claude/Codex/Cursor/Antigravity side by side; tabs, worktrees, session restore/handoff | MIT stated; `v1.34.7`; observed HEAD `8007f46d` | Useful lighter terminal/workspace candidate; T3 has stronger inspected normalized event/session architecture |
| **[Paperclip](https://github.com/paperclipai/paperclip)** | Node/React control plane with embedded PostgreSQL | External agents, budgets, goals and organizational governance | MIT verified; `v2026.916.1`, Sep 21 | Avoid duplicate resident organization/runtime database |
| **[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)** | Node web UI/plugin runtime | Generic extensible loop; developer-preview compatibility breaks explicit | MIT verified at `21638c56315ae6a2b552d6091945d3144c9af32e`; no latest release returned | Defer rapidly changing preview as core |
| **[OpenClaw](https://github.com/openclaw/openclaw)** | Broad assistant gateway and cross-platform apps | Channels, tools, sessions and device nodes; host tools by default unless sandbox configured | Root MIT text verified at `2c962c0d`; GitHub metadata `NOASSERTION` requires actual notice inspection; `v2026.9.6` | Too broad for the coding desktop foundation; do not add another gateway |

Additional discovery surfaced terminal/worktree products such as Agent Grid,
Yardsort, GT Office, HyprDesk, RunJam and gxAgent. Their public descriptions show
that a new desktop is unnecessary, but they were not inspected to the same
depth as T3. They are not approved dependencies. OpenInterpreter is being
evaluated separately by the Windows-capability review lane; do not infer its
runtime proof from this report.

## What to modify, and what to keep

- Keep T3's existing `apps/desktop`, `apps/web`, `packages/client-runtime`,
  `packages/contracts`, provider adapters and orchestration/checkpoint machinery.
- Put capability, provider-instance and cost admission at existing server-side
  boundaries. Do not create another session store or contradictory scheduler.
- Translate the Yellow controller audit into activation regression requirements:
  canonical Windows paths, disjoint output reservations, current leases,
  cancellation fencing, immutable proposals, stale-base detection and independent
  acceptance. Retain old controller data/proofs without letting two systems claim
  authority over the same run.
- Primary Astra uses the existing Codex app-server adapter, subject to actual
  authenticated model discovery. Gemini keys and later API models can use T3's
  existing OpenCode backend; qualify a direct adapter only if that extra runtime
  is a measured problem. Antigravity uses its native adapter and account flow.
- Kaggle is an outbound authenticated finite worker behind a new adapter, with
  synthetic tasks by default. Do not open a public listener or upload Yellow
  source/secrets merely because other agent backends run locally.
- Only one loop owns a session. T3 dispatches to Codex, OpenCode or Antigravity;
  it does not ask one agent loop to impersonate another provider's completion API.
- Across engines, use explicit task checkpoints and a new destination session.
  Preserve accepted facts/artifact hashes and pending work, not a claim of
  perfectly portable hidden reasoning. Show provider and model changes visibly.

## Acceptance gaps and concrete first checks

1. **License/SBOM/build:** full transitive license audit, native binary provenance,
   clean reproducible Windows build and application startup at the exact pin.
   Root MIT does not license third-party binaries or provider services.
2. **Credential and model discovery:** preserve installed Codex/Antigravity
   installations; explicit native authentication only; no copying desktop auth
   tokens. Account state and model catalog are distinct from successful inference.
   Astra/effort availability remains unverified until discovery on the admitted
   backend. Subscription limits and API credits are separate.
3. **Permission defaults:** T3's initial new-thread default is **Full access**.
   Change this to the founder's scoped grant profile. Test equivalent denied
   actions through every backend, built-in tool, child process and delayed replay.
   Fewer routine prompts must come from explicit grants, not UAC/product bypass.
4. **Profile isolation:** inspect T3's Antigravity file-based credential profile
   decision and Windows ACLs. Its documented account-isolation approach is not
   automatically the founder's chosen secret-storage policy.
5. **Memory:** retain Electron initially and measure the entire process tree.
   T3 runs one OpenCode chat server per thread because of directory-scoped MCP
   state; cap concurrency and retire idle engines. Do not quote Rust/CEF core-only
   figures or installer sizes as laptop RAM proof. No local 27B model is assumed.
6. **Durability:** restart during an active turn; resume correctly; replay commands
   idempotently; reject stale approval replies; kill/reap children; fence late
   output after cancellation and lease reclamation. An accepted command receipt
   proves committed intent, not completed provider work.
7. **Backend parity:** test Codex, OpenCode/Gemini and Antigravity independently.
   Unsupported conversation rollback must fail before file changes. Check output
   receipts, not exit code alone, for refused or partial work.
8. **Product regression:** preserve chat, projects/worktrees, terminal, diff/review,
   model picker, tool traces and accessible keyboard navigation. Prove a real
   bounded Yellow task and independent review before calling it Codex-class.

Relevant pinned T3 references:

- [Permission modes and initial Full access default](https://github.com/pingdotgg/t3code/blob/719a76ca1dbf5490f1aa33ffb9966301e02be9a9/docs/user/permission-modes.md)
- [Desktop dependencies / Electron shell](https://github.com/pingdotgg/t3code/blob/719a76ca1dbf5490f1aa33ffb9966301e02be9a9/apps/desktop/package.json)
- [Codex accounts](https://github.com/pingdotgg/t3code/blob/719a76ca1dbf5490f1aa33ffb9966301e02be9a9/docs/user/providers-codex.md)
- [OpenCode current Electron shell](https://github.com/anomalyco/opencode/blob/545f51d26cc39a907d2867492d498d9607ea5fa4/packages/desktop/README.md)
- [Cline desktop example](https://github.com/cline/cline/blob/3da9771ea528538e301b080f5a9946bb56411f5c/apps/examples/desktop-app/README.md)
- [OpenHands current Agent Canvas](https://github.com/OpenHands/OpenHands/tree/7dc6805406ea3c76cb4a3ce407c3c72d481b0ac6)
- [OpenWork licensing split](https://github.com/different-ai/openwork#licensing)
- [Goose ACP limitations](https://goose-docs.ai/docs/guides/acp-providers/)
- [Codex authenticated discovery / managed login](https://learn.chatgpt.com/docs/app-server)

## Limits of reuse and evidence

No permissive fork supplies the proprietary Codex desktop, Claude desktop,
Claude Code internals, model weights, subscriptions or hosted service features.
Invoke supported installed tools and documented APIs under the user's accounts;
do not claim to clone private implementation or inherit paid access.

The broad scan uses first-party repository/source/release/docs pages and public
Git metadata. Source inspection is strongest for T3, OpenCode, Goose and Codex.
Some alternatives were screened at README/release level only. GitHub's anonymous
API quota was exhausted during research; later release and ref evidence came
from ordinary public repository/release pages and `git ls-remote`, not account
calls. No installed or running app, provider readiness, measured RAM, security
proof, quality benchmark, complete transitive audit or Kaggle activation is
claimed by this document.
