# ORDER 002 — Containerized health app

**Phase:** 0 · **Branch:** `phase-0/containerized-health-app` · **Tier:** 1 (routine)
**Written by:** OpenAI Codex, acting as temporary architect by founder request while Claude is unavailable · **Date:** 2026-08-14
**Depends on:** Order 001 commit `433b5cb`; review this order later as `phase-0/runtime-health-scaffold..phase-0/containerized-health-app`

## Goal

Package the Order 001 Bun/Elysia health application as a non-root container and expose it as the `app` service in Docker Compose.

## Why now

This is the next smallest safe Phase 0 slice and advances the fresh-clone `docker compose up` → health endpoint 200 Definition of Done without adding persistence or domain behavior.

## Scope — files Codex may create or change

- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`

Anything not listed here is OUT of scope. If another file is required, STOP and ask in `handoff/questions/002.md`; do not widen scope silently.

## Contracts to honour

- `PROJECT.md` — Ten Invariants and never-do list
- `BUILD-PLAN.md` — Phase 0 container and health endpoint requirements
- `DECISIONS.log` — Bun-native stack, NATS deferral, Yellow container isolation, and portable Compose deployment
- Order 001 — `/health` remains process liveness only and exactly returns `{ "status": "ok" }`

## Required implementation

- Pin the runtime image to the Bun version used to generate Order 001: `oven/bun:1.3.14-alpine`.
- Use a multi-stage Dockerfile so dependency installation is isolated from the runtime image.
- Install production dependencies with the committed lockfile and `--frozen-lockfile`.
- Run the application as the image's non-root `bun` user.
- Set production mode, expose port `3000`, and start through the existing `start` package script.
- Add a `.dockerignore` that excludes Git metadata, local dependencies, environment files, logs, coverage, handoff files, documentation, prototypes, and local test/setup artifacts from the Docker build context while retaining the files needed to install and run the app.
- Add one Compose service named `app`, one container named `yellow-app`, and host mapping `3000:3000`.
- The app must not depend on PostgreSQL or Valkey readiness; Order 001 defines `/health` as process liveness with no external connections.
- Add a container healthcheck that requests `http://127.0.0.1:3000/health` using Bun itself and fails unless the response is HTTP 200 with exact JSON `{ "status": "ok" }`.
- Do not add NATS; it is deferred by `DECISIONS.log`.

## Definition of done

- [ ] `docker compose config --quiet` succeeds
- [ ] `docker compose build app` succeeds from the committed Docker context
- [ ] `docker compose up -d app` reaches Docker health status `healthy`
- [ ] Host request to `http://127.0.0.1:3000/health` returns status 200 and exact JSON `{ "status": "ok" }`
- [ ] `bun install --frozen-lockfile`, `bun run typecheck`, and plain `bun test` remain green
- [ ] `setup.ps1 -DbOnly` prints `11 passed, 0 failed of 11`
- [ ] No file outside Scope changes during implementation
- [ ] Commit begins with `[codex]`; do not merge before independent review

## Forbidden in this order

- Editing package/runtime source, tests, lockfiles, setup scripts, CI, or documentation
- Editing anything under `migrations/`, including immutable `migrations/0001_init.sql`
- Database connections, SQL, seeds, RLS, tenant context, authentication, or authorization
- Domain contexts, entities, tables, columns, states, transitions, events, or outbox behavior
- Occupancy, availability, journal/posting, money, fiscal, statutory, or document-numbering logic
- Adding NATS or any new application dependency
- Adding PostgreSQL or Valkey as a healthcheck dependency for the app
- Merging this branch before Claude or another independent reviewer approves Orders 001 and 002

## Deferred review protocol

Claude may review after the temporary spend limit clears. Review Order 001 first, then review this order's isolated commit range. If Order 001 requires changes, rebase or rebuild this dependent branch only after Order 001 is corrected; do not merge stacked branches out of order.
