> **AMENDED by `handoff/questions/011-ARCHITECT-RESPONSE.md` (D-94) — read it first.**
> **A:** P3 is rewritten; its observer is a separate test-harness checkout of the same
> single-connection pool, taken after the 401. P1 is unchanged and not weakened.
> **G:** `GET /health` stays public, database-free and exactly `200 {"status":"ok"}`;
> tenant middleware wraps database-capable routes only. New **P7** proves it.

# ORDER 019 — transaction-local tenant context middleware

**Phase:** 1 · **Branch:** `phase-1/tenant-context-middleware`
**Written by:** Claude (architect role, `claude-opus-5`)
**Date:** 2026-08-15 · **Tier:** 3 · **Decisions:** D-10, D-91, D-92

## Goal

Every database statement in the application runs inside a transaction whose
`app.tenant_id` was set from a verified caller identity, or it does not run at all.

## Why now, and why it is first

Every later Phase 1 order writes through this. If it is wrong, all 73 tenant tables and
both `security_invoker` views still carry correct RLS policies and none of them protect
anything — the policies evaluate against a setting nobody set. This is the single
highest-blast-radius order in the phase, which is why it goes first while there is
nothing built on top of it.

## The ordering problem, and the shape that solves it

Auth is Order 020, so this middleware cannot depend on JWT verification existing. It
therefore takes a **`TenantResolver` port**:

```ts
interface TenantResolver {
  resolve(request: Request): Promise<{ tenantId: string } | null>;
}
```

Order 020 supplies the JWT implementation. The benefit is not just sequencing: it means
the middleware's guarantees are tested independently of token parsing, so a failure tells
you which of the two is broken.

**The danger in this shape is a test double shipping as a bypass.** So: the resolver
registered in the default application build must **fail closed** — return `null` and
therefore 401 — and reading tenant identity from any request-controlled input is
forbidden outright (see Forbidden). Test doubles live in `tests/` and are never imported
by `src/`.

## Scope — files Codex may create or change

- `src/kernel/tenant-context.ts` — the middleware and the `TenantResolver` port
- `src/kernel/db.ts` — the single exported way to obtain a connection
- `src/kernel/index.ts` — exports
- `src/app.ts` — wire the middleware
- `tests/tenant-context.integration.test.ts`
- `package.json` — only to add a test script, if needed

**No migration.** `app.tenant_id` is a runtime GUC already exercised by
`tests/seed_fixture.sql`; this order adds no schema. If you conclude a migration is
required, **stop and write `handoff/questions/011.md`** — that conclusion would mean I
have misread the baseline and it needs deciding, not implementing.

## Required behaviour

1. The middleware resolves tenant identity **only** via `TenantResolver`.
2. On `null`, respond 401 and **open no database connection at all**.
3. On success, open a transaction and issue
   `SELECT set_config('app.tenant_id', $1, true)` — transaction-local, per D-10. Session
   `SET` is forbidden and would break PgBouncer.
4. The handler runs inside that transaction. Commit on success, roll back on throw.
5. Context must not survive the request on a pooled connection.
6. `src/kernel/db.ts` exports no way to get a connection that skips this path.

## Pre-registered proofs (D-92) — these are the deliverable

Each is an executable test that fails if the property breaks. Paste all six outputs.

| # | Proves | Must show |
|---|---|---|
| P1 | No identity → no database contact | 401, and connection-acquisition counter unchanged. Assert the counter, not the absence of an error |
| P2 | Context is set | `current_setting('app.tenant_id', true)` inside the handler equals the resolved tenant |
| P3 | **Context does not leak** | Request A (tenant A), then request B with a resolver returning `null`, forced onto the same pooled connection: B sees `NULLIF(current_setting('app.tenant_id', true), '') IS NULL`. **Assert exactly that expression** — per D-78 Postgres clears a custom GUC to empty string, not NULL, and a byte-equality assertion here passes while leaking |
| P4 | Concurrency is safe | ≥20 interleaved requests alternating two tenants; every handler observes its own tenant and no other. Reuse the referee's threading approach |
| P5 | **The error path releases context** | A handler that throws → transaction rolled back, connection returned, and the next request on that connection sees no tenant. F1 was exactly this class: the hook that was never exercised on the failure path |
| P6 | RLS actually engages | Through the middleware as tenant A, `SELECT count(*) FROM space` returns A's rows; as tenant B, zero. Behavioural proof that the setting reaches the policies |

P3 and P5 are the ones that will catch something. P1 is the one people write wrong — assert no connection was acquired, not merely that the response was 401.

## Definition of done

- [ ] All six pre-registered proofs pass, outputs pasted
- [ ] `./setup.sh --db-only` → `11 passed, 0 failed of 11`
- [ ] Full D-87 self-check green (starting with `bun install --frozen-lockfile`)
- [ ] `migrations/` and `tests/run_invariants.py` untouched — prove with
      `git diff --stat main..HEAD -- migrations/ tests/run_invariants.py` printing nothing
- [ ] No file outside Scope

## Forbidden in this order

- Session-level `SET` for tenant context. D-10 requires transaction-local `set_config`;
  session `SET` survives the connection and breaks under PgBouncer
- Reading tenant identity from a header, query parameter, body field, path segment,
  cookie, or any other request-controlled input. The resolver is the only source, and in
  Order 020 the resolver reads a *signed* claim
- A default resolver that returns a tenant when identity is absent, including a
  "development mode" one. Fail closed or not at all
- Importing anything from `tests/` into `src/`
- Any authentication, token parsing, user lookup or login endpoint — that is Order 020
  and building it here would make both orders unreviewable
- Editing `migrations/` or `tests/run_invariants.py`
- Merging or self-approving

## Deferred review protocol

Stop and write `handoff/questions/011.md` if: a migration appears necessary; Elysia's
lifecycle cannot guarantee the handler runs inside the transaction; or connection pooling
makes P3 unprovable as written. Do not work around any of these — each is an invariant
question, and under D-92's hard floor they stop the phase rather than the order.

## Open questions already answered

> **Q:** May the middleware fall back to a default tenant when identity is absent, for
> local development convenience?
> **A:** No. A development bypass is a production bypass that nobody removed. Local work
> uses a resolver wired to the demo tenant from D-74 in the *test* build, never a
> fallback in `src/`. (Forbidden, above)

> **Q:** Should the transaction wrap the whole request or just the database calls?
> **A:** The whole handler. A handler that does two writes in two transactions can leave
> half its work committed, and the audit envelope in Order 021 assumes one transaction
> per request. (Required behaviour, 4)

## Review requirement

Tier 3 under D-92: pre-registered proofs, produced by the builder and re-executed by the
architect at the Phase 1 exit gate. Proceed to Order 020 once all six pass — do not wait
for review. The builder does not merge.
