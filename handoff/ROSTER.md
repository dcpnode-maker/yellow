# ROSTER.md — who's on the team and who reviews what

Adding an AI agent should be a **config entry, not a redesign**. This file is that
config. Every agent reads `PROJECT.md` (canonical); this file says what each one is
for and what its approval is worth.

## Current roster

| Agent | Adapter file | Role | May approve | Cost posture |
|---|---|---|---|---|
| **Claude Fable 5** | `CLAUDE.md` | Architect · reviewer · decider | Tier 1 · 2 · 3 | Expensive — judgement only |
| **Claude Opus 5** | `CLAUDE.md` | Implementation, adapters, refactors | Tier 1 | Default working model |
| **Claude Sonnet 5** | `CLAUDE.md` | Scaffolding, tests-from-spec, docs, log triage | — | Cheapest Claude |
| **OpenAI Codex** | `AGENTS.md` | Builder — volume implementation from work orders | Tier 1 | Free/cheap — do volume here |
| *(open slot)* | `<VENDOR>.md` | Second-opinion reviewer | Tier 2 (see below) | — |

## Review tiers — how much scrutiny a change needs

Tier is a property of the **change**, not of who wrote it.

**Tier 1 — routine.** Handlers, adapters, docs, tests, refactors inside one context.
→ One architect-role agent approves. Battery green.

**Tier 2 — invariant-adjacent.** New context surface, new event, new state
transition, projection logic, anything touching money display or tax computation.
→ Architect-role approval + a test that would fail if the invariant broke.

**Tier 3 — foundational.** Migrations, occupancy claim logic, journal/posting,
fiscal chains, RLS, tenant scoping, document numbering.
→ **Two reviewers from different vendors** + an executable proof (a test that fails
before the change and passes after, or a battery run on the branch). Decision
appended to `DECISIONS.log` by the deciding architect.

### Why Tier 3 requires cross-vendor review

This isn't ceremony. In this project's own history, a cross-tenant leak through
Postgres views was reviewed and missed by two separate models on paper — because
models trained on similar material share blind spots, and a second opinion from the
same family often agrees for the same wrong reason. It was caught by a two-tenant
fixture that actually ran. So Tier 3 requires **both** a different-vendor reader
and something executable. Diversity of reviewer plus execution beats either alone.

## Adding a new agent (the whole procedure)

1. Create `<VENDOR>.md` at repo root — whatever filename that tool auto-loads.
   Contents: **a pointer to `PROJECT.md` plus its role. Nothing else.** Never copy
   the invariants; copies drift.
2. Add a row above: role, approval tier, cost posture.
3. Mirror MCP config into that tool's dialect if it supports MCP (`.mcp.json` for
   Claude Code, `.codex/config.toml` for Codex — same three servers).
4. Pick a commit prefix — `[claude]`, `[codex]`, `[gemini]`, … — and add it here.
5. First session: run `./state.sh`, read `PROJECT.md`, then a Tier-1 order as a
   shakedown before anything foundational.
6. Append one line to `DECISIONS.log` recording the addition and the role.

## Rules that apply to every agent, forever

- **Nobody merges their own work.** The builder and the approver are never the same
  agent, regardless of vendor.
- **`DECISIONS.log` is shared and append-only.** Union-merged in `.gitattributes` so
  parallel appends never conflict. Grep before deciding.
- **Commit prefixes are mandatory** — `git log --grep="\[codex\]"` must remain able
  to answer "which agent wrote this?" years later.
- **No agent edits `migrations/0001_init.sql`.** New migrations only.
- **Disagreement between agents is a feature.** When two agents disagree on a Tier 2
  or 3 question, the resolution is not "the more expensive one wins" — it's *write a
  test that settles it*. If no test can settle it, it's a product decision for the
  founders, and it goes in `DECISIONS.log` with both positions recorded.
