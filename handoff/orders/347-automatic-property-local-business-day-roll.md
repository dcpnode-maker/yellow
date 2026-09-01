# Order 347 — Automatic property-local business-day roll

**Status:** READY-D982
**Phase:** 5 — Financials
**Branch:** `phase-5/automatic-property-local-business-day-roll`
**Base:** `282fd22` (D981 independently approved Orders346/344)
**Risk tier:** 3 — tenant-scoped financial date creation, runtime authority and scheduler
**Owner:** Codex implementation; fresh independent non-implementing Tier-3 reviewer

## Outcome

Open exactly one current `business_day` for each due property after PostgreSQL's
transaction-stable calendar date advances in that property's stored timezone. A
bounded, opt-in runtime worker discovers only due tenant/property scopes and invokes
one tenant-scoped financial command. The winning transaction inserts the day and
writes one `business_day.opened` fact/outbox pair atomically; reruns and concurrent
workers are no-ops after that single effect.

This is the automatic **roll**, not the asynchronous financial **seal**. An older
unsealed day is valid close-backlog truth and never blocks the current day from
opening.

## Ratified policy and natural solution

The August continuous-close decision, Invariant 7 and the canonical business-day
state machine already require automatic roll at the property-local day boundary while
seal remains independent. The smallest natural implementation reuses:

- `business_day`'s existing `(property_node,business_date)` primary key and
  tenant/property/date uniqueness as the contention arbiter;
- PostgreSQL `transaction_timestamp()` plus the exact stored `org_node.timezone` as
  the sole date authority;
- the existing tenant transaction, audit fact and transactional outbox primitives;
- the established bounded runtime-only discovery and abortable worker composition
  used by the arrival and departure rolls.

Do not add a mutable current-day pointer, scheduler ledger, clock table, advisory
repair flag, new event or browser/API command. Within the tenant transaction, the
service derives the current property-local date, attempts an insert with the existing
unique constraints as arbiter, and only the transaction that inserted the row records
the fact and emits the event. An event/fact failure rolls the insert back so a later
cycle can retry cleanly. Finding the row already present is a deterministic no-op,
not a synthetic replay event or history repair.

The canonical emitted event is the already registered `business_day.opened` in
`docs/EVENTS.md`. The older `day.rolled` wording in the business-day paragraph of
`docs/STATE-MACHINES.md` is documentation drift; replace only that wording with
`business_day.opened` in this implementation. No alias or second event is admitted.

## Exact product contract

`BusinessDayRollService.openCurrentBusinessDay(tx,input)` accepts only an exact
tenant id, property id and server-created audit envelope. It accepts no date, instant,
timezone, cutoff, status, force, seal or catch-up input. It:

1. runs inside the transaction-local tenant context;
2. resolves one active tenant and exact same-tenant `org_node(kind='property')`;
3. validates the stored timezone through PostgreSQL and derives
   `(transaction_timestamp() AT TIME ZONE property.timezone)::date`;
4. inserts only that exact date if absent;
5. on the winning insert, writes one minimized fact and one
   `business_day.opened` outbox event in the same transaction; and
6. returns an immutable result identifying tenant, property, derived business date
   and whether this transaction opened it.

The event payload is identifier/state evidence only:
`{property_node,business_date,opened_at}`. `opened_at` is the database-authored row instant;
it is not caller data. Actor, request, correlation and causation follow the existing
server-worker audit conventions. Consumers may wake current-day work, but may not
infer that any older day was sealed, ready, reconciled or carried forward.

`runtime_due_business_day_scopes(limit)` is a fixed-search-path, stable,
owner-mediated read capability executable only by `yellow_runtime`. It returns a
bounded, deterministic list of active-tenant property scopes for which the exact
PostgreSQL-derived local calendar date has no `business_day`. It returns no dates,
financial rows, backlog details or mutable authority. `PUBLIC` and `app_role` cannot
execute it; `yellow_runtime` retains no direct table read or write privilege.

`BusinessDayRollWorker` polls that source in bounded batches and invokes the service
once per scope. It is disabled unless explicitly configured, supports deterministic
one-cycle execution, isolates and reports a failed scope without losing successful
scopes, observes abort promptly and does not overlap its own cycles. The server creates
no discovery pool on the disabled/health-only path; health-only startup remains
database-free.

## Migration and exact catalogue allocation

- next migration: `0061_runtime_due_business_day_scopes.sql`;
- it adds exactly one read-only runtime discovery function and no table, policy, view,
  event, trigger or write capability;
- expected after build: 61 migrations, 111 public base tables, 101 tenant RLS
  tables/policies, 10 FORCE-RLS tables and 2 views;
- update the exact migration, runtime-capability, SECURITY-DEFINER containment and
  schema-snapshot oracles for this one function without weakening equality;
- re-run allocation against the exact approved Order346/344 frontier before the
  intentional red. If migration0061 or any catalogue total is no longer exact, stop
  and amend this order rather than colliding or guessing.

## Exact scope

- `migrations/0061_runtime_due_business_day_scopes.sql`;
- `src/contexts/financials/business-day-roll.ts` and
  `src/contexts/financials/index.ts`;
- `src/workers/postgres-due-business-day-scopes.ts` and `src/server.ts`;
- `src/project-status.ts`, the existing founder-status response and their tests only
  for the exact `businessDayRollWorkerEnabled` configured/disabled truth already
  exposed for sibling workers;
- focused intentional-red, domain, fresh-PostgreSQL integration, worker/source and
  server-wiring tests for this order;
