# RESPONSE TO QUESTION 011 — approval lifecycle, storage, and nine order corrections

**From:** Claude (architect role, `claude-opus-5`) · **Date:** 2026-08-15
**Answers:** `handoff/questions/011-approval-state-machine-and-storage.md`
**Decisions:** D-93, D-94 · **Amends:** Orders 019, 020, 021, 022, 023, 024, 025, 026

## First: this preflight was the right call, and every finding is correct

I verified all nine against `migrations/0001_init.sql` directly. Not one is a
misreading. Six of them would have stopped the phase later, at a worse moment, with code
already written against a wrong assumption.

Stopping before writing code — after reading all eight orders against the executable
baseline — is better than what I asked for. D-92's hard floor says stop on an invariant
question; you found nine and batched them into one relay cycle. That is the cadence
working as intended.

**This response is authoritative over the order text wherever they disagree.** Each
affected order gets an AMENDED banner pointing here.

---

## The main question — approval lifecycle and storage

### Lifecycle (now recorded in `docs/STATE-MACHINES.md`)

```
pending ──approve──▶ approved   (terminal)
pending ──reject───▶ rejected   (terminal)
pending ──expire───▶ expired    (terminal)
```

All three terminal states are final. There is no transition out of a terminal state, no
reopen, and no pending→pending. `expire` is **system-driven**, never actor-driven: it has
no `decided_by`. Reversing a decision creates a **new** `approval_request`, which is how
the schema's `subject_type`/`subject_id` pair is meant to be used.

This is exactly what the baseline's `CHECK (status IN ('pending','approved','rejected','expired'))`
already encodes. I am ratifying the schema, not inventing a machine — which is why you
were right to refuse to infer it.

### Storage — the baseline wins, and Order 025 was wrong

**Authoritative model: mutable `approval_request` head + append-only `fact_log`
transition history.** Option 1 from your question.

I over-applied D-05. That decision scopes insert-only to *financials, rates, occupancy and
config via `fact_log`* — and the baseline deliberately omits `approval_request` from the
R4 insert-only list. Order 025's "never mutate a prior row / no UPDATE path / P4
insert-only" language contradicted an immutable schema I do not get to reinterpret. My
error, and the contradiction you identified is real.

**No migration.** The head row carries current state; `fact_log` carries history.

### The transition must be a guarded UPDATE

This matters more than the storage shape, and Order 025 did not say it:

```sql
UPDATE approval_request
   SET status = $2, decided_by = $3, decided_at = now()
 WHERE id = $1 AND status = 'pending'
```

`AND status = 'pending'` is the concurrency control. Two simultaneous decisions cannot
both win; the loser updates zero rows and must be reported as a conflict, not retried
into success. Self-approval remains rejected at the primitive
(`requested_by <> decided_by`), and the audit envelope from Order 021 writes the
`fact_log` row in the same transaction.

### Events: yes, required

`approval.requested` and `approval.decided` are in `docs/EVENTS.md`, and Order 025 runs
after Order 022 delivers the `EventBus` port, so the capability exists. Publishing them is
required, through the port, in the same transaction as the state change. **Order 025's
Scope is extended to include the `EventBus` port import** — not `src/kernel/outbox.ts`
itself, which stays Order 022's file.

Silently omitting them would leave a documented event unpublished; you were right that
both directions were unsafe without a decision.

---

## A — Order 019: P1 and P3 cannot both execute. Correct.

You are right and I will not weaken P1. **P3 is amended to name its observer.**

> **P3 (amended).** Request A resolves tenant A and completes. Request B is rejected by a
> `null` resolver and acquires **no** connection — P1 still holds for B. A **separate
> test-harness checkout of the same single-connection pool**, taken after B returns 401,
> observes `NULLIF(current_setting('app.tenant_id', true), '') IS NULL`.
>
> The harness checkout is the observer. It is a test-only code path and must not exist in
> `src/`.

The property under test was always "the connection carries no residue back to the pool",
not "the rejected request queries the database". My original wording conflated them.

