# Yellow — hospitality ERP build package

Everything Claude Code needs to build the system without re-deciding anything.
The thinking is done; this package is the thinking, made executable.

## What's here

| File | What it is | Where it goes |
|---|---|---|
| `SCHEMA.sql` | The ERD, executable. 78 tables, 13 contexts, RLS, choke-point functions, hardening. **Validated: loads clean into fresh PostgreSQL 16.** | repo `migrations/0001_init.sql` |
| `CLAUDE.md` | The constitution Claude Code reads every session: Ten Invariants, module boundaries, branded types, never-do list. | repo root |
| `STATE-MACHINES.md` | Every status column's legal transitions + guards + emitted events. | repo `docs/` |
| `EVENTS.md` | Event envelope, subject scheme, full catalogue v1, consumer registry. | repo `docs/` |
| `CONTRACTS.md` | API conventions, THE availability contract, module surfaces, provider ports. | repo `docs/` |
| `EXTENSIONS.md` | JSON Schemas + launch instances for all extension registry content (verticals, tax incl. India GST slabs, policies, statutory, fiscal, automation actions). | repo `docs/` + Phase-1 seed |
| `BUILD-PLAN.md` | 13 phases with definition-of-done each, session ritual. | repo root |
| `UI-SPEC.md` | The seven surfaces: three-tier model, screen inventory, keyboard grammar, offline. | repo `docs/` |
| `SECURITY.md` | Threat model & controls: auth, RLS layers, PII/token handling, incident basics. | repo `docs/` |
| `DEPENDENCIES.md` | Vendor risk register: Class A/B/C, OSS replacements, licence policy, CI gates. | repo `docs/` |
| `docs-mockups-ui-v1.html` | Five-screen UI mockups rendered from fixture data. | repo `docs/mockups/` |
| `DECISIONS.log` | Seeded with every locked decision + rejected alternative. Append-only. | repo root |
| `tests/` | 56-case QA suite (v1.1), repaired seed fixture, TS stress port, executable invariant battery + 11/11 run results. | repo `tests/` |
| `skills/yellow-entity-patterns/` | Skill: how to add/extend entities without drift. | `~/.claude/skills/` |
| `skills/yellow-postgres-patterns/` | Skill: claim-range occupancy, RLS under PgBouncer, insert-only, outbox. | `~/.claude/skills/` |
| `skills/yellow-compliance-rules/` | Skill: fiscal chains, ZATCA/IRP/UAE-ASP, statutory, trust, GDPR. | `~/.claude/skills/` |
| `prototype/` | The stress test that found P1 and proved the fix (1,409 commits/sec; 50-thread race → 1 winner). Re-run any time: needs local PG16. | keep for Phase-2 porting |

**New here?** macOS/Linux → `START-HERE.md` · Windows 11 → `docs/WALKTHROUGH-WINDOWS.html` (open in a browser — click-by-click with checkboxes) or `START-HERE-WINDOWS.md`.
`USAGE.md` is the ongoing operating manual once you're set up.

## Setup (one command)

```bash
unzip yellow.zip && cd yellow
./setup.sh
```

Checks prerequisites → commits → creates a private GitHub repo (via `gh`) → starts
PostgreSQL 16 + Valkey → loads the schema and fixture → **runs the invariant battery
on your machine**. If it doesn't print 11/11, don't start Phase 0.
Flags: `--no-github` (local only) · `--db-only` (rebuild db + re-run tests).

## Setup (manual, if you prefer)

1. `mkdir yellow && cd $_ && git init`
2. Copy `CLAUDE.md`, `BUILD-PLAN.md` to repo root; `SCHEMA.sql` to
   `migrations/0001_init.sql`; the four docs to `docs/`; `prototype/` to `prototype/`.
3. Copy the three skill folders into `~/.claude/skills/`.
4. MCP servers for Claude Code: **postgres** (point at the dev compose DB — lets
   Claude inspect real schema/data while coding) and **github** (PRs, issues).
5. `DECISIONS.log` ships seeded — keep appending.
6. Open Claude Code: *"Read CLAUDE.md and BUILD-PLAN.md. Execute Phase 0."*

## What this package is NOT (the honest 30%)

- **Code.** Zero application TypeScript exists. The package makes the code
  *derivable*; Phases 0–12 are the derivation.
- **Credentials & certifications.** ZATCA sandbox onboarding, India IRP GSP access,
  Booking.com/Expedia partner certification (start now — calendar-gated), UAE ASP
  vendor selection. Only you can sign up.
- **Design pixels.** The three-tier surface model is specified; visual design happens
  in Phase 10.
- **Judgement calls mid-build.** ~a dozen small decisions will surface (library picks,
  edge semantics). That's what `DECISIONS.log` is for — decide once, write it down.
- **Ops runbooks** beyond what Architecture v3 §12 defines — they get written as the
  compose stack becomes real in Phase 0.

## Provenance

Designed clean-room from USALI 12th, HTNG/OpenTravel, and public API docs of modern
PMSs — no Oracle/OPERA materials were used. Four research rounds + a system stress
test are archived in the project outputs (`differential-analysis-round-*.md`,
`system-stress-test-round-4.md`).

## The one number to remember

The occupancy prototype's naive constraint design **failed** under concurrency
(double-sold a private room over live bed sales). The claim-range redesign in
SCHEMA.sql is the fix, proven at 1,409 commits/sec with zero conflicts admitted.
That failure cost one afternoon on paper. In production it would have cost the
company. That is what this package is for.
