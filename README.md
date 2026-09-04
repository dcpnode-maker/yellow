# Yellow — hospitality operating system

Yellow is an actively implemented, tenant-scoped hospitality platform spanning the
PMS journey, financial ledger, stay operations, fiscal compliance and the planned
distribution, guest-experience, voice, RMS and hotel-interface layers. The repository
is the durable source of truth: implementation, decisions, orders, executable proof
and independent reviews travel together so a future maintainer or model can reconstruct
why the system works as it does.

## Current build snapshot

The authoritative roadmap contains **18 phases, numbered 0–17**. Current recorded
states are:

- **Reviewed:** Phases 0–3, 5 and 6.
- **Built, final integration/review outstanding:** Phase 4.
- **Active:** Phase 7 — Tax engine + India IRP. Yellow-native fiscal invoice issuance
  is being completed under Order 430 and is not yet claimed complete.
- **Planned:** Phases 8–17.

Founder delivery priority is Phase 11, then 13, then 17, while preserving mandatory
dependencies. From the active phase the executable sequence is
`7 → 8 → 9 → 10 → 11 → 12 → 13 → 17 → 14 → 15 → 16`.

The live status model is `src/project-status.ts`; the full scope and definitions of
done are in `BUILD-PLAN.md`; execution history is in `handoff/orders/`,
`handoff/reviews/`, `handoff/LEDGER.md` and `DECISIONS.log`. GitHub PR #80 publishes
the current 18-phase lineage to `main`; it must pass every required check and be merged
by an independent integrator before `main` represents this snapshot.

## What's here

| File | What it is | Where it goes |
|---|---|---|
| `migrations/0001_init.sql` | Immutable executable baseline: 80 tables, 13 contexts, RLS, choke points, hardening. The runner adds `schema_migration` for 81 public tables. |
| `PROJECT.md` | Canonical constitution: Ten Invariants, module boundaries, coding standards and never-do list. | repo root |
| `AGENTS.md` / `CLAUDE.md` | Tool-specific role adapters; both defer to `PROJECT.md`. | repo root |
| `STATE-MACHINES.md` | Every status column's legal transitions + guards + emitted events. | repo `docs/` |
| `EVENTS.md` | Event envelope, subject scheme, full catalogue v1, consumer registry. | repo `docs/` |
| `CONTRACTS.md` | API conventions, THE availability contract, module surfaces, provider ports. | repo `docs/` |
| `EXTENSIONS.md` | JSON Schemas + launch instances for all extension registry content (verticals, tax incl. India GST slabs, policies, statutory, fiscal, automation actions). | repo `docs/` + Phase-1 seed |
| `BUILD-PLAN.md` | 18 phases (numbered 0–17) with a definition of done for each, plus the session ritual. | repo root |
| `UI-SPEC.md` | Adaptive operator flows, screen inventory, accessibility, voice entry and presentation direction. | repo `docs/` |
| `SECURITY.md` | Threat model & controls: auth, RLS layers, PII/token handling, incident basics. | repo `docs/` |
| `DEPENDENCIES.md` | Vendor risk register: Class A/B/C, OSS replacements, licence policy, CI gates. | repo `docs/` |
| `docs/ARCHITECTURE-v3.html` | The zero-cost architecture: doctrines, primitives, cost model, spend triggers. |
| `docs/research/` | The four analysis rounds behind every locked decision. |
| `docs-mockups-ui-v1.html` | Five-screen UI mockups rendered from fixture data. | repo `docs/mockups/` |
| `DECISIONS.log` | Seeded with every locked decision + rejected alternative. Append-only. | repo root |
| `tests/` | Growing executable proof suite covering domain behavior, hostile boundaries, concurrency, schema and the 11/11 invariant referee. | repo `tests/` |
| `.agents/skills/yellow-entity-patterns/` | Shared skill: extending entities without drift. | project-local agent skills |
| `.agents/skills/yellow-postgres-patterns/` | Shared skill: occupancy, RLS, insert-only history and outbox patterns. | project-local agent skills |
| `.agents/skills/yellow-compliance-rules/` | Shared skill: fiscal chains, ZATCA/IRP/UAE-ASP, statutory, trust and privacy rules. | project-local agent skills |
| `prototype/` | The stress test that found P1 and proved the fix (1,409 commits/sec; 50-thread race → 1 winner). Re-run any time: needs local PG16. | keep for Phase-2 porting |

**New here?** macOS/Linux → `START-HERE.md` · Windows 11 → `docs/WALKTHROUGH-WINDOWS.html` (open in a browser — click-by-click with checkboxes) or `START-HERE-WINDOWS.md`.
`USAGE.md` is the ongoing operating manual once you're set up.

## Setup (one command)

```bash
unzip yellow.zip && cd yellow
./setup.sh
```

Checks prerequisites → starts PostgreSQL 16 + Valkey → runs the production migration
and deterministic demo seed → builds a separate invariant database through the same
runner → **runs the 11/11 battery on your machine**. Full setup also verifies health.
It never creates accounts or repositories. `--db-only` runs the database path only.

## Setup (manual, if you prefer)

1. `mkdir yellow && cd $_ && git init`
2. Keep `PROJECT.md`, the role adapters, `BUILD-PLAN.md`, the immutable
   `migrations/0001_init.sql`, and `docs/` together in the repository.
3. Keep the project-local `.agents/skills/` directory with the repository.
4. Configure approved PostgreSQL and GitHub development integrations as described in
   `docs/CODEX.md`; never point an agent at production credentials by default.
5. `DECISIONS.log` ships seeded — keep appending.
6. Run `./state.sh`, then open your agent on the current reviewed work order.

## Boundaries that remain external

Provider credentials and certifications—such as ZATCA onboarding, India IRP/GSP
access, OTA partner certification and UAE ASP selection—remain external business
actions. Their absence never permits the repository to claim a provider submission,
certification or production deployment that has not occurred.

## Provenance

Designed clean-room from USALI 12th, HTNG/OpenTravel, and public API docs of modern
PMSs — no Oracle/OPERA materials were used. Four research rounds + a system stress
test are archived in the project outputs (`differential-analysis-round-*.md`,
`system-stress-test-round-4.md`).

## The one number to remember

The occupancy prototype's naive constraint design **failed** under concurrency
(double-sold a private room over live bed sales). The claim-range redesign in
`migrations/0001_init.sql` contains the fix, proven at 1,409 commits/sec with zero
conflicts admitted.
That failure cost one afternoon on paper. In production it would have cost the
company. That is what this package is for.


## Using Codex

See `docs/CODEX.md`; `AGENTS.md` and `.codex/config.toml` are already wired.

## Implementation and review

Codex owns implementation and coordination. High-risk work is reviewed by a fresh,
non-implementing qualified agent that personally executes the required proof; the
implementer never self-reviews or self-merges. See `PROJECT.md`, `AGENTS.md`,
`docs/WORKFLOW.md` and `handoff/ROSTER.md`.
