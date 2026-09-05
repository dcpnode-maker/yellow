# Architecture V1

**Status:** Proposed architecture reconciled with the current repository; not an
implementation order.
**Precedence:** `PROJECT.md` → `DECISIONS.log` → executable schema/contracts → this
document → historical research/blueprints.

**Current-state pointer:** `docs/PROJECT-STATUS.md` owns the active task, source and
release lifecycle. This document preserves the architecture destination and does not
declare planned capability shipped.

## Architecture decision summary

Yellow remains a **TypeScript/Bun/Elysia modular monolith backed by PostgreSQL 16**.
The current kernel is retained. The product grows through vertical slices and strong
bounded-context surfaces, not a framework rewrite, early microservices, or UI-first
simulation.

The architectural center is:

```text
verified identity
      |
authorized application command
      |
one tenant-local PostgreSQL transaction
      |--- authoritative aggregate writes
      |--- append-only audit fact
      `--- transactional outbox event(s)
                  |
          idempotent consumers
          |--- projections/cache
          |--- integrations
          |--- notifications
          `--- analytics/automation
```

UI, API, mobile, integrations, automation, voice, and AI are adapters to this same
capability model.

## Quality priorities

In order:

1. tenant isolation and security;
2. physical inventory and financial correctness;
3. recoverability/auditability;
4. operational availability;
5. clear user recovery from exceptions;
6. performance;
7. cost efficiency;
8. extensibility;
9. implementation convenience.

Cost never overrides correctness, security, or durability.

## Current architecture preserved

- 13 canonical bounded contexts and a context-free kernel.
- PostgreSQL as the only authoritative datastore.
- Shared-schema RLS with transaction-local tenant context.
- Raw SQL through Bun on explicit reserved connections/transactions.
- Claim-range occupancy choke point.
- Integer money, balanced journals, property-local business dates.
- Fact log and transactional outbox.
- Context public indices and import-boundary enforcement.
- Forward-only migrations and immutable baseline.
- Tiny, permissively licensed dependency surface.
- Compose-first portable deployment.

## Logical layers

### 1. Experience adapters

Target surfaces:

- public booking/guest web;
- staff desktop workbench;
- staff mobile/housekeeping;
- tablet/kiosk modes;
- owner/partner portal;
- public/integration API;
- command palette and voice;
- AI agent control.

Responsibilities:

- presentation and device adaptation;
- accessible interaction;
- input collection and local validation;
- command/query invocation;
- optimistic UX only where compensation is safe;
- explicit pending/succeeded/failed/conflicted state.

They do not own business rules or receive direct database capabilities.

### 2. Transport and edge

Elysia HTTP adapters provide:

- versioned routing;
- authentication;
- request correlation;
- idempotency;
- input/schema validation;
- authorization/policy call;
- rate/request-size controls;
- consistent problem responses;
- streaming/SSE/WebSocket where justified.

Public booking, provider webhooks, staff API, and platform administration are separate
trust zones even if deployed in one process initially.

### 3. Application command/query layer

Each context exports only:

- `commands` — transactional intentions;
- `queries` — tenant-scoped reads;
- `events` — types it owns and emits.

A command handler owns orchestration and has narrow ports for repositories, audit,
events, approvals, clocks, provider requests, and policies. Repositories take the
established `Tx`. Cross-context mutation is not a direct repository call: it is either a
coordinated application command with explicit ownership or an outbox-driven effect.

A small typed command registry should eventually make commands discoverable to HTTP,
automation, and AI without building a second “AI API.” Do not add an abstract command bus
until the first two non-HTTP callers prove its required shape.

### 4. Domain layer

Pure types, value objects, state machines, policies, and invariant checks. It does not
know Elysia, provider SDKs, prompts, or UI.

Database constraints remain authoritative for races and invariants that only the database
can decide. Domain checks provide early, explainable errors but never replace constraints.

### 5. Infrastructure adapters

- Bun SQL repositories;
- PostgreSQL outbox bus/relay;
- Valkey projection cache if Phase 2 benchmarks justify it;
- PSP, OTA, messaging, fiscal, storage, identity, and market-data providers;
- scheduler/worker supervision;
- logs/metrics/traces.

Adapters normalize external representations into canonical commands and facts. They do
not leak provider enums or mutable SDK objects into domain aggregates.

## Write path

```text
Request / job / provider message / AI proposal
  -> authenticate identity or service
  -> resolve tenant/property and scopes
  -> validate command + idempotency
  -> BEGIN on one reserved PostgreSQL connection
  -> set_config('app.tenant_id', tenant, true)
  -> SET LOCAL ROLE app_role
  -> lock/version-check aggregate
  -> apply deterministic guards
  -> authoritative write(s)
  -> record fact + outbox events
  -> COMMIT
  -> return outcome
  -> external effects consume outbox after commit
```

