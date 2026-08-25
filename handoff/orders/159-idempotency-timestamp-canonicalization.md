# Order 159 — Idempotency timestamp canonicalization

**Status:** READY — founder-observed CRUD blocker
**Phase:** 5 · human-testable application
**Branch:** `phase-5/idempotency-timestamp-canonicalization`
**Base:** `f2c436b9b5181eb00795956aff847537df638030`
**Risk tier:** 3 — shared durable mutation/idempotency primitive
**Owner:** Codex implementation; independent non-implementing Tier-3 review

## Outcome

Restore every idempotency-backed operator mutation under the pinned Bun 1.3.14 Linux
runtime. Canonicalize the one validated application clock instant before PostgreSQL
binding so `created_at`, `expires_at` and `completed_at` are accepted as exact
`timestamptz` values while all existing replay, expiry, concurrency and rollback
semantics remain unchanged.

The defect was found in the founder's authenticated Party-create journey: Party search
worked, while create returned 503 and PostgreSQL rejected a Bun-serialized JavaScript
Date string before any Party row was written. The fix is in the shared idempotency
primitive, not the Party UI or CRM service.

## Scope

- `src/kernel/idempotency.ts`;
- `tests/idempotency.integration.test.ts`;
- this order, additive D-426, `handoff/LEDGER.md`, and one additive independent review.

No HTTP, operator UI, CRM, inventory, reservation, rate, financial, migration, schema,
seed, permission, credential, dependency or protected referee path is in scope. If
another implementation path is required, stop and write a question.

## Required behavior

1. Validate the injected `Date` exactly once as today, then derive canonical UTC ISO
   strings for the claim instant and its exact 24-hour expiry. Bind all three timestamp
   columns through explicit `timestamptz` casts; do not depend on Bun's implicit Date
   serialization or PostgreSQL locale parsing.
2. Preserve one-clock semantics: `created_at` and `completed_at` represent the same
   validated instant, and `expires_at - created_at` remains exactly 86,400,000
   milliseconds. Do not call the clock again and do not use server-local time.
3. Preserve canonical request hashing, key hashing/redaction, status/body validation,
   first-claim execution, same-request replay, different-request conflict, expired-key
   reclaim, row locking, tenant/RLS isolation, 20-way contention containment and
   transaction-atomic rollback.
4. The exact pre-fix candidate must reproduce PostgreSQL rejection in the pinned
   `oven/bun:1.3.14-alpine` runtime. The corrected candidate must execute the same
   real-PostgreSQL path successfully; mocks or a host-only result are insufficient.
5. Party creation and at least one other direct operator mutation must pass through the
   real shared primitive after the correction. No domain-specific workaround is
   allowed.

## Proof

- exact-Base Linux-runtime red showing the `timestamptz` rejection with zero domain,
  fact, outbox and idempotency artifacts;
- corrected focused `tests/idempotency.integration.test.ts`, including exact persisted
  instants, 24-hour expiry, replay/conflict, expired reclaim, 20-way concurrency,
  rollback and RLS/tenant proofs;
- authenticated real-PostgreSQL `tests/operator-party-profiles.integration.test.ts`
  plus one direct operator idempotency-backed mutation suite;
- served authenticated browser Party search/create/search journey against the pinned
  runtime, with HTTP 201 and no browser/server errors;
- standing tests, typecheck, boundaries, licences, audit, runtime/security gates,
  protected hashes and fresh app-never-started `./setup.sh --db-only` referee 11/11;
- independent non-implementing Tier-3 reviewer personally reruns the exact red/green,
  focused domain and cumulative proofs.

## Forbidden

- Schema/migration edits, database-clock substitution, locale-dependent timestamp
  strings, a second clock read or relaxed timestamp validation.
- Party/UI/domain workarounds, swallowed exceptions, fabricated success, retry loops or
  weakening generic error handling.
- Changes to idempotency retention, hashes, response shape, conflict/replay/reclaim
  rules, transaction boundaries, RLS, roles or grants.
- New dependency, credential disclosure, public exposure, merge, push, deployment,
  self-review or self-merge.

## Definition of done

- [ ] Exact pinned-runtime Base fails and the candidate passes the same timestamp path.
- [ ] Shared idempotency semantics and all named real-PostgreSQL suites pass.
- [ ] Founder Party create is successful and searchable in the served app.
- [ ] Fresh referee is 11/11 and an independent Tier-3 reviewer approves one immutable
      candidate.

