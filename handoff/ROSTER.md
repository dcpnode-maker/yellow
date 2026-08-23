# ROSTER.md — authority and review tiers

Every agent reads `PROJECT.md`; this file defines current operational authority.

## Current roster

| Agent | Adapter | Role | Authority |
|---|---|---|---|
| **OpenAI Codex** | `AGENTS.md` | Primary lead · architect · builder · verifier | May write orders and decisions; may approve Tier 1/2 design evidence; may not merge its own PR |
| **Founder** | — | Product authority · final merge control | Decides Tier 3/product choices and controls `main` merges |
| **Claude family** | `CLAUDE.md` | Inactive by D-91 | No order, review, decision, or merge authority |
| *(optional future reviewer)* | `<VENDOR>.md` | Independent evidence reviewer | Only when explicitly appointed by the founder |

## Review tiers

Tier is a property of the change, not the author.

**Tier 1 — routine.** Handlers, adapters, docs, tests, and refactors inside one bounded
surface. Codex writes the order, implements in a later commit, runs applicable checks,
and performs a fresh diff review. The founder controls merge.

**Tier 2 — invariant-adjacent or security-boundary work.** New context surfaces,
events, state transitions, projection logic, money display/tax computation, device
identity, remote control, credentials, or trust boundaries. Codex records the design
decision before implementation and supplies a test or experiment that could falsify
the claim. The founder controls merge.

**Tier 3 — foundational.** Migrations, occupancy claim logic, journal/posting, fiscal
chains, RLS, tenant scoping, document numbering, and `tests/run_invariants.py`.
Implementation requires an explicit founder decision first, then executable proof.
Codex cannot self-merge or waive the proof.

## Why executable proof remains non-waivable

Yellow's view-RLS leak and several Phase-0 defects survived paper review and were
caught only by execution. Removing an unavailable reviewer does not remove that
evidence. A test that tries to break the guarantee is stronger than another confident
paragraph, so negative tests and the invariant battery remain the central controls.

## Rules that apply permanently

- `PROJECT.md` and the Ten Invariants remain canonical.
- An order exists before implementation and contains Scope, Forbidden, DoD, and proof.
- `DECISIONS.log` and `handoff/LEDGER.md` are append-only.
- Commit prefix `[codex]` is mandatory for new work.
- No agent edits `migrations/0001_init.sql`.
- Codex never merges its own PR; `main` remains protected by human merge control.
- Testable disagreements are settled by execution. Untestable product choices go to
  the founder and are recorded.