Rules:

- critical external effects never happen before the local commit;
- external success followed by local failure requires reconciliation/compensation design;
- retries return the original outcome for the same idempotency key and reject changed
  payloads;
- API command idempotency borrows the business transaction: the hashed key claim,
  mutation, facts/events, and stored successful JSON outcome commit or roll back
  together. Records are tenant+operation scoped, retain no raw key, and expire after
  24 hours; concurrent exact requests serialize on the record.
- all error responses identify whether anything committed and what the user can do next.

## Read path and operational zoom

Queries compose role-appropriate views over authoritative tables and rebuildable
projections.

The conceptual zoom is:

`portfolio -> property -> domain -> entity -> transaction -> event/audit`

Deep links preserve property, entity, date, and work context. PEEK, DRAWER, and WORKBENCH
are experience tiers, not separate data models.

Operational home surfaces answer:

- what is happening;
- what needs attention;
- why;
- likely next state;
- available authorized action;
- what the last action changed.

## Data architecture

### PostgreSQL

One primary operational store initially. Use:

- constraints and explicit SQL for integrity;
- RLS and security-invoker views;
- effective/bitemporal rows where history matters;
- append-only financial/occupancy/config facts;
- GIN only for `@>` JSONB access or promote to a typed column;
- BRIN for suitable append/time series;
- GiST for intervals and `ltree`;
- server-side functions only for true atomic choke points.

Do not introduce a graph database because the conceptual model is a graph. Relational
foreign keys, `ltree`, indexes, and explicit relationship tables are adequate until
measured access patterns prove otherwise.

### Projections and cache

Availability, operational boards, metrics, search documents, and notification aggregates
are rebuildable. Projection state carries:

- source/cursor watermark;
- calculated/version time;
- completeness/error status;
- rebuild and reconciliation path.

Valkey is never authoritative. Keep it only if the Phase 2 A/B performance proof shows
material value against simpler PostgreSQL/NATS-KV alternatives already recorded.

### Files/documents

Future documents/photos/import files use an object-storage port with content hash,
tenant/property ownership, classification, retention, malware scanning, and immutable
references where required. Bun S3 is the preferred client when the first consumer lands.

### Analytics

Keep operational analytics in PostgreSQL projections first. Add DuckDB/columnar export or
ClickHouse only when measured workloads exceed PostgreSQL budgets and a failure/cost
analysis exists. Reporting never queries another tenant or bypasses source reconciliation.

## Events and asynchronous work

The current PostgreSQL outbox bus stays behind `EventBus`.

- Publishers serialize sequence allocation for durable cursor ordering.
- Consumers have a durable cursor and processed-event idempotency marker.
- Same-name consumers serialize; different names receive all events.
- Consumer effect, dedupe marker, and cursor commit together.
- Relay acknowledgement happens only after consumer commit.
- Failed external effects retry with backoff and eventually become operator-visible.

NATS JetStream remains deferred until an out-of-process consumer or second application
node makes it useful. If introduced, PostgreSQL outbox remains the commit boundary and
JetStream is delivery infrastructure, not new truth.

Each worker needs:

- name/version;
- lease/supervision;
- bounded batch;
- retry/backoff/jitter;
- dead-letter/replay or explicit terminal classification;
- lag/last-success/error metrics;
- correlation/causation;
- shutdown/crash proof.

## Identity and authorization architecture

### Authentication

Current local Argon2id and JWT primitives are useful. Before public/staff deployment add:

- audited login and credential change;
- refresh/session/revocation strategy;
- signing key rotation and `kid` strategy through an ADR;
- MFA/passkey decision;
- secure recovery;
- service/API-client credentials;
- session inventory and forced logout;
- secret injection and startup validation.

### Authorization

Target model:

`RBAC + tenant/org/property scope + policy conditions + separation of duties`

A verified token selects identity/tenant and coarse scopes. The command loads current
grants/conditions for consequential operations. Housekeeping cannot see payment data;
revenue users act only for assigned properties; requester cannot approve their own
protected action; AI has both agent and sponsoring-user/tenant policy limits.

Never trust actor, tenant, property grant, price authority, or approval from request body.

### Platform administration

Global extension types and future platform operations need a separate narrow capability.
Do not expose the deployment pool as a general repository. Every platform query has an
explicit global/tenant visibility predicate and audit subject. Long term, separate
database roles/connections for migration, platform administration, and tenant runtime.

## Security architecture

Threat boundaries:

- public booking/browser;
- staff browser/PWA;
- owner/partner portal;
- provider webhooks;
- background workers;
- AI providers/tools;
- platform administration;
- database deployment/runtime roles;
- uploaded files and documents.

Standing controls:

