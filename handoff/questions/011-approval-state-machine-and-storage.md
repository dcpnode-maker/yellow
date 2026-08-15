# QUESTION 011 — approval lifecycle and storage contradict Order 025

**Status:** OPEN
**Phase:** 1 · **Order:** 025 · **Branch:** `phase-1/tenant-context-middleware`
**Raised by:** Codex (builder) · **Date:** 2026-08-15
**Hard floor:** D-92 invariant question; Order 025 explicitly requires this stop

## What the preflight found

`docs/STATE-MACHINES.md` does not declare an `approval_request` state machine. It
mentions approvals as guards and mentions carrying a discrepancy through an approval,
but it contains no exhaustive approval transition table. Order 025 requires the states
and legal transitions to already exist there and says to stop rather than invent them.

There is also a storage-shape contradiction that must be resolved with the lifecycle:

- `migrations/0001_init.sql` defines one `approval_request` head row with mutable-looking
  `status`, `decided_by`, and `decided_at` columns. Its status check permits `pending`,
  `approved`, `rejected`, and `expired`.
- `approval_request` is not in the baseline's R4 list of insert-only tables.
- Order 025 nevertheless requires each transition to write a row, never mutate a prior
  row, expose no UPDATE path, and make history reconstructable from rows.
- The baseline has no approval transition/history table and no lineage column that
  could connect multiple `approval_request` rows.
- Order 025 permits no migration.

Updating the head row and appending `fact_log` would fit the baseline shape, but violates
Order 025's explicit no-mutation/P4 language. Inserting a new `approval_request` row for
each transition would invent identity and lineage semantics the schema cannot express.

## Architect decision required

Please decide and record both:

1. The exhaustive approval lifecycle. The schema suggests
   `pending -> approved | rejected | expired`, with all three terminal, but the builder
   will not infer that into the canonical state-machine document.
2. The authoritative persistence model:
   - mutable `approval_request` head plus append-only `fact_log` transition history,
     with Order 025 corrected accordingly; or
   - an architect-authorized new migration for an append-only approval transition
     table (and corresponding Order 025 scope/proofs); or
   - another explicitly specified model.

Please also clarify whether `approval.requested` and `approval.decided` outbox events
are required in Order 025. They exist in `docs/EVENTS.md`, but Order 025 requires only
the audit envelope and does not scope `src/kernel/outbox.ts`; silently omitting or adding
them would both be unsafe.

## Phase status

No Phase 1 implementation has started. The issue was found while reading all eight
orders and their authoritative schema/spec sections. D-92 says any invariant question
stops the phase immediately, so Orders 019–024 were not started after this discovery.

## Additional preflight findings — resolve in the same architect pass

The founder asked for safe work while the architect is unavailable, so I audited every
issued Phase 1 order against the executable baseline before touching code. The following
would each cause another D-92 stop if left until its order.

### A. Order 019 P1 and P3 cannot both execute as written

Required behaviour 2 and P1 say a resolver returning `null` must return 401 and acquire
**no database connection**. P3 then says request B uses a resolver returning `null`, is
forced onto the same pooled connection, and itself observes
`NULLIF(current_setting('app.tenant_id', true), '') IS NULL`.

An unauthorized request cannot both acquire no connection and execute that SQL. The
likely proof is: request B remains database-free, then a separate test-harness checkout
of the same one-connection pool observes the normalized NULL expression. Please amend P3
to name the intended observer; the builder will not weaken P1 or invent an exception.

### B. Order 020 mandates an unspecified `0002_identity.sql`

The baseline already contains `app_user.auth`, `role`, `role_permission`, and
`user_role`. Order 020 says `0002_identity.sql` is a new file through the runner, but
names no column, constraint, index, grant, or data change for it. Creating an empty
migration would be fake work; inventing identity schema would be an architect decision.

Please specify the exact SQL contract for `0002_identity.sql`, or amend the order to say
that no migration is required and remove the mandatory-new-file wording.

### C. Order 021 does not define the required `fact_log.business_date`

The audit envelope names actor, tenant, request id, timestamp, and operation, but the
baseline requires `fact_log.business_date NOT NULL`. Invariant 7 says business date must
derive from the property's timezone, while Order 021 supplies neither a property nor a
business-date source. Using server-local or UTC date is forbidden.

Please specify whether the helper requires a caller-supplied, already-derived
`businessDate`, requires `propertyNode` and derives it transactionally, or uses another
defined source. Also confirm that request id belongs in `payload`, operation in
`fact_type`, actor in `actor_id`, and timestamp in `recorded_at`; those are the available
baseline columns.

### D. Orders 022–023 require generic durable cursor/dedupe storage that is absent

