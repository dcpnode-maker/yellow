# ORDER 001 — Phase 0 runtime health scaffold

**Phase:** 0 · **Branch:** `phase-0/runtime-health-scaffold` · **Tier:** 1 (routine)
**Written by:** OpenAI Codex, acting as temporary architect by founder request while Claude is unavailable · **Date:** 2026-08-14

## Goal

Create the minimal strict TypeScript/Bun/Elysia application scaffold with a tested `GET /health` endpoint.

## Why now

This is the smallest safe executable slice of Phase 0. It establishes the runtime, typecheck, test command, lockfile, and health endpoint required by the BUILD-PLAN Definition of Done without touching database, tenancy, RLS, migration, occupancy, ledger, fiscal, event, or domain-context behavior.

## Scope — files Codex may create or change

- `package.json`
- `bun.lock`
- `bunfig.toml`
- `tsconfig.json`
- `src/app.ts`
- `src/server.ts`
- `tests/health.test.ts`

Anything not listed here is OUT of scope. If the work seems to require another file, STOP and ask in `handoff/questions/001.md`; do not widen scope silently.

## Contracts to honour (read before writing code)

- `PROJECT.md` — coding standards, module boundaries, Ten Invariants, and never-do list
- `BUILD-PLAN.md` — Phase 0 only, especially strict TypeScript, Bun + Elysia, `bun test`, and health endpoint 200
- `docs/SECURITY.md` §4 — edge validation and application hardening; this order does not add user input or relax headers
- `docs/DEPENDENCIES.md` — Bun risk posture, permissive dependency policy, and committed lockfile

No domain contract, state machine, entity-pattern skill, or event contract is invoked because this order creates no domain module, entity, state transition, persistence, or event.

## Required implementation

- Use Bun as package manager and runtime.
- Add Elysia as the only production dependency. Add only the Bun type package needed for TypeScript/tooling as a development dependency.
- Commit the Bun lockfile produced by installation; do not hand-author it.
- Configure TypeScript with at least `strict: true`, `noUncheckedIndexedAccess: true`, and `noEmit: true` using Bun-compatible module settings.
- Provide package scripts named `dev`, `start`, `typecheck`, and `test`:
  - `dev` runs the server with Bun watch mode.
  - `start` runs the server normally.
  - `typecheck` performs a no-emit TypeScript check.
  - `test` runs the Bun test suite.
- `src/app.ts` must export the Elysia application without binding a network port so tests can call `app.handle(...)` in-process.
- `src/server.ts` is the only entry point that calls `listen`; it uses `PORT` when present and otherwise port `3000`.
- `GET /health` must return HTTP 200 with JSON exactly equal to `{ "status": "ok" }`.
- The health handler must not connect to PostgreSQL, Valkey, NATS, or any external service. This is a process-liveness endpoint only.
- The test must exercise the Elysia application in-process (no real listening socket) and assert both status 200 and the exact JSON body.
- Configure Bun test discovery to ignore only `tests/occupancy-stress.test.ts`, which is a future Phase 2 test whose required database module does not exist yet. Document in the configuration that the Phase 2 activation order must remove this temporary exclusion.
- Do not scaffold bounded-context directories in this order; their canonical naming and public surfaces belong in a separate order.

## Definition of done

- [ ] `bun install --frozen-lockfile` succeeds after the lockfile has been generated and committed
- [ ] `bun run typecheck` succeeds with strict checking enabled
- [ ] `bun test` is green and proves `GET /health` returns status 200 plus exactly `{ "status": "ok" }`
- [ ] `./setup.sh --db-only` prints `11 passed, 0 failed of 11`
- [ ] No new or changed file exists outside Scope
- [ ] PR body references Order 001 and pastes the typecheck, test, and invariant-battery output
- [ ] PR is reviewed by someone other than the builder; the builder must not approve or merge their own work

## Forbidden in this order

- Editing anything under `migrations/`, including immutable `migrations/0001_init.sql`
- Editing `docker-compose.yml`, setup/state scripts, CI configuration, documentation, handoff logs, or existing invariant/stress tests
- Database connections, SQL, migrations, seeds, tenant context, RLS, authentication, authorization, or environment-schema work
- New domain contexts, entities, tables, columns, status values, state transitions, events, or outbox writes
- Occupancy, availability, journal/posting, money, fiscal, statutory, or document-numbering logic
- Adding dependencies other than Elysia and the Bun TypeScript definitions required above
- Starting a server as a side effect of importing `src/app.ts`
- Returning timestamps, hostnames, dependency state, version details, or other variable data from `/health`
- Ignoring any test path other than the specifically approved future Phase 2 `tests/occupancy-stress.test.ts`

## Architect answers fixed for this order

> Q: Is `/health` a dependency-readiness check?
> A: No. It is process liveness only; dependency readiness is outside this order.

> Q: What response contract should the endpoint expose?
> A: HTTP 200 and exactly `{ "status": "ok" }` as JSON.

> Q: May implementation begin on domain context scaffolding at the same time?
> A: No. Keep this first order narrow; context scaffolding will be ordered separately.

> Q: May this order add `bunfig.toml` so plain `bun test` does not execute the future Phase 2 occupancy stress test before its database module exists?
> A: Yes. Founder approved the scope expansion on 2026-08-14. Ignore only `tests/occupancy-stress.test.ts`, and require its Phase 2 activation order to remove the exclusion.
