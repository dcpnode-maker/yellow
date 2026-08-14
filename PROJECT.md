# PROJECT.md — canonical constitution (ALL agents read this first)

**This file is the single source of truth.** `CLAUDE.md`, `AGENTS.md`, and every
future per-agent file are thin adapters that point here and add only a role. If an
adapter ever contradicts this file, **this file wins** — and the contradiction is a
bug to fix, not a judgement call.

Why it's built this way: duplicated rules drift. Two copies survive; four don't.

---

## What Yellow is

A full-scope hospitality ERP (PMS + channel manager + booking engine + CRS + CRM +
native hotel finance) for hotels, hostels, serviced apartments and STR. Two-person
founding team; AI agents write essentially all code; a founder reviews every
critical-path change. Stack: **TypeScript (strict) · Bun · Elysia · PostgreSQL 16 ·
modular monolith**. Zero-cost doctrine: runs on free/OSS infrastructure.

**Current state:** schema validated (80 tables, loads clean), invariant battery
green (11/11), no application code yet. Phase 0 is next.

## The Ten Invariants (violating any is never acceptable)

1. **`space_occupancy` is written only via `record_occupancy()` / `release_occupancy()`.**
   Never INSERT/UPDATE/DELETE directly — grants forbid it and the battery asserts the
   denial (SQLSTATE 42501). Claim-range design, SCHEMA.sql §4, prototype finding P1.
2. **PostgreSQL is authoritative for every sellability decision.** Valkey/projections
   are read-only caches; a booking is legal only when the constraint accepts the write.
3. **Insert-only tables stay insert-only**: `journal`, `posting_line`, `fact_log`,
   `outbox`, `document`, `space_occupancy`. Corrections are new rows
   (`reverses`/`supersedes`), never edits. Exactly two sanctioned updates:
   `rate_price.superseded_by` and `outbox.published_at`.
4. **Every journal balances to zero** in one currency. The deferred trigger enforces
   it; your code constructs balanced journals rather than using the trigger as flow
   control.
5. **Tenancy**: every tenant-scoped query runs after
   `SELECT set_config('app.tenant_id', $1, true)` — transaction-local **true** is
   mandatory under PgBouncer. `tenant_id` leads every composite index. RLS is the
   backstop; verified identity at the API boundary is the front line. **Every view
   carries `security_invoker = true`** — views bypass RLS otherwise (proven leak).
6. **Money = bigint minor units + `char(3)` currency.** Never float. No arithmetic
   across currencies without an explicit `fx` journal.
7. **`business_date` derives from the PROPERTY's timezone**, never the server clock.
   After `business_day.sealed_at`, only `adjustment`/`correction` journals may target it.
8. **No PAN ever enters the system.** `payment_instrument.token` holds PSP/network
   tokens only. Hosted fields / redirect flows at the edge.
9. **Every state change other modules care about writes an `outbox` row in the same
   transaction** (EVENTS.md). No dual writes, no fire-and-forget.
10. **JSONB is queried with `@>` against GIN** (or promoted to a typed column). `->>`
    in a WHERE clause on an indexed jsonb column is a bug — silent seq scan.

## Module boundaries

13 bounded contexts (SCHEMA.sql §1–§11). Layout `src/contexts/<context>/…` with
`index.ts` as the ONLY import surface. Cross-context reads go through that surface;
cross-context effects go through outbox events. If a change spans contexts, write the
event first.

## Coding standards

- TS `strict`, `noUncheckedIndexedAccess`. Branded types `TenantId`, `Money`,
  `BusinessDate`, `Period`. Discriminated unions for every status; exhaustive
  `switch` with `assertNever` — no default-case escapes.
- Typed `Result<T, DomainError>` at context boundaries; throw only at the edge.
- Repositories accept a `Tx` handle; occupancy + facts + outbox happen in ONE
  transaction. A function that writes state but takes no `Tx` is a design smell.
- Migrations forward-only, expand→migrate→contract. Never rewrite an applied file.
  `migrations/0001_init.sql` is an immutable baseline.
- Every invariant above has a test that tries to break it. Concurrency tests use real
  Postgres, never mocks.

## Never do

Add Kafka / Redis-as-authority / microservices / ORM-magic lazy loading; UPDATE an
insert-only table; bypass the choke point "just for backfill"; store PAN/CVV; use
server-local dates for business logic; create a second source of truth for anything in
invariants 4 or 7; hand-write availability math outside the projection rebuilder.

---

## Session ritual — every agent, every session

1. Run `./state.sh` — this prints identical ground truth for everyone: branch, head,
   phase, last ledger lines, last decisions, open orders and questions.
2. Read this file, then `BUILD-PLAN.md` for the **current phase only**.
3. `grep -i "<topic>" DECISIONS.log` **before deciding anything** — the answer may
   already exist, and re-deciding it wastes budget and creates contradictions.
4. State in one sentence what you're doing and which order/phase it serves.
5. Write tests with the code, never after.
6. If a decision isn't covered by the docs — **stop and ask; do not invent.**

## Where truth lives

| Question | File |
|---|---|
| What are the rules? | **this file** |
| What's the data model? | `migrations/0001_init.sql` |
| What are the API/module contracts? | `docs/CONTRACTS.md` |
| What state transitions are legal? | `docs/STATE-MACHINES.md` |
| What events exist? | `docs/EVENTS.md` |
| How is config shaped? | `docs/EXTENSIONS.md` |
| What does the UI do? | `docs/UI-SPEC.md` |
| What's already been decided? | `DECISIONS.log` |
| What are we building next? | `BUILD-PLAN.md` |
| Who does what? | `docs/WORKFLOW.md`, `handoff/ROSTER.md` |
| What just happened? | `handoff/LEDGER.md` |
| Is it still correct? | `./setup.sh --db-only` → 11/11 |

## The referee

`tests/run_invariants.py` covers double-booking under concurrency, ledger balance,
sealed days, gapless invoice numbering, and tenant isolation through tables **and**
views. It must print `11 passed, 0 failed` before any PR is reviewable and after
every merge. **If a change makes it red, the change is wrong — not the test.**

## One principle above all

**Confidence is not verification.** During this project's design, a concurrency flaw
survived nine rounds of review and fell to a stress test; a cross-tenant leak was
missed by two independent model reviews and was caught by a two-tenant fixture. Any
agent asserting correctness without running something is guessing. Run the thing.