- deny by default;
- transaction-local tenant context and RLS;
- parameterized SQL;
- strict schemas and size limits;
- CSRF protection for cookie-authenticated surfaces;
- origin/CORS policy;
- CSP and secure headers;
- rate limiting and bot/card-testing defenses;
- idempotent signed webhooks with replay windows;
- hosted PSP collection; no PAN;
- secret manager/environment injection;
- dependency pin/licence/audit gates;
- structured security/audit logs;
- privacy classification and retention;
- encrypted transport and appropriate at-rest encryption;
- restore-tested backups.

A dedicated threat model is required before public booking/payment or provider webhooks.

## Privacy and data governance

Every sensitive field should declare:

- purpose and legal basis/policy;
- owning context;
- tenant/property;
- classification;
- who can read/write;
- retention and legal hold;
- export/anonymization behavior;
- AI eligibility/redaction;
- access logging requirement;
- residency/provider restriction.

Identity documents and payment tokens must never appear in generic event payloads,
analytics exports, or AI context.

## API and integration architecture

Canonical API direction remains `/api/v1` with:

- idempotency keys for mutation;
- cursor pagination;
- stable problem types;
- correlation IDs;
- versioned additive schemas;
- explicit deprecation;
- tenant/service scopes;
- OpenAPI and contract tests.

Provider adapters implement ports, store raw message metadata safely, normalize into
canonical commands, and persist mappings/receipts/reconciliation. Incoming confirmations
may create operational incidents rather than being “rejected” when an external channel
already promised the guest.

Integrations require health, last-success, lag, rate-limit, credential-expiry, retry, and
replay visibility.

## UI architecture

Do not select or restructure around a frontend framework until the first production UI
order. Requirements that selection must satisfy:

- desktop high-density grids and keyboard throughput;
- phone task/context-first experience;
- tablet/touch adaptation;
- deep links and browser-history continuity;
- accessible semantic virtualized grids;
- offline queue for explicitly eligible commands;
- live updates without focus theft;
- locale/RTL/timezone/currency;
- small bundles and incremental rendering;
- one domain/API model across role-shaped surfaces.

PEEK/DRAWER/WORKBENCH/COMMAND/BIG-PICTURE from the existing UI spec and PR #18 are
retained as product language. PR #18's prototype order should not be merged or executed
unchanged: it has a stale Phase 0 base/order number and would create a broad UI mock
before the current constitution assessment and Phase 1 review.

## Offline and degraded operation

Classify commands:

1. **Read cache allowed:** arrivals, assignments, task lists, property knowledge.
2. **Queued low-risk write:** task progress, notes, condition observations, subject to
   version/conflict rules.
3. **Pre-leased authoritative capacity:** offline walk-in may consume only a valid lease.
4. **Online required:** unrestricted occupancy, payment capture state, financial posting,
   document numbering/fiscal submission, high-risk approvals.

An offline client stores command envelopes and local status, not an independent database
of truth. Sync re-authenticates, revalidates, uses idempotency, and returns
applied/rejected/conflicted/expired outcomes. Never use “last write wins” for hospitality
or financial state.

## AI architecture

### Boundary

`AI proposes structured commands; deterministic services authorize and execute them.`

Components when justified:

- provider-independent model router;
- task classifier and structured-output validator;
- context assembler with tenant ACL and PII minimization;
- property knowledge retrieval with source/version;
- agent registry, scopes, budgets, autonomy policy;
- recommendation/evidence/outcome store;
- approval integration;
- tool gateway exposing only command/query capabilities;
- prompt/model/evaluation versioning;
- cost/latency/quality/privacy telemetry.

### Autonomy

Levels 0–4 from the constitution are tenant-configured per agent/capability. Level never
overrides ordinary permissions, deterministic guards, approval thresholds, budgets, or
current-state revalidation.

### Failure

Provider outage, invalid output, prompt injection, high latency, cost exhaustion, or
uncertain evidence degrades to deterministic/manual operation. No core path blocks on AI.

Do not add a vector database until measured retrieval requirements exceed PostgreSQL
full-text/trigram/object metadata or another simple solution.

## Observability and operations

Every request/job/event/provider call should carry correlation and, where relevant,
causation. Emit structured logs without secrets/PII. Core telemetry:

- HTTP request/command latency and outcome;
- SQL latency/query count/pool saturation;
- occupancy conflicts and hold expiry;
- outbox lag/consumer cursor/retry/dead-letter;
- provider health/rate limit/reconciliation;
- payment/fiscal pending mismatch;
- business-day readiness/backlog;
- projection watermark/rebuild;
- AI latency/cost/failure/approval/outcome.

Define SLOs only with measurement. Initial engineering budgets from existing docs remain
objectives, not marketing claims.

## Deployment topology

### Development/CI now

