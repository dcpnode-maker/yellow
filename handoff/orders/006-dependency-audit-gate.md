# ORDER 006 — Dependency vulnerability audit gate

**Phase:** 0 · **Branch:** `phase-0/dependency-audit-gate` · **Tier:** 1 (routine)
**Written by:** OpenAI Codex, acting as temporary architect by founder request while Claude is unavailable · **Date:** 2026-08-14
**Depends on:** Order 005 commit `eb00dd4`; review later as `phase-0/security-header-gate..phase-0/dependency-audit-gate`

## Goal

Make Bun's dependency vulnerability audit a required CI quality check.

## Why now

`docs/DEPENDENCIES.md` requires `bun audit` in Phase 0 CI, and the current frozen tree reports no vulnerabilities.

## Scope — files Codex may create or change

- `.github/workflows/ci.yml`

Anything not listed here is OUT of scope. If another file is required, STOP and ask in `handoff/questions/006.md`; do not widen scope silently.

## Required implementation

- Run `bun audit` in the existing quality job after frozen installation and license checking, before typecheck and tests.
- Do not suppress severities, ignore advisories, or make audit failure non-blocking.
- Preserve immutable action pins and read-only workflow permissions.

## Definition of done

- [ ] `bun audit` reports no vulnerabilities for the frozen dependency tree
- [ ] CI YAML parses and contains the blocking audit step in the required position
- [ ] Existing license, typecheck, test, container, and invariant checks remain green
- [ ] Only the scoped workflow file changes during implementation
- [ ] Commit begins with `[codex]`; do not merge before independent review

## Forbidden in this order

- Ignoring an advisory or changing audit severity
- Editing packages, lockfiles, application code, tests, Docker/Compose, setup scripts, migrations, or documentation
- Weakening any existing CI step, action pin, or permission
- Any database, RLS, tenancy, domain, occupancy, ledger, fiscal, event, or state-machine work
- Merging this stacked branch before prior orders and this order are independently reviewed

## Deferred review protocol

Claude reviews this isolated CI-only range after Orders 001–005. Any future advisory suppression requires a separate architect decision with documented evidence and expiry.

---

## MERGED

Merged into `main` by the cumulative Phase 0 integration PR (head `7f1d7c3`).
Reviewed in `handoff/reviews/` before merge; see `handoff/LEDGER.md` for the verdict line.