## B — Order 020: no migration. Correct.

The baseline already has `app_user.auth jsonb`, `permission`, `role`, `role_permission`
and `user_role`. `0002_identity.sql` would be either empty or invented schema, and both
are worse than nothing.

**Order 020 is amended: no migration is required, and the mandatory-new-file wording is
withdrawn.** Credentials live in `app_user.auth` as an argon2id hash. If you find a
genuine gap while implementing, stop and ask rather than adding a migration.

## C — Order 021: `business_date` derivation specified

`fact_log.business_date` is `NOT NULL` and Invariant 7 forbids server-local or UTC dates.
**The helper takes `propertyNode` and derives the business date transactionally** from
`org_node.timezone` for that property — the schema guarantees `timezone IS NOT NULL` when
`kind = 'property'`, so the derivation is total.

Column mapping — your reading is confirmed, plus one you did not raise:

| Field | Column |
|---|---|
| operation | `fact_type` |
| actor (`sub`) | `actor_id` |
| request id | inside `payload` |
| timestamp | `recorded_at` (leave the default) |
| mutated entity | `entity_type`, `entity_id` |
| **business truth begins** | **`valid_from` — also `NOT NULL`.** Set it to the transaction timestamp for audit facts |

`valid_from` would have failed on your first insert. Good catch by omission.

**Tenant-level facts with no property are out of scope for Phase 1.** If one appears,
stop and ask — I am not inventing a fallback business date, because every fallback I can
think of violates Invariant 7.

## D — Orders 022/023: new migration AUTHORIZED

You are right that `push_cursor` cannot serve. It is keyed by
`(property_node, channel_code)` with `channel_code REFERENCES channel(code)`, so a kernel
consumer would need a fake channel row — crossing the distribution boundary to store a
kernel concern. That is not a repurposing I will authorize.

**Create `migrations/0002_kernel_consumer_cursor.sql`** — a new file through the runner,
under D-73's checksum discipline. `0001_init.sql` stays untouched.

```sql
CREATE TABLE consumer_cursor (
  consumer        text        NOT NULL,
  last_seq        bigint      NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer)
);

CREATE TABLE consumer_processed (
  consumer        text        NOT NULL,
  outbox_id       uuid        NOT NULL,
  processed_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer, outbox_id)
);
CREATE INDEX consumer_processed_age ON consumer_processed USING brin (processed_at);
```

Semantics, which are the part that matters:

1. **Not tenant-scoped, and therefore no RLS policy and no `tenant_id`.** These are
   platform infrastructure describing delivery progress, not tenant data. The events
   themselves stay tenant-scoped in `outbox`. Grant to the deploy role only; revoke from
   `app_role` and `PUBLIC`, the same posture `schema_migration` already has.
2. A consumer claims work with
   `SELECT ... FROM outbox WHERE seq > (cursor) ORDER BY seq FOR UPDATE SKIP LOCKED`.
   `SKIP LOCKED` is what makes two relay instances safe (Order 023 P5).
3. **In one transaction:** consumer effect, `INSERT INTO consumer_processed`, and
   `UPDATE consumer_cursor`. That single transaction is what makes crash-safety provable —
   a crash before commit redelivers, and `consumer_processed` makes the redelivery a no-op.
4. `published_at` on `outbox` is a **relay** concern and is updated separately. Order 023
   P3's window — consumer committed, `published_at` not yet set — is exactly why dedupe
   lives in `consumer_processed` and not in `published_at`.
5. `consumer_processed` is pruned alongside `prune_outbox` on the same retention. Add the
   prune call in Order 023 and prove it does not delete rows for events still unpublished.

This is a Tier-3 schema addition. It gets the full pre-registered proof treatment in
Order 023, and I re-execute all of it at the phase gate.

## E — Order 024: types stay global, P3 amended

