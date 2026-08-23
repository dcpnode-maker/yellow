# WORKFLOW.md — Codex leads, evidence reviews

One primary agent, one repo, one referee (`tests/run_invariants.py`). OpenAI Codex is
the architect and builder. The founder owns product direction and the final merge.

## Roles

| | **OpenAI Codex** | **Founder** |
|---|---|---|
| Does | Writes scoped orders, records architecture decisions, implements, tests, performs a fresh evidence review, and opens PRs. | Sets product direction, approves Tier-3 decisions, and controls merges to `main`. |
| Never | Silently widens scope, weakens an invariant, treats confidence as proof, or merges its own PR. | Needs to relay work between AI vendors. |

The former Claude/Fable role is inactive by founder decision D-91. The useful parts
of the old split survive as artifacts and gates: the order exists before code, the
implementation is separately committed, and claims are attached to executable proof.

## The loop

```
1. DECIDE   Codex greps DECISIONS.log and records any new architecture decision
2. ORDER    Codex writes handoff/orders/NNN-slug.md (scope, DoD, forbidden, evidence)
3. BUILD    Codex implements on phase-N/slug in later [codex] commit(s)
4. PROVE    Codex runs the standing self-check plus order-specific negative tests
5. REVIEW   Codex re-reads the order and diff in a fresh pass and tries to falsify it
6. PR       Codex opens a PR with order, evidence, residual risk, and rollback notes
7. MERGE    Founder or an explicitly appointed non-builder merges; never Codex itself
8. LOG      Codex appends one line to handoff/LEDGER.md
```

Never skip proof. A PR without the applicable green checks is a draft.

## Git conventions

- **`main` is reached only through a reviewed PR.** No direct pushes.
- **Branch = `phase-N/slug`.** One concern per branch.
- **Commit prefix `[codex]`.** The order/governance commit precedes implementation.
- **`DECISIONS.log` and `handoff/LEDGER.md` are append-only.** Never rewrite history.
- **Pull before starting.** Stale branches create duplicated and contradictory work.
- **Codex never merges its own PR.** Founder merge control is the independence gate.

## Decision and review tiers

- **Tier 1:** Codex may decide and implement within one bounded surface. Green standing
  checks and a fresh diff review are required.
- **Tier 2:** Codex records the architecture decision before code and names a test that
  would fail if the design were wrong. The PR must include that falsifying evidence.
- **Tier 3:** Codex stops before implementation for an explicit founder decision.
  Migrations, occupancy claims, journal/posting, fiscal chains, RLS, tenant scoping,
  document numbering, and `tests/run_invariants.py` are always Tier 3. Executable proof
  and founder-controlled merge are non-waivable.

When the answer is genuinely a product choice rather than a testable technical claim,
Codex presents the smallest concrete decision to the founder and records the result.

## Reading order every session

1. Run `./state.sh`.
2. Read `PROJECT.md`, then `AGENTS.md`.
3. Read the current phase in `BUILD-PLAN.md`.
4. Read the relevant order and the tail of `handoff/LEDGER.md`.
5. Grep `DECISIONS.log` for the topic before deciding.
6. Read the relevant `docs/*.md` and skills.

## Standing self-check

Run the checks applicable to the order. Before any product-code PR, the full standing
check remains:

```bash
bun install --frozen-lockfile
./state.sh
bun run typecheck
bun run boundaries
bun test
bun run license-check
bun audit
bun run schema:check
./setup.sh --db-only
```

The referee must print `11 passed, 0 failed of 11`. If a check executes and fails,
stop; if a prerequisite is absent, restore it only from repository-pinned inputs and
restart the check from the top.
