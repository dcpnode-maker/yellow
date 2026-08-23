# WORKFLOW.md — Codex owns delivery; independent agents review high risk

Two agents, one repo, one referee (`tests/run_invariants.py`). This file is the
contract between them. Both `CLAUDE.md` and `AGENTS.md` point here.

## Roles

Codex is the primary implementation and coordination owner: it writes bounded orders,
implements, proves, integrates review findings and continues between phases. Routine
work closes when its relevant gates pass. High-risk work requires an independent agent
that did not implement it to inspect the change and personally execute the relevant
proof. Claude is optional and participates only if the founder explicitly asks.

The split exists because ambiguity is where money is worth spending. Nine research
rounds removed ambiguity from most of this build; what's left is execution.

## The loop

```
1. ORDER    Codex writes handoff/orders/NNN-slug.md    (scope, files, DoD, forbidden)
2. BUILD    Codex implements on branch phase-N/slug     (commits [codex] prefix)
3. PROVE    Codex runs ./setup.sh --db-only             (battery must be 11/11)
4. PR       Codex opens PR, body references the order + pastes test output
5. REVIEW   independent non-implementer reads diff and writes handoff/reviews/NNN-slug.md
              → APPROVED         → eligible for integration by someone other than the author
              → CHANGES-REQUIRED → precise directions, back to step 2
6. LOG      One line in handoff/LEDGER.md, always
```

Never skip step 3. A PR without a green battery is not reviewable — it's a draft.

## Git conventions (this is the sync)

```bash
# Codex starts work
git checkout main && git pull
git checkout -b phase-2/occupancy-claims

# Codex commits — prefix makes attribution visible in git log forever
git commit -m "[codex] implement record_occupancy port + T1-T5 integration tests"

# Fable commits (orders, reviews, decisions)
git commit -m "[claude] order 004: occupancy claim port"

# Codex opens the PR
gh pr create --fill --base main
```

Rules:
- **`main` is only reached through a reviewed PR.** No direct pushes, either agent.
- **Branch = `phase-N/slug`.** One phase concern per branch; if it spans phases, the
  order was written wrong.
- **Commit prefix `[codex]` or `[claude]`.** Six months from now, `git log --grep`
  answers "which agent wrote this?" — that matters when a bug is found.
- **`DECISIONS.log` and `handoff/LEDGER.md` use union merge** (`.gitattributes`), so
  parallel appends from both agents don't conflict. Append at the end, never edit
  existing lines.
- **Pull before starting anything.** Both agents work on the same repo; stale
  branches are the most likely source of duplicated work.

## Who decides what

**Codex decides freely:** variable names, file layout within a context, test
structure, error message wording, refactors that don't cross a module boundary.

**Codex must ensure independent review** when an order hits:
- anything touching `migrations/`, occupancy claims, journal/posting logic, fiscal
  chains, RLS, or tenant scoping
- a state transition not already in `docs/STATE-MACHINES.md`
- a new table, or a new column on a table another context owns
- an event not in `docs/EVENTS.md`
- any moment the answer is "it depends"

If the order and decisions do not already authorize that high-risk surface, stop and
ask the founder; otherwise continue through the bounded order and route its executable
proof to a non-implementing reviewer.

## Reading order for either agent, every session

1. `CLAUDE.md` (Claude) or `AGENTS.md` (Codex) — the constitution
2. `BUILD-PLAN.md` — current phase only
3. `handoff/LEDGER.md` tail — what just happened
4. `grep` `DECISIONS.log` for the topic at hand — **before deciding, not after**
5. The relevant `docs/*.md` and `.claude/skills/yellow-*/SKILL.md`

## The referee

`./setup.sh --db-only` rebuilds the database and runs the battery. It must print
`11 passed, 0 failed of 11` before any PR is reviewable and after any merge. If a
change makes it red, the change is wrong — not the test. Those eleven cover
double-booking, ledger balance, sealed days, gapless invoice numbers, and tenant
isolation through tables *and* views.