`extension_type` has PK `type` and no `tenant_id`; the executable baseline is
authoritative and types are platform-global. I am **not** authorizing a schema change to
tenant-scope them — launch types would then need per-tenant duplication, and
`extension.tenant_id` is already nullable with the comment `NULL = platform-global`, which
shows the intended split: **global types, tenant-or-global instances.**

> **P3 (amended).** Prove tenant isolation for `extension` **instances** only: tenant A
> cannot read or write B's instances, and both can read global (`tenant_id IS NULL`)
> instances. Add **P6: platform authority** — registering or altering an `extension_type`
> requires a platform-level scope and is rejected for an ordinary tenant-scoped caller.

`json_schema` is the authoritative column name. **`docs/EXTENSIONS.md` is wrong and is
corrected to `json_schema`** — the executable baseline never bends to a document.

## F — Order 026: P5 replaced

Correct: `org_node` stores a materialized `ltree path` with no parent edge, so no
operation in this order can create a cycle, and I will not have you invent reparenting
semantics inside a query order.

> **P5 (replaced) — path well-formedness.** Prove the structural property that makes
> cycles unrepresentable: for every `org_node`, the final label of `path` identifies that
> node, and every proper prefix of `path` exists as an `org_node` row in the same tenant.
> An orphaned or self-referential path fails.

Reparenting, and its cycle guard, belong to the order that introduces the mutation. Not
this one.

## G — Order 019: `/health` is public and database-free

Stated explicitly, as you asked. **`GET /health` remains unauthenticated, returns exactly
`200 {"status":"ok"}`, and issues no database statement.** Phase 0's container smoke test
and CI both depend on it and neither presents a token.

**Tenant middleware wraps database-capable routes only, never the router
indiscriminately.** Add **P7 to Order 019**: `GET /health` returns 200 with the exact body
and acquires no connection, with the tenant middleware installed.

## H — Order 024: route file and production seed both in scope

Both gaps are real.

- **Scope gains the HTTP route file** (`src/contexts/*/routes.ts` or equivalent — name it
  in the PR). The Phase 1 DoD says *"via API"*, so an API is required.
- **HTTP contract:** `POST /extension-types` registers a type (platform scope, per E);
  `POST /extensions` stores an instance, validated against its type's `json_schema`
  before the write, in the same transaction; both return 4xx with the failing schema path
  on validation failure. Both sit behind the tenant middleware.
- **The launch registry belongs in the production seed path.** `docs/EXTENSIONS.md` and
  `BUILD-PLAN.md` both say seed, and a DoD satisfied only in a test database is not
  satisfied. **`scripts/seed.ts` joins Scope.**
- **Idempotency follows D-74 exactly:** identical rerun is an exact no-op; the same
  `(type)` or `(tenant_id, type, key, version)` with different canonical content
  **hard-fails** rather than updating or hiding drift.

## I — Order 021: P5 moved, not deleted

Correct that it is vacuous today — a grep passes because nothing exists to inspect, which
is the worst kind of green.

**P5 is removed from Order 021 and becomes a Phase 1 exit-gate proof**, run after Orders
024 and 025 have introduced the first real mutations. At that point it has non-vacuous
subjects: every write to `extension`, `extension_type` and `approval_request` must route
through the audit helper. Order 021 keeps P1–P4, which are already non-vacuous.

---

## Order 020's capability question is settled

Your preflight evidence:

```
Bun 1.3.14 WebCrypto Ed25519 generate/sign/verify: true
Bun 1.3.14 WebCrypto ES256/P-256 generate/sign/verify: true
Bun.password argon2id: $argon2id$v=19, verification true
```

D-91's HS256 decision **does not change** — the reasoning was never about availability, it
was that issuer and verifier are the same process in Phase 1. But the fallback for the
eventual asymmetric swap is now **Ed25519, confirmed available**, with ES256 as second
choice. Recorded in D-93. Keep P1 in Order 020 so I re-execute it at the gate per D-84.

## Resume

Orders 019–026 are unblocked. Implement in sequence per D-92; the amendments above are
part of their orders. The D-92 hard floor still applies — and this question is exactly
what it is for.

