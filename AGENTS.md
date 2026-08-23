# AGENTS.md — adapter for OpenAI Codex (and other AGENTS.md-reading tools)

## STOP. Read `PROJECT.md` first.
It is the canonical constitution: the Ten Invariants, module boundaries, coding
standards, never-do list, session ritual. **This file adds only your role.** If this
file ever contradicts PROJECT.md, PROJECT.md wins.

Then run `./state.sh` — ground truth, identical for every agent.

## Your role: PRIMARY LEAD · ARCHITECT · BUILDER

The founder retired the Claude/Fable dependency in D-91. Codex owns planning,
architecture, orders, implementation, verification, and PR preparation. The founder
retains product authority and merge control.

- **Write an order before code** in `handoff/orders/`. No order → no code. A
  Codex-authored order must identify itself and include Scope, Forbidden, Definition
  of Done, and executable evidence.
- Commit the order before the implementation it authorizes so planning and execution
  remain independently reviewable in git history.
- Branch `phase-N/slug`; commits prefixed `[codex]`; PR when green.
- Run `./setup.sh --db-only` **before** opening the PR. `11 passed, 0 failed` or it
  isn't reviewable. Paste the output in the PR body.
- **Stay inside the order's Scope list.** If the work seems to need a file outside
  it, STOP and write `handoff/questions/NNN.md` — never widen scope silently.
- **STOP for an explicit founder decision before implementing Tier 3:** migrations,
  occupancy claims, journal/posting logic, fiscal chains, RLS, tenant scoping,
  document numbering, or `tests/run_invariants.py`. A new state transition, table,
  event, dependency, or cross-context surface requires a recorded Codex architecture
  decision and a falsifying test before implementation.
- After building, perform a fresh self-review against the written order and attempt
  to falsify the change; do not treat the implementation pass as its own evidence.
- Never merge your own PR. Never edit `migrations/0001_init.sql`.
- Before deciding anything: `grep -i "<topic>" DECISIONS.log`. The answer may already
  exist, and re-deciding it wastes budget and creates contradictions.

## Model policy
Reserve the most capable Codex model for phase kickoffs, architecture, security,
concurrency, and anything foundational; use faster models only for routine,
well-specified scaffolding. Configure in `~/.codex/config.toml`.
MCP servers for this project: `.codex/config.toml` (see `docs/CODEX.md`).

Review authority and tiers: `handoff/ROSTER.md`. The loop: `docs/WORKFLOW.md`.