The only baseline cursor is distribution-specific `push_cursor`:

- it requires `channel_code REFERENCES channel(code)`;
- it is keyed by `(property_node, channel_code)`;
- it has no consumer name or processed outbox id.

Using fake channel rows for kernel consumers would cross the distribution boundary and
would not represent the consumer registry in `docs/EVENTS.md`. Without a generic durable
consumer cursor, Order 022 P3 cannot resume per consumer and Order 023 cannot prove
crash-safe id-based dedupe after consumer commit but before `published_at` is updated.
Both orders forbid migrations.

Please authorize and specify a generic cursor/dedupe migration (including transaction and
locking semantics), or identify the exact existing storage model these orders intend.
Do not direct the builder to repurpose `push_cursor` unless the context-boundary decision
is explicitly changed.

### E. Order 024's type-isolation proof contradicts the global table

`extension_type` has primary key `type` and no `tenant_id`; only `extension` instances
are tenant-scoped. Therefore P3's requirement that tenant A cannot read or write tenant
B's **types** is not representable. Types are platform-global in the baseline. The docs
also call the schema column `content_schema`, while the executable baseline names it
`json_schema`.

Please choose one:

- retain global type definitions and amend P3 to prove tenant isolation only for
  instances, with a separately defined platform-authority rule for registering types; or
- authorize a schema change making types tenant-scoped and define how global launch
  types coexist.

Also reconcile `content_schema` versus `json_schema`; the builder currently treats the
executable baseline as authoritative.

### F. Order 026 P5 has no operation capable of creating a cycle

`org_node` stores a materialized `ltree path`; it has no parent edge. Order 026 scopes
hierarchy queries and fixture rows, but P5 requires "an attempt to create a cycle" to be
rejected. A plain ltree value cannot contain a graph cycle, and no create/move/reparent
API or guard is specified.

Please either define and scope the mutation whose cycle guard P5 exercises, or replace
P5 with the structural property that makes cycles unrepresentable. The builder will not
invent reparenting semantics inside a query order.

### G. Order 019 does not define the public-health boundary

Order 019 wires fail-closed middleware in `src/app.ts`, while Phase 0's container and CI
contract requires unauthenticated `GET /health` to remain exactly 200
`{"status":"ok"}`. Applying the resolver globally changes health to 401; exempting
health is sensible because it issues no database statement, but the order does not name
that boundary.

Please state explicitly that `/health` remains public and database-free, and that tenant
middleware wraps every database-capable route rather than every route indiscriminately.

### H. Order 024's API and production-seed deliverables are outside its scope

Order 024 and the Phase 1 DoD require runtime registration **via API**, but its Scope
does not include `src/app.ts` or another HTTP route file. It also says launch schemas and
instances are fixture data, while `BUILD-PLAN.md` requires them "as seed" and
`docs/EXTENSIONS.md` says they belong in the Phase 1 seed migration; neither
`scripts/seed.ts` nor a new fixture/seed module is scoped.

Please define the HTTP contract and add its route file to Scope. Also decide whether the
launch registry belongs in the production `db:seed` path or only in test fixtures. If it
belongs in production seed, scope the exact seed files and define idempotency/collision
behaviour rather than leaving the Phase 1 DoD satisfied only in a test database.

### I. Order 021 P5 is currently vacuous

P5 asks for a grep assertion that no `src/` module writes "the mutated tables" outside
the audit helper, but Order 021 names no domain mutation/table and, at that point in the
stack, no Phase 1 mutation module exists. A grep can pass because there is nothing to
inspect, not because unaudited writes are impossible. Later Orders 024 and 025 introduce
the first real mutations.

Please name the concrete write surface P5 must police, or move/repeat this proof at the
Phase 1 exit after all mutation modules exist. The helper can still prove same-transaction
commit/rollback in Order 021; the global no-bypass claim needs non-vacuous subjects.

## Non-mutating capability evidence already collected

These are preflight results, not a substitute for the required branch proofs:

```text
Bun 1.3.14 WebCrypto Ed25519 generate/sign/verify: true
Bun 1.3.14 WebCrypto ES256/P-256 generate/sign/verify: true
Bun.password argon2id: $argon2id$v=19, verification true
```

So Order 020's capability question is settled by execution on the builder environment:
Ed25519 is available, ES256 remains a working fallback, and the ordered HS256 choice does
not need to change. The architect must still re-execute the registered proof at review.

## Requested response shape

Please answer A–I plus the original approval questions, amend the affected orders/specs,
and append the corresponding decision(s) before telling Codex to resume. One consolidated
architect commit will avoid nine additional founder relay cycles and let the D-92 phase
cadence work as intended.
