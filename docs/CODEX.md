# CODEX.md — running Yellow with OpenAI Codex CLI

Short answer: **yes, and almost everything transfers as-is.** SCHEMA.sql, the test
battery, Docker Compose, and every doc in this repo are plain files with no
Claude-specific content — DEPENDENCIES.md's "nothing revocable in the critical path"
doctrine applies to tooling too. The only real work is bridging two config dialects.

## What's already bridged in this repo

| Claude Code | Codex | Status |
|---|---|---|
| `CLAUDE.md` | `AGENTS.md` | Written — trimmed mirror, same invariants/boundaries/never-do list |
| `.mcp.json` | `.codex/config.toml` | Written — same three servers (postgres, github, context7) |
| `.claude/skills/yellow-*/` | *(no equivalent loader)* | Plain Markdown — Codex can read the files directly, just not auto-load them the way Claude Code does |
| `DECISIONS.log` | `DECISIONS.log` | **Same file, on purpose** — see rule below |
| `tests/run_invariants.py`, `docker-compose.yml`, `migrations/` | *(identical)* | Zero changes — these are Postgres/Docker, not Claude |

## First thing Codex must read

`AGENTS.md` is a thin adapter; **`PROJECT.md` is the canonical constitution** (Ten
Invariants, boundaries, standards, session ritual) and `./state.sh` prints ground
truth. Both are agent-neutral by design. Roles and review tiers: `handoff/ROSTER.md`.

## Install Codex (inside WSL/Ubuntu, same as Claude Code)

```bash
npm install -g @openai/codex
codex          # first run prompts for ChatGPT sign-in or an API key
```

Sign in with your ChatGPT account to use your existing plan/credits rather than
metered API billing — API access is priced per token and gets expensive fast on
agentic loops; a subscription plan is the Codex equivalent of what Max/Pro is for
Claude Code.

## The one rule that matters: DECISIONS.log is shared, not per-agent

Both agents read and append to the **same** `DECISIONS.log`. This is what stops
Codex re-deciding something Claude Code already settled (or vice versa) and burning
a session's worth of tokens/credits re-litigating it. Before either agent makes a
schema, ledger, occupancy, or fiscal decision, it should grep this file first.

```bash
grep -i "occupancy\|folio\|RLS" DECISIONS.log   # check before deciding, not after
```

## Suggested split (this is what actually saves money)

Given your constraint — Claude tokens cost real money, Codex is free to you right
now — the efficient split is:

- **Codex**: the high-volume, well-specified work. Once BUILD-PLAN.md's Definition
  of Done is written for a phase, executing against it is mostly mechanical —
  exactly what a free/cheap model handles well when the spec removes ambiguity.
  Scaffolding, CRUD handlers, adapters, tests-from-spec, docs.
- **Claude (Fable/Opus)**: the ambiguous 20% — schema changes, occupancy claim
  logic, ledger/journal correctness, fiscal chain design, RLS, and any moment either
  agent hits a genuine judgment call. This mirrors the Fable-escalation rule already
  in CLAUDE.md/AGENTS.md, just spread across two tools instead of two models.

Run `./setup.sh` once (it doesn't care which agent runs afterward), then point
either agent at the same repo. `tests/run_invariants.py` is the referee: whichever
agent touched the code, the battery must still print `11 passed, 0 failed`.

## What does NOT transfer automatically

- **Skills as auto-loaded context.** Claude Code's `.claude/skills/` mechanism
  (description-triggered loading) has no direct Codex equivalent as of this
  writing. Workaround: reference them explicitly — e.g. tell Codex
  *"Read .claude/skills/yellow-postgres-patterns/SKILL.md before writing SQL."*
  Since AGENTS.md already points at them, a well-configured Codex session should
  pick this up from project instructions, but verify rather than assume.
- **Hooks.** `.claude/settings.json`'s PostToolUse format-check hook is Claude
  Code's own mechanism. Codex has its own hook system with its own config surface —
  not wired here; add it later if the duplication becomes annoying.
- **Model-name specifics.** AGENTS.md deliberately does NOT name Codex models,
  since that roster moves independently of Claude's. Set your default model in
  `~/.codex/config.toml`, and apply the escalation *principle*, not a copy-pasted
  model name.

## Verify the bridge before trusting it

```bash
codex
# then inside the session:
#   confirm it has read AGENTS.md
#   /mcp  (or Codex's equivalent status command) → postgres, github, context7 connected
```

If MCP servers don't show connected, the fix is identical to Claude Code's: Docker
containers running (`docker compose up -d`) and `GITHUB_TOKEN` exported in the shell
Codex was launched from.
