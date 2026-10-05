# ORDER NNN — <slug>

**Phase:** N · **Branch:** `phase-N/<slug>` · **Written by:** <agent — Codex by default; see `handoff/CODEX-HANDOFF.md`> · **Date:**

## Goal
One sentence. If it needs two, split the order.

## Why now
What this unblocks. Which BUILD-PLAN Definition-of-Done line it satisfies.

## Scope — files Codex may create or change
- `src/contexts/<ctx>/...`
- `tests/...`
Anything not listed here is OUT of scope. If the work seems to require a file not
listed, STOP and ask (`handoff/questions/NNN.md`) — do not widen scope silently.

## Contracts to honour (read before writing code)
- `docs/CONTRACTS.md` §
- `docs/STATE-MACHINES.md` §
- `.claude/skills/yellow-<skill>/SKILL.md`

## Definition of done
- [ ] `./setup.sh --db-only` → `11 passed, 0 failed of 11`
- [ ] New tests: <name what they prove, not how many>
- [ ] `bun test` green (from Phase 0 onward)
- [ ] No new file outside Scope
- [ ] PR body pastes the battery output

## Forbidden in this order
- Editing `migrations/0001_init.sql` (baseline is immutable — new migration instead)
- UPDATE/DELETE on insert-only tables
- Any occupancy write outside `record_occupancy` / `release_occupancy`
- New status values, events, or tables not named above
- <order-specific additions>

## Open questions already answered
> Q: …
> A: …  (also appended to DECISIONS.log)
