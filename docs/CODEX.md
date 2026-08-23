# CODEX.md — running Yellow with OpenAI Codex

OpenAI Codex is Yellow's primary architect and builder under founder decision D-91.
The repository remains agent-neutral at its core: PostgreSQL, Docker Compose, Bun,
the invariant battery, and the specifications are ordinary files and commands.

## Repository integration

| Surface | Codex path | Status |
|---|---|---|
| Constitution | `PROJECT.md` | Canonical for every agent |
| Role | `AGENTS.md` | Primary lead · architect · builder |
| MCP | `.codex/config.toml` | postgres + github + context7 |
| Project skills | `.claude/skills/yellow-*/SKILL.md` | Legacy directory name; readable directly by Codex |
| Decisions | `DECISIONS.log` | Shared, append-only history |
| Referee | `tests/run_invariants.py` | Agent-neutral; must remain 11/11 |

## First thing Codex must do

Run `./state.sh`, read `PROJECT.md`, then `AGENTS.md`, the current phase in
`BUILD-PLAN.md`, and the issued order. Grep `DECISIONS.log` for the topic before
making a decision.

## Install Codex

```bash
npm install -g @openai/codex
codex
```

Sign in with the authorized ChatGPT account or use a deliberately scoped API key.
Never place credentials in the repository, prompts, model context, or Android worker.

## Operating rule: order before code

Codex may write architecture decisions and work orders, but an order must be committed
before the implementation it authorizes. Every order contains:

- a narrow Scope list;
- an explicit Forbidden list;
- numbered Definition of Done items;
- executable evidence, including a falsifying/negative test for Tier 2;
- the review tier and any founder decision required.

Codex then implements in later `[codex]` commits, runs the standing checks, performs a
fresh diff review, and opens a PR. Codex never merges its own PR.

## Model routing

Use the strongest available Codex model for phase kickoffs, architecture, security,
concurrency, and foundational work. Faster models may handle routine scaffolding only
when the order already removes the ambiguity. Model price or speed never changes the
Ten Invariants or review tier.

## Skills and hooks

The project skills still live under the historical `.claude/skills/` directory. The
directory name does not grant Claude authority; the Markdown is reusable project
knowledge. Read the relevant `SKILL.md` explicitly before its domain work.

Legacy `.claude/settings.json` hooks are not Codex controls. Repository commands and CI
are authoritative. Add Codex-native hooks later only through an issued order.

## Verify before trusting the setup

```bash
./state.sh
codex
```

Confirm Codex has read `AGENTS.md` and that postgres, github, and context7 are connected.
For product-code PRs, run the full standing self-check in `docs/WORKFLOW.md`; the final
database result must be `11 passed, 0 failed of 11`.
