# Yellow continuity handoff for Goose

## Mission

Deliver a colleague-ready Yellow PMS public demo with complete implemented hotel
operating workflows, a realistic synthetic configured property, mobile-first UX,
and Yellow/Overwatch multilingual Gemini AI with confirmation-gated operational
actions. Notify the founder only when the complete demo is verified ready to share.

## Current authoritative position — 2026-09-22

- Branch: `phase-0/founder-context-demo-readiness`; inspect current HEAD and dirty
  state with `./state.ps1` rather than relying on this date-stamped summary.
- The accepted release candidate is frozen at
  `D:\Yellow\runtime\order605-344ab3485bf4a9da3d27ffca4cabbce75c36151b-source`.
- Order 605 local-target review is accepted for tunnel start, but public-origin
  closure is not complete. The tunnel remains off.
- Public database migrations 0098–0099 were applied and independently verified at
  frontier 99 / 130 tables. The full owner+ACL checkpoint is retained under
  `D:\Yellow\runtime\backups`.
- Order 606's deterministic departure-service duty-role fixture reconciliation was
  independently accepted. Order 605 public-origin verification remains to be closed;
  the tunnel remains off.
- Order 607 establishes this free/local continuity harness. OmniRoute is a router,
  not a source of free tokens. Laptop local Qwen is the default zero-cost model;
  Gemini/OpenRouter may be explicit free-tier fallbacks only after secure activation.

## Goose desktop continuity state

- Official Goose Desktop 1.51.0 is installed under `E:\yellow\goose`; its release
  archive checksum was verified before execution.
- Goose has a persistent local session named `Yellow Build Continuity`, rooted at
  this exact repository. It contains a sanitized Codex handoff and can use Chat
  Recall to retrieve that session; live repository evidence still supersedes it.
- `.goosehints` is the per-turn project boundary. Do not import or search raw Codex
  transcripts: they contain credentials, pairing codes, hidden control text and
  stale intermediate claims.
- The laptop model remains available as `qwen3.5:9b` through loopback-only Ollama. The 8K Vulkan
  lane repeatedly crashed the shared-memory runner, so the stable profile is one
  CPU-only 4K runner with 1K maximum Goose output. Direct local inference is proven;
  a full Goose wrapper smoke remained slow/stalled and was cancelled, so do not
  claim end-to-end agent completion until a bounded GUI turn visibly finishes.
- Goose is also verified end to end through loopback-only OmniRoute using the explicit
  free model `openrouter/poolside/laguna-s-2.1:free`; the smoke response was
  `YELLOW_GOOSE_READY`. Run `tools/build-continuity/start-goose-omniroute.ps1` to
  start the gateway if necessary and open the graphical Yellow workspace. This route
  consumes no Codex allowance, but it remains subject to OpenRouter free-model limits
  and is restricted to proposal work until Codex reviews and tests its output.

## Model orchestration hierarchy

- Use Astra only for high-level planning, architecture risk, acceptance judgment and
  difficult review. Do not burn Astra on routine file edits, mechanical tests or
  scaffolding.
- Use Sol, Terra or Luna for integration ownership, tool-access bridging and fixing
  blocked lower lanes when the worker lacks shell, browser, repository or skill
  access. Treat this as a short intervention, then hand work back down.
- Use Goose, DSH, OmniRoute `:free`, admitted local workers and the cheapest capable
  Codex model for ordinary bounded coding proposals, read-only audits, summaries and
  repetitive test/debug loops.
- External/free workers remain proposal-only until a scoped product order grants an
  isolated writer surface and Codex verifies the result. They must not merge, deploy,
  mutate public data, rotate keys to evade quota, or approve their own work.
- If a lower-cost lane reports missing capability, record the exact missing tool or
  authority, have a 5.6-tier Codex model bridge or prepare the context, then return
  the bounded implementation task to the lowest capable lane.
- One coordinator keeps the authoritative plan. Parallel lanes must use disjoint
  outputs or review-only scope, and high-risk work still needs an independent
  non-implementing proof before release.

## Product direction retained from founder conversation

- Minimal, high-end liquid-glass/glassmorphism Today screen; operational screens
  keep the dense Opera-style ribbon and expandable detail where needed.
- Neon green selection/status light—not LED bulb artwork; state colours remain
  operationally meaningful and accessible.
- Responsive mobile-first web now, Android later. Do not reduce desktop operational
  depth to achieve mobile layout.
- Overwatch is the Yellow AI identity (Jarvis is legacy compatibility naming). Voice
  defaults to Indian English; speech output remains explicit-consent only.
- Every AI operational mutation is confirmation-gated and governed by hotel roles,
  permissions, property scope, audit facts/outbox and existing domain authority.
- Commercial hierarchy is Hotel/chain grouping → Market Segment Group → Market
  Segment → source/company/profile → reservation, with room-night/revenue/occupancy,
  ADR and RevPAR rollups. Do not invent financial or attribution truth in the UI.
- Unbuilt ecosystem areas may be visible but must be clearly disabled/greyed and
  must never imply working authority.
- Performance, low latency and low operating cost matter, but never at the expense
  of scope, correctness, tenant isolation or repository gates.

## Start/resume protocol

1. Read `PROJECT.md`, `AGENTS.md`, `BUILD-PLAN.md` for the current phase,
   `handoff/ROADMAP.md`, `docs/WORKFLOW.md`, and `handoff/ROSTER.md` as routed by
   repository instructions.
2. Run `./state.ps1`; inspect the exact current order/review and any process handle.
3. For product work, continue only from an open scoped order. Current release priority
   is Order 605 public-origin closure. Order 607 concerns only the free/local harness.
4. Return small, reviewable diffs and exact commands/results. If local model quality,
   tools, permissions or context are insufficient, stop that lane and write a bounded
   capability request; do not guess or silently broaden scope.

## Deliberately excluded from imported context

Raw Codex/ChatGPT transcripts are not copied because they contain exposed provider
keys, temporary pairing codes, stale runtime claims and large quantities of obsolete
intermediate discussion. Hidden model instructions and internal reasoning are never
exported. The files above preserve the founder's usable requirements without those
security and correctness hazards.
