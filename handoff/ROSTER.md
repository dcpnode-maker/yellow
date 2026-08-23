# ROSTER.md — who's on the team and who reviews what

Adding an AI agent should be a **config entry, not a redesign**. This file is that
config. Every agent reads `PROJECT.md` (canonical); this file says what each one is
for and what its approval is worth.

## Current roster

**Effective 2026-08-23 (D-91):** Codex is primary implementation and coordination
owner, not a Tier-1-only builder. Claude is an on-request reviewer, not the default
architect. Full context: `handoff/CODEX-HANDOFF.md`.

| Agent | Adapter file | Role | May approve | Cost posture |
|---|---|---|---|---|
| **OpenAI Codex** | `AGENTS.md` | Primary implementation & coordination owner — writes/revises orders, implements, arranges independent review for high-risk work, closes routine work alone | Owner for all tiers; Tier 2/3 still needs an independent reviewer that did not implement the change | Free/cheap — do volume here |
| **Claude Fable 5** | `CLAUDE.md` | On-request reviewer only, invoked by the founder | Tier 1 · 2 · 3, only when invoked | Expensive — judgement only, on demand |
| **Claude Opus 5** | `CLAUDE.md` | Implementation, adapters, refactors, if invoked | Tier 1, if invoked | Not the default builder any more |
| **Claude Sonnet 5** | `CLAUDE.md` | Scaffolding, tests-from-spec, docs, log triage, if invoked | — | Cheapest Claude |
| *(open slot)* | `<VENDOR>.md` | Independent reviewer for Tier 2/3 work — any agent that did not implement the change | Tier 2 · 3 | — |

## Review tiers — how much scrutiny a change needs

Tier is a property of the **change**, not of who wrote it.

**Tier 1 — routine.** Handlers, adapters, docs, tests, refactors inside one context.
→ One architect-role agent approves. Battery green.

**Tier 2 — invariant-adjacent.** New context surface, new event, new state
transition, projection logic, anything touching money display or tax computation.
→ Architect-role approval + a test that would fail if the invariant broke.

**Tier 3 — foundational.** Migrations, occupancy claim logic, journal/posting,
fiscal chains, RLS, tenant scoping, document numbering.
→ **One independent reviewing agent — any agent that did not implement the change** —
+ an executable proof that the **reviewer runs themselves** — a test that fails before
the change and passes after, or a battery run on the branch. A pasted result from the
implementer is not proof. Decision appended to `DECISIONS.log` by the deciding
reviewer or by Codex, as applicable. **Amended by D-84 (2026-08-15)** from the original
two-different-vendor requirement to one architect-role (Claude) reviewer, and
**amended again by D-91 (2026-08-23)** to drop the requirement that the reviewer be
Claude specifically — the reviewer-executed, non-waivable proof rule from D-84 is
unchanged and still governs every Tier-3 approval.

### Why Tier 3 requires reviewer-executed proof

This isn't ceremony. In this project's own history, a cross-tenant leak through
Postgres views was reviewed and missed by two separate models on paper — because
models trained on similar material share blind spots, and a second opinion from the
same family often agrees for the same wrong reason. It was caught by a two-tenant
fixture that actually ran.

Read the incident precisely: **execution caught it; the second reader did not.** That
is why D-84 could drop the second vendor without dropping the protection, and why it
simultaneously made the executable half **non-waivable and reviewer-run**. The half that
was load-bearing is now stricter, not looser.

What was genuinely lost is the diversity check on the *reviewer's own* blind spots —
nobody is positioned to catch the reviewer reading a diff wrong. Two things stand in for
it, and both are real rather than nominal: the builder challenges the architect's
positions in writing (Question 008 did exactly this, and D-72 corrected the architect's
own D-69), and every Tier-3 claim must be reproduced from a command, not asserted.
Recorded so the residual risk is a known cost, not an oversight.

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
