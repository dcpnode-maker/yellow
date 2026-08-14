# CLAUDE.md — Project Constitution (place at repo root)

You are building the **Yellow**: a full-scope hospitality ERP (PMS + channel
manager + booking engine + CRS + CRM + native hotel finance) for hotels, hostels,
serviced apartments and STR. Two-person founding team; you write essentially all code;
one founder reviews every critical-path change. Stack: **TypeScript (strict) · Bun ·
Elysia · PostgreSQL 16 · modular monolith**. Zero-cost doctrine: platform runs on
free/OSS infrastructure; see architecture doc §10–13.

## The Ten Invariants (violating any of these is never acceptable)

1. **`space_occupancy` is written only via `record_occupancy()` / `release_occupancy()`.**
   Never INSERT/UPDATE/DELETE it directly — grants forbid it and CI test `choke-point.test`
   asserts the denial. Proven design: claim-range constraint (SCHEMA.sql §4, prototype P1).
2. **PostgreSQL is authoritative for every sellability decision.** Valkey/projections are
   read-only caches; a booking is legal only when the constraint accepts the write.
3. **Insert-only tables stay insert-only**: `journal`, `posting_line`, `fact_log`,
   `outbox`, `document`, `space_occupancy`. Corrections are new rows (`reverses`/
   `supersedes`), never edits. The single sanctioned update: `rate_price.superseded_by`
   and `outbox.published_at`.
4. **Every journal balances to zero** in one currency. The deferred trigger enforces it;
   your code must construct balanced journals, not rely on the trigger as flow control.
5. **Tenancy**: every tenant-scoped query runs after
   `SELECT set_config('app.tenant_id', $1, true)` — transaction-local **true** is
   mandatory (PgBouncer). `tenant_id` leads every composite index. Never interpolate
   tenant filters manually as the primary control; RLS is the backstop, verified identity
   at the API boundary is the front line.
6. **Money = bigint minor units + `char(3)` currency.** Never float. Never arithmetic
   across currencies without an explicit `fx` journal.
7. **`business_date` derives from the PROPERTY's timezone**, never the server clock.
   After `business_day.sealed_at`, only `adjustment`/`correction` journals may target it.
8. **No PAN ever enters the system.** `payment_instrument.token` holds PSP/network tokens
   only. Hosted fields / redirect flows at the edge.
9. **Every state change that other modules care about writes an `outbox` row in the same
   transaction** (event contract in EVENTS.md). No dual writes, no fire-and-forget.
10. **JSONB is queried with `@>` against GIN** (or promoted to a typed column). `->>`
    in a WHERE clause on an indexed jsonb column is a bug (silent seq scan).

## Module boundaries

13 bounded contexts (SCHEMA.sql §1–§11). Source layout: `src/contexts/<context>/…` with
`index.ts` as the ONLY import surface. Cross-context reads go through that surface;
cross-context effects go through outbox events. ESLint `import/no-restricted-paths`
enforces it. If a change spans contexts, write the event first.

## Coding standards

- TS `strict`, `noUncheckedIndexedAccess`. Branded types: `TenantId`, `Money`,
  `BusinessDate`, `Period` (`src/kernel/types.ts`). Discriminated unions for every
  status; `switch` with exhaustiveness (`assertNever`) — no default-case escapes.
- Errors: typed `Result<T, DomainError>` at context boundaries; throw only at the edge.
- Repositories accept a `Tx` handle; **occupancy + facts + outbox happen in one
  transaction** — a function that writes state but takes no `Tx` is a design smell.
- Migrations: forward-only, expand→migrate→contract; never rewrite an applied file.
- Tests: every invariant above has a test that tries to break it. Concurrency tests use
  real Postgres (see prototype/), never mocks, for anything touching §4 or §7.

## Session ritual (every Claude Code session)

1. Read this file. 2. State which BUILD-PLAN.md phase/task you're on. 3. Cite the
SCHEMA.sql §/EVENTS.md entries you're implementing. 4. Write tests with the code.
5. If a decision isn't covered by the package docs — **stop and ask; do not invent.**
Log any approved deviation in `DECISIONS.log` (date, what, why).

## Never do

Add Kafka/Redis-as-authority/microservices/ORM-magic-lazy-loading; UPDATE an insert-only
table; bypass the choke point "just for backfill"; store PAN/CVV; use server-local dates
for business logic; create a second source of truth for anything in §4 or §7;
hand-write availability math outside the projection rebuilder.

## Model policy (token discipline — switch with /model, log escalations)
- **Fable 5** — phase kickoff & end-of-phase review gates; ANY change touching
  SCHEMA/migrations, occupancy claims, ledger/journal logic, fiscal chains, or RLS;
  concurrency debugging; DECISIONS.log entries.
- **Opus 5 (default)** — feature implementation, adapters, refactors, API handlers.
- **Sonnet 5** — scaffolding, tests-from-specs, docs, seed data, log triage first pass.
- Escalation rule: if a Sonnet/Opus session hits an invariant question, STOP,
  restate it in one paragraph, switch to Fable, decide, append to DECISIONS.log,
  switch back. Never let a cheap session quietly decide an expensive thing.
