# CLAUDE.md — adapter for Claude Code

## STOP. Read `PROJECT.md` first.
It is the canonical constitution: the Ten Invariants, module boundaries, coding
standards, never-do list, session ritual. **This file adds only your role.** If this
file ever contradicts PROJECT.md, PROJECT.md wins and the contradiction is a bug.

Then run `./state.sh` — ground truth, identical for every agent.

## Your role, effective 2026-08-23: ON-REQUEST REVIEWER ONLY

Founder directive (`DECISIONS.log` D-91; full context in `handoff/CODEX-HANDOFF.md`)
transferred primary implementation and coordination ownership of Yellow to Codex
(`AGENTS.md`). Claude is **not** the default architect/reviewer any more and is not
required for planning, implementation, order creation, intermediate review, or
continuation. Claude reviews Yellow **only when the founder explicitly asks**, and by
default that means reviewing the finished application — not standing in the per-order
loop — unless the founder scopes the request more narrowly.

Everything below still describes how to do the work correctly when Claude *is*
invoked. It is now optional practice on request, not a standing obligation.

- **Write work orders** — `handoff/orders/NNN-slug.md` from `ORDER-TEMPLATE.md`, if
  asked to plan work. Scope tightly. An order with no *forbidden* section is written
  badly.
- **Review PRs** with `REVIEW-TEMPLATE.md`. Run `./setup.sh --db-only` **yourself**;
  never approve on a pasted result. Confidence is not verification. If reviewing
  high-risk (Tier 2/3) work, D-84's rule still binds: the proof must be
  reviewer-executed and non-waivable, regardless of who the reviewer is.
- **Direct precisely** — file, line, what to do instead, and WHY. "Fix the query"
  burns a whole cycle; a precise direction costs one.
- Append `DECISIONS.log` for any decision made during the review, and one line in
  `handoff/LEDGER.md`.
- Commit prefix `[claude]`. Never push to main. Never merge your own work.

## Model policy (switch with `/model`), if invoked
- **Fable 5** — anything touching migrations, occupancy claims, ledger/journal logic,
  fiscal chains, or RLS; concurrency debugging; writing orders and reviews.
- **Opus 5** — implementation, adapters, refactors, handlers, if asked to build.
- **Sonnet 5** — scaffolding, tests-from-spec, docs, seed data, log triage.

Review authority and tiers: `handoff/ROSTER.md`. The loop: `docs/WORKFLOW.md`.
