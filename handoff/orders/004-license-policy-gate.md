# ORDER 004 — Dependency license policy gate

**Phase:** 0 · **Branch:** `phase-0/license-policy-gate` · **Tier:** 1 (routine)
**Written by:** OpenAI Codex, acting as temporary architect by founder request while Claude is unavailable · **Date:** 2026-08-14
**Depends on:** Order 003 commit `402bfc8`; review later as `phase-0/baseline-ci..phase-0/license-policy-gate`

## Goal

Enforce Yellow's permissive dependency-license allowlist locally and in CI without adding another package.

## Why now

This implements the Phase 0 license-check gate fixed by `DECISIONS.log` and `docs/DEPENDENCIES.md`, while remaining independent of protected database and domain behavior.

## Scope — files Codex may create or change

- `scripts/license-check.ts`
- `tests/license-check.test.ts`
- `package.json`
- `tsconfig.json`
- `.github/workflows/ci.yml`

Anything not listed here is OUT of scope. If another file is required, STOP and ask in `handoff/questions/004.md`; do not widen scope silently.

## Contracts to honour

- `PROJECT.md` — verification doctrine
- `DECISIONS.log` entry 39 — Phase 0 license allowlist and documented-exception rule
- `docs/DEPENDENCIES.md` — permitted embedded licenses and AGPL restrictions
- Order 003 — frozen install and least-privilege CI

## Required implementation

- Implement the checker with Bun and standard platform APIs only; add no dependency.
- Scan installed dependency `package.json` manifests under `node_modules`, including scoped and nested packages.
- Require a non-empty package name, version, and declared license expression for every scanned package.
- Accept only these SPDX identifiers: `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `PostgreSQL`, and `MPL-2.0`.
- Allow `AND`/`OR` expressions only when every referenced identifier is allowed.
- Reject missing/unknown licenses, deprecated `licenses` data with no usable expression, `WITH` exceptions, `LicenseRef-*`, `+` suffixes, GPL/LGPL/AGPL, and any other identifier.
- Deduplicate package name/version/license findings and produce deterministic sorted output.
- On success, report how many unique installed packages passed.
- On failure, list every rejected package and exit non-zero; do not stop after the first violation.
- Export pure parsing/evaluation functions so unit tests cover accepted, compound, forbidden, malformed, and missing-license cases.
- Add package script `license-check` and run it in CI immediately after frozen dependency installation.

## Definition of done

- [ ] Unit tests prove every allowlisted identifier passes
- [ ] Unit tests prove GPL, LGPL, AGPL, unknown IDs, `LicenseRef`, `WITH`, `+`, blank, and missing declarations fail
- [ ] Unit tests prove an all-allowed compound expression passes and a mixed compound expression fails
- [ ] `bun run license-check` passes against the actual frozen dependency tree
- [ ] `bun install --frozen-lockfile`, `bun run typecheck`, and plain `bun test` pass
- [ ] CI workflow still parses, uses only SHA-pinned actions, and has read-only permissions
- [ ] `setup.ps1 -DbOnly` prints `11 passed, 0 failed of 11`
- [ ] No implementation file outside Scope changes
- [ ] Commit begins with `[codex]`; do not merge before independent review

## Forbidden in this order

- Adding a runtime or development dependency
- Adding a license exception file or approving any exception
- Treating an absent/unknown/ambiguous license as allowed
- Editing Docker packaging, Compose, application/domain code, setup scripts, documentation, or lockfiles
- Editing anything under `migrations/`, including immutable `migrations/0001_init.sql`
- Database, RLS, tenancy, states, events, occupancy, journal/posting, fiscal, or statutory logic
- Weakening existing CI checks or GitHub permissions
- Merging this stacked branch before prior orders and this order are independently reviewed in sequence

## Deferred review protocol

Claude reviews this order only after Orders 001–003. Any proposed license exception is a separate architect decision and must be documented in `docs/licence-exceptions.md`; this order authorizes no exceptions.