- directly affected migration/database-acceptance/runtime-database-authority/
  runtime-DML/SECURITY-DEFINER containment tests, `tests/schema/expected.sql` and
  `setup.sh` only for exact migration/capability/catalogue assertions;
- business-day-roll-only sections of `docs/CONTRACTS.md`, `docs/EVENTS.md`,
  `docs/STATE-MACHINES.md`, `docs/DOMAIN-MODEL-V1.md`, `docs/SECURITY.md`,
  `BUILD-PLAN.md`, `handoff/PHASE-5-PLAN.md` and `handoff/ROADMAP.md`;
- this order, `handoff/reviews/347-automatic-property-local-business-day-roll.md`,
  `DECISIONS.log` and `handoff/LEDGER.md`.

`migrations/0001_init.sql` remains immutable. Any apparently required file outside
this list requires a separately recorded scope question or pre-commit amendment.

## Hostile executable proof

### P0 — intentional red

Before production work, prove the business-day service, runtime source, worker/server
wiring and production `business_day.opened` emission are absent. Preserve the red
result in governance evidence.

### P1 — exact PostgreSQL property-local date

On fresh PostgreSQL, create active properties in UTC, Asia/Kolkata, America/Toronto
and a DST-observing IANA zone. For each, independently query PostgreSQL's transaction
instant conversion and prove the command opens exactly the matching local calendar
date. Exercise zones lying on opposite sides of midnight at the same database instant
and a PostgreSQL DST-boundary conversion oracle. Invalid/missing timezone, inactive
tenant, missing/foreign/non-property node and tenant-context mismatch fail closed.
No test-only or production path may pass a date/instant/timezone into the command.

### P2 — roll is independent of seal and backlog

An older open/unsealed `business_day`, an older sealed day and multiple older
unsealed days each permit today's row to open exactly once. Today's existing open or
sealed row is a no-op. The command never reads readiness queues as authority and
never updates/seals/reopens/deletes any day. It opens only today: it creates neither
missed historical dates nor tomorrow.

### P3 — atomic evidence and rollback

The winning insert creates exactly one row, one minimized
`business_day.opened` fact and one outbox row with database-authored date/instant and
correct tenant/property/actor/correlation bindings. Inject failure after the insert,
at fact creation and at event publication; each attempt leaves no day/fact/outbox
artifact, and an exact retry succeeds once. No dual write or post-commit publication
is accepted.

### P4 — contention, rerun and tenant isolation

Twenty concurrent contenders for the same due property converge to one day and one
fact/outbox effect without an unhandled unique violation. Exact rerun is a no-op.
Concurrent different-property and different-tenant scopes each produce their own one
effect. Hostile tenant/property combinations cannot observe, suppress or create the
other tenant's day. Existing older rows cannot become the contention key for today.

### P5 — runtime least authority

Fresh migration1–61 proof requires the exact unchanged `111/101/10/2` catalogue,
tenant-leading business-day constraints/RLS and one new bounded function. Prove
limit `NULL`, zero, negative and over-maximum reject; deterministic bounded ordering
and exact due/not-due discovery; `PUBLIC`/`app_role` denial; `yellow_runtime` execute-
only access; fixed search path and hostile `pg_temp` resistance; no direct runtime
read/write on tenant, property, business day, fact or outbox tables.

### P6 — scheduler lifecycle and failure behavior

Prove enabled/disabled and health-only server composition, bounded source and scope
batches, one deterministic cycle, no overlapping cycle, per-scope failure isolation,
error/result callbacks, bounded retry-by-next-poll, prompt abort during polling/work
and clean stop. Invalid worker options fail fast. A stopped or aborted worker performs
no later write; an error does not spin or terminate the server silently.

### P7 — permanent and independent gates

Run focused business-day and existing financial posting/seal regressions, exact
migration/schema/database-acceptance/runtime-authority/SECURITY-DEFINER gates,
typecheck, boundaries, licences, audit, full standing suite and fresh
`./setup.sh --db-only` referee `11/11`. A fresh independent non-implementing Tier-3
reviewer personally executes the timezone/DST, backlog/seal independence, tenant,
contention, rollback, runtime authority and scheduler-stop/error proof on the exact
candidate and records commands/results before approval.

## Forbidden

- business-day seal, readiness checklist, discrepancy carry-forward, approval,
  cashier close, queue drain, reconciliation, close-backlog UI or alert policy;
- historical catch-up/backfill, tomorrow pre-open, mutable current-day pointer,
  forced reopen, repair inference or update/delete of any `business_day`;
- caller, browser, HTTP header/body/query, JavaScript date, process/server local clock,
  environment timezone or worker-discovered date as financial authority;
- new HTTP/API/operator/UI command, permission, table, event, dependency, external
  scheduler, generic scheduling framework or local-data mutation;
- journal/posting/payment/trust/AR/tax/fiscal/document/reservation/occupancy/task or
  housekeeping behavior;
- migration before0061, `migrations/0001_init.sql`, `.yellow`, credentials, Docker,
  port3000, stable Order335, local promotion, merge, push, public deployment or
  Phase/application completion claim.

## Definition of done

- [ ] Exact approved Order346/344 frontier and migration0061 allocation are recorded.
- [ ] Intentional red precedes all production implementation.
- [ ] Current-day opening is PostgreSQL/property-timezone authoritative, tenant-bound,
  backlog-independent, contention-safe and atomically evidenced.
- [ ] Runtime discovery and worker lifecycle remain bounded, opt-in and least-authority.
- [ ] Permanent standing/schema/referee gates are green without weakening.
- [ ] Fresh independent non-implementing Tier-3 approval is recorded.
