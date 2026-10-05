# ROSTER.md — who's on the team and who reviews what

Codex owns development and coordination. Internal models are assigned bounded roles,
not competing ownership. Every worker reads `PROJECT.md` and `docs/PROJECT-STATUS.md`;
this file says what an assignment may approve.

## Current roster

| Assignment | Adapter file | Role | May approve | Cost posture |
|---|---|---|---|---|
| **Codex coordinator** | `AGENTS.md` | Sole implementation, coordination and release owner | Routine work; high-risk only when not its implementer | Default owner |
| **Internal builder** | `AGENTS.md` or thin optional adapter | Bounded implementation, test, documentation or research lane | Its routine lane only | Match capability to scope |
| **Internal independent reviewer** | `AGENTS.md` or thin optional adapter | Non-implementer review and personal proof execution | Tier 1–3 for the assigned review | Strongest needed for risk |

## RMS algorithm research model — founder assignment, 2026-09-06

Use **GPT-6 Astra with Ultra reasoning** (`gpt-6-astra`, `ultra`) for finding,
designing and challenging RMS algorithms, including demand forecasting, price
response, contribution/displacement optimization and channel-visibility evidence.
[Order 441](orders/441-astra-ultra-rms-algorithm-research.md) bounds the first research
lane. The coordinator retains implementation ownership; routine scaffolding and
reproducible implementation may use cheaper workers suited to the task.

This assigns the development/research model, not the production pricing runtime.
Prefer measurable low-cost algorithms and deterministic guarded execution in the
app. Proposed inventions must outperform declared baselines on appropriate evidence;
neither model capability nor research completion establishes revenue uplift. Preserve
Phase 14 ownership and the founder's dependency-gated 11 → 13 → 17 priorities.

## Review tiers — how much scrutiny a change needs

Tier is a property of the **change**, not of who wrote it.

**Tier 1 — routine.** Handlers, adapters, docs, tests, refactors inside one context.
→ Codex completes after the relevant battery is green.

**Tier 2 — invariant-adjacent.** New context surface, new event, new state
transition, projection logic, anything touching money display or tax computation.
→ Independent non-implementing review when the change enters D-91's high-risk list,
otherwise routine executable verification.

**Tier 3 — foundational.** Migrations, occupancy claim logic, journal/posting,
fiscal chains, RLS, tenant scoping, document numbering.
→ **One independent agent that did not implement the change** + an executable proof that the **reviewer
runs themselves** — a test that fails before the change and passes after, or a battery
run on the branch. A pasted result from the builder is not proof. Decision appended to
`DECISIONS.log` when a durable decision is required. **Amended by D-84 (2026-08-15)** from the
original two-different-vendor requirement.

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

## Assigning an internal worker

1. Codex assigns a bounded order/lane, exact files and required proof.
2. The worker reads PROJECT, PROJECT-STATUS, the adapter and current order, then runs
   `./state.sh`.
3. Parallel builders receive non-overlapping files. One coordinator integrates the
   result and checks the combined diff.
4. A reviewer must not have implemented the surface it reviews and must personally
   execute the registered proof.
5. Add a new adapter or tool only through a scoped decision when it provides a real
   capability; never duplicate the constitution.

## Rules that apply to every agent, forever

- **Nobody merges their own work.** The builder and the approver are never the same
  assignment, regardless of the internal model selected.
- **`DECISIONS.log` is shared and append-only.** Union-merged in `.gitattributes` so
  parallel appends never conflict. Grep before deciding.
- **Commit prefixes are mandatory** — `git log --grep="\[codex\]"` must remain able
  to answer "which agent wrote this?" years later.
- **No agent edits `migrations/0001_init.sql`.** New migrations only.
- **Disagreement between agents is a feature.** When two agents disagree on a Tier 2
  or 3 question, the resolution is not "the more expensive one wins" — it's *write a
  test that settles it*. If no test can settle it, it's a product decision for the
  founders, and it goes in `DECISIONS.log` with both positions recorded.
