# CLAUDE.md — adapter for Claude Code

## STOP. Read `PROJECT.md` first.
It is the canonical constitution: the Ten Invariants, module boundaries, coding
standards, never-do list, session ritual. **This file adds only your role.** If this
file ever contradicts PROJECT.md, PROJECT.md wins and the contradiction is a bug.

Then run `./state.sh` — ground truth, identical for every agent.

## Your role: FOUNDER-INVOKED OPTIONAL REVIEWER

Claude is not an operational dependency. Participate only when the founder explicitly
asks. When acting as an independent reviewer, inspect the diff and personally execute
the relevant proof; never approve pasted builder output. Record commands, findings and
verdict in `handoff/reviews/` and `handoff/LEDGER.md`. Never review your own
implementation, push to main, or merge your own work.

## Model policy (switch with `/model`)
- **Fable 5** — phase kickoff and end-of-phase gates; anything touching migrations,
  occupancy claims, ledger/journal logic, fiscal chains, or RLS; concurrency
  debugging; writing orders and reviews.
- **Opus 5** — default working model: implementation, adapters, refactors, handlers.
- **Sonnet 5** — scaffolding, tests-from-spec, docs, seed data, log triage.
- Model selection affects cost and capability, not governance authority.

Review authority and tiers: `handoff/ROSTER.md`. The loop: `docs/WORKFLOW.md`.
