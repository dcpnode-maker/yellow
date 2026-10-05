# WORKFLOW.md — Codex owns the loop; independent review gates high-risk work

**Effective 2026-08-23**, this file's contract changed by founder directive
(`DECISIONS.log` D-91; full context in `handoff/CODEX-HANDOFF.md`). Codex is primary
implementation and coordination owner. Claude is not a required participant in this
loop and is invoked only if the founder explicitly asks for a review. Everything below
describes the still-binding mechanics: the referee, the git conventions, and — most
importantly — the independent-review requirement for high-risk work, which is now
agent-agnostic rather than Claude-specific. The pre-2026-08-23 "Codex builds, Fable
reviews" version of this file is preserved in git history (`git log -p -- docs/WORKFLOW.md`)
rather than restated here — see the Superseded section at the end.

One repo, one referee (`tests/run_invariants.py`). `CLAUDE.md` and `AGENTS.md` both
point here.

## Roles

| | **Codex** (owner) | **Independent reviewing agent** (any agent that did not implement the change) |
|---|---|---|
| Does | Writes and revises orders. Implements them. Writes code, tests, migrations. Runs the battery. Opens PRs. For high-risk work, arranges an independent agent to inspect the diff and personally execute proof. Decides and closes routine work alone. Appends `DECISIONS.log` and `handoff/LEDGER.md`. | For Tier-2/3 (high-risk) work: inspects the diff and **personally executes** the proof (D-84 — a result pasted by the implementer is not proof). Writes the verdict to `handoff/reviews/`. |
| Never | Changes the schema baseline, occupancy claim logic, ledger rules, fiscal chains, or RLS without a documented order and, for Tier 2/3, the required independent review. Merges its own PR. | Reviews a change it implemented. |
| Cost | Free/cheap → do volume here | Chosen by risk, cost, speed, and capability — Claude is one option among several, not the default. |

The split exists because ambiguity and blast radius are where independent
verification is worth spending. Routine work no longer waits on a review cycle;
high-risk work still does.

## The loop

```
1. ORDER    Codex writes/revises handoff/orders/NNN-slug.md   (scope, files, DoD, forbidden)
2. BUILD    Codex implements on branch phase-N/slug            (commits [codex] prefix)
3. PROVE    Codex runs ./setup.sh --db-only                    (battery must be 11/11)
4. ROUTE
   Tier 1 (routine)     → gates green → Codex merges via a normal reviewed PR
                           (approver just isn't the implementer; doesn't have to be
                           a second AI agent for Tier 1)
   Tier 2/3 (high-risk) → an INDEPENDENT agent that did not implement the change
                           inspects the diff and personally executes the proof
                           → handoff/reviews/NNN-slug.md
                             → APPROVED         → merge, append DECISIONS.log
                             → CHANGES-REQUIRED → precise directions, back to step 2
5. LOG      One line in handoff/LEDGER.md, always
```

Never skip step 3. A PR without a green battery is not reviewable — it's a draft.

## Git conventions (this is the sync)

```bash
# start work
git checkout main && git pull
git checkout -b phase-2/occupancy-claims

# commit — prefix makes attribution visible in git log forever
git commit -m "[codex] implement record_occupancy port + T1-T5 integration tests"

# an independent reviewing agent commits (orders, reviews, decisions) with its own prefix
git commit -m "[claude] review 004: occupancy claim port"    # only if Claude reviews
git commit -m "[<agent>] review NNN: <slug>"                  # any other reviewing agent

# open the PR
gh pr create --fill --base main
```

Rules:
- **`main` is only reached through a reviewed PR.** No direct pushes, by anyone.
- **Branch = `phase-N/slug`.** One phase concern per branch; if it spans phases, the
  order was written wrong.
- **Commit prefix identifies the agent** (`[codex]`, `[claude]`, or another registered
  prefix — see `handoff/ROSTER.md`). `git log --grep` must keep answering "which agent
  wrote this?" — that matters when a bug is found.
- **`DECISIONS.log` and `handoff/LEDGER.md` use union merge** (`.gitattributes`), so
  parallel appends from multiple agents don't conflict. Append at the end, never edit
  existing lines.
- **Pull before starting anything.** Multiple agents can work this repo; stale
  branches are the most likely source of duplicated work.

## Who decides what

**Codex decides freely:** variable names, file layout within a context, test
structure, error message wording, refactors that don't cross a module boundary, and —
since 2026-08-23 — routine (Tier 1) work end-to-end once gates pass.

**Codex must arrange independent review** — an agent that did not implement the
change inspects it and personally executes the proof; write `handoff/questions/NNN.md`
if no independent agent is available yet and the work cannot proceed without one — when
it hits:
- anything touching `migrations/`, occupancy claims, journal/posting logic, fiscal
  chains, RLS, or tenant scoping
- a state transition not already in `docs/STATE-MACHINES.md`
- a new table, or a new column on a table another context owns
- an event not in `docs/EVENTS.md`
- payments, document numbering, statutory reporting, trust accounting, or destructive
  data handling
- any moment the answer is "it depends"

**Codex asks the founder** — not any AI agent — only for: credentials, spending,
legal/business policy, irreversible external actions, missing product intent, or
authority outside the founder directive. Claude's absence is never treated as a
blocker.

## Reading order for any agent, every session

1. `CLAUDE.md` (Claude, on request) or `AGENTS.md` (Codex, primary) — the constitution
2. `BUILD-PLAN.md` — current phase only
3. `handoff/LEDGER.md` tail — what just happened
4. `grep` `DECISIONS.log` for the topic at hand — **before deciding, not after**
5. The relevant `docs/*.md` and `.claude/skills/yellow-*/SKILL.md` /
   `.agents/skills/yellow-*/SKILL.md`

## The referee

`./setup.sh --db-only` rebuilds the database and runs the battery. It must print
`11 passed, 0 failed of 11` before any PR is reviewable and after any merge. If a
change makes it red, the change is wrong — not the test. Those eleven cover
double-booking, ledger balance, sealed days, gapless invoice numbers, and tenant
isolation through tables *and* views.

## Superseded

Before 2026-08-23 this file specified a two-agent contract: Codex as builder, "Claude
Fable 5" as the fixed architect/reviewer who alone wrote orders, reviewed every PR, and
alone appended `DECISIONS.log`. D-84 (2026-08-15) had already narrowed Tier 3 from two
cross-vendor reviewers down to one architect-role reviewer while making the executable
proof non-waivable and reviewer-run. D-91 (2026-08-23, this handoff) goes further: it
removes the requirement that the reviewer be Claude specifically, and removes Claude as
a required participant in routine work and order creation entirely. D-84's
reviewer-executed, non-waivable proof rule for Tier 2/3 work is unchanged — only the
identity requirement changed. The prior text is preserved in git history rather than
rewritten here, per the founder directive's instruction to mark superseded rules
clearly instead of rewriting evidence misleadingly.
