# ORDER 003 — Baseline CI

**Phase:** 0 · **Branch:** `phase-0/baseline-ci` · **Tier:** 1 (routine)
**Written by:** OpenAI Codex, acting as temporary architect by founder request while Claude is unavailable · **Date:** 2026-08-14
**Depends on:** Order 002 commit `382fdfd`; review later as `phase-0/containerized-health-app..phase-0/baseline-ci`

## Goal

Add a least-privilege GitHub Actions workflow that verifies the frozen Bun install, strict typecheck, tests, container build, and containerized health endpoint.

## Why now

This advances the Phase 0 CI Definition of Done for already-implemented runtime behavior while deliberately deferring fresh-database migration and RLS gates for the required Tier-3 review.

## Scope — files Codex may create or change

- `.github/workflows/ci.yml`

Anything not listed here is OUT of scope. If another file is required, STOP and ask in `handoff/questions/003.md`; do not widen scope silently.

## Contracts to honour

- `PROJECT.md` — verification doctrine and Ten Invariants
- `BUILD-PLAN.md` — Phase 0 CI requirements
- `docs/DEPENDENCIES.md` — dependency hygiene and committed lockfile
- Orders 001–002 — exact health contract, pinned Bun runtime, and container behavior

## Required implementation

- Trigger on pull requests and pushes to `main`; allow manual dispatch.
- Set workflow-level GitHub token permissions to `contents: read` only.
- Use `ubuntu-24.04` and a finite job timeout.
- Pin third-party actions by immutable commit SHA with version comments:
  - `actions/checkout` v6: `d23441a48e516b6c34aea4fa41551a30e30af803`
  - `oven-sh/setup-bun` v2: `0c5077e51419868618aeaa5fe8019c62421857d6`
- Pin Bun to `1.3.14`.
- Run `bun install --frozen-lockfile`, `bun run typecheck`, and plain `bun test`.
- Build the application image using the repository Dockerfile.
- Start the built image as a background container without PostgreSQL or Valkey.
- Poll the health endpoint with a bounded retry loop and assert HTTP 200 plus exact body `{ "status": "ok" }`.
- Always remove the smoke-test container, including after failure.
- Use fixed CI-only image/container names that cannot collide with the Compose service names.

## Definition of done

- [ ] Workflow YAML parses successfully
- [ ] Every external action is SHA-pinned and token permissions are read-only
- [ ] All workflow commands are reproduced successfully on the local branch
- [ ] `bun install --frozen-lockfile`, `bun run typecheck`, and plain `bun test` pass
- [ ] CI-equivalent Docker build and exact health smoke test pass
- [ ] `setup.ps1 -DbOnly` prints `11 passed, 0 failed of 11`
- [ ] No implementation file outside Scope changes
- [ ] Commit begins with `[codex]`; do not merge before independent review

## Forbidden in this order

- Editing application code, tests, packages, lockfiles, Docker packaging, Compose, setup scripts, or documentation
- Adding dependency installation, audit, licence, CSP, migration, seed, schema-drift, database, RLS, or tenant-isolation jobs
- Editing anything under `migrations/`, including immutable `migrations/0001_init.sql`
- Database connections, SQL, tenancy, authentication, authorization, states, events, occupancy, journal/posting, fiscal, or statutory logic
- Unpinned action tags such as `@v6`, `@v2`, or `@main`
- Write permissions, stored credentials, publishing, deployment, or merge automation
- Merging this stacked branch before Orders 001–003 are independently reviewed and approved in order

## Deferred review protocol

Claude reviews the stack sequentially: Windows support, Order 001, Order 002, then this isolated Order 003 range. Database and RLS CI are separate future orders requiring the review tier defined by `handoff/ROSTER.md`.

---

## MERGED

Merged into `main` by the cumulative Phase 0 integration PR (head `7f1d7c3`).
Reviewed in `handoff/reviews/` before merge; see `handoff/LEDGER.md` for the verdict line.