```text
Bun app
PostgreSQL 16 (authoritative, pg_stat_statements)
Valkey (idle until Phase 2 use)
Compose tools: migration + seed
GitHub Actions: quality + container + database + Windows state
```

### First production topology

Prefer one modular-monolith app plus supervised worker processes against one PostgreSQL
primary, behind standard TLS ingress. Add PgBouncer only with tested transaction pooling.
Backups go to at least two S3-compatible targets with routine restore drills. Caches and
workers are disposable/rebuildable.

Do not introduce Kubernetes or microservices. Add nodes/services only after a named
scale/failure threshold and ADR.

## Performance and cost budgets

Measure p50/p95/p99, query count, payload, CPU, memory, storage growth, network/egress,
and cost per reservation/property/AI action.

First critical benchmarks:

1. occupancy commit races;
2. availability search on 500+ spaces;
3. outbox publish/consume under realistic event bursts;
4. tape/operational grid rendering at large-property scale;
5. reservation commit with audit/events;
6. posting/journal concurrency;
7. provider burst/reconciliation;
8. AI command preparation cost/latency, never core execution.

A cache, broker, search engine, analytics store, or service is admitted only when the
measured problem, scale threshold, failure mode, operating cost, and simpler alternative
are documented.

## Alternatives considered

| Decision | Chosen | Alternatives rejected/deferred | Reason |
|---|---|---|---|
| Application shape | Modular monolith | Early microservices | Fewer distributed failures; existing boundaries permit later extraction |
| Transaction store | PostgreSQL | Document/graph DB as core | Constraints, RLS, transactions, ranges, mature operations |
| Data access | Explicit Bun SQL | ORM/lazy loading | Predictable SQL/invariants and minimal dependencies |
| Event delivery now | PostgreSQL outbox bus | Direct fire-and-forget, LISTEN as authority, Kafka, immediate NATS | Atomicity, replay, low operational cost |
| Cache | Benchmark-gated Valkey | Cache as authority | Correctness remains in PostgreSQL |
| Frontend | Decision deferred | Premature framework rewrite | No production UI slice yet; requirements first |
| API shape | Shared domain commands | UI-specific or AI-specific mutations | One rule/audit path |
| AI | Provider-independent orchestration | Chatbot with DB/tool bypass | Deterministic state and graceful degradation |
| Graph | Relational explicit relationships | Graph database | No measured graph workload needing it |
| Analytics | PostgreSQL projections first | Immediate ClickHouse/warehouse | Simpler and cheaper until measured |
| Deployment | Compose/portable containers | Kubernetes/cloud-specific services | Two-person operations and cost doctrine |
| Payments | Hosted PSP/token port | PAN handling/direct-post forms | PCI scope and security |
| UAE fiscal | Accredited-provider port | Self-accreditation assumption | Official provider model and repository decision |

## ADR backlog

Create an ADR immediately before the relevant order, not speculatively:

1. production composition root/config/secrets;
2. session refresh/revocation/signing-key rotation;
3. API idempotency storage/retention;
4. property/department policy authorization;
5. quote persistence and hold guarantee;
6. Phase 2 projection/cache result;
7. frontend/router/state/offline foundation;
8. scheduler/worker supervision;
9. owner/asset context and accounting;
10. AI provider/tool/policy boundary;
11. object storage/document security;
12. initial jurisdiction/provider adapters.

Each ADR records problem, constraints, options, decision, cost, failure modes, migration,
and reversibility.

## Architecture fitness functions

Keep architecture executable through:

- invariant referee = 11/11;
- schema drift = empty;
- import boundaries = zero violations;
- direct occupancy DML denied;
- all public views security-invoker;
- cross-tenant behavioral fixtures;
- insert-only mutation denial;
- event atomicity/replay/crash tests;
- authorization negative tests;
- migration checksum/rollback tests;
- dependency licence/audit gates;
- per-slice performance/failure proof;
- journey tests as real commands emerge.

Documentation alone is never a fitness function.

## First proposed implementation slice

No implementation starts until Phase 1 receives independent exit review and lands on
`main`.

After that gate, the first slice should be **Property Inventory to Authoritative Hold**:

- create/read unit types, spaces, and sellable units through tenant-scoped commands;
- expose availability from PostgreSQL truth for a small property;
- place/release/expire a hold only through the occupancy choke point;
- emit/audit existing inventory/hold events atomically;
- show one minimal staff-facing/API journey with honest conflict/readiness outcomes;
- re-run concurrency, RLS, direct-DML denial, projection parity, and latency proofs.

It is deliberately narrower than a reservation UI and broad enough to validate that the
Phase 1 kernel can carry real hospitality behavior. Exact scope, schema impact, event
catalogue, and proofs belong in the independently reviewed Phase 2 plan/order.
