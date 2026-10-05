# Repository Assessment

**Assessment date:** 2026-08-21
**Evidence baseline:** `phase-1/constitution-assessment` at `d10ca75` plus the uncommitted
Order 027 documentation work
**Authority:** [PROJECT.md](../../PROJECT.md) remains technical governance;
[YELLOW-CONSTITUTION.md](../YELLOW-CONSTITUTION.md) defines the product destination.

## Executive assessment

Yellow is a carefully constrained **kernel and schema foundation**, not yet an operating
PMS or Hospitality Operating System. The repository has unusually strong early controls:
a PostgreSQL-arbitrated occupancy model, RLS-backed shared-schema tenancy, immutable
financial primitives, an executable 11-case invariant referee, deterministic migration
and seed tooling, and a tested Phase 1 application kernel.

The most important truth is the distinction between four layers:

| Layer | Current state |
|---|---|
| Product destination | Broad and explicit in the Yellow constitution |
| Schema foundation | 83 physical public tables and 2 security-invoker views |
| Executable application behavior | Health, tenant transactions, JWT primitives, audit facts, outbox/relay, extension registry, approvals, org hierarchy |
| Independently reviewed and merged | Phase 0 on `main`; Orders 019–026 are implemented on a linear Phase 1 stack but await exit review and integration |

Most hospitality contexts have baseline tables but empty TypeScript public indices.
There is no production reservation, rate, availability, stay, housekeeping, folio,
payment, distribution, reporting, owner, UI, AI, or automation workflow. Calling these
features implemented would violate the constitution's “do not fake functionality” rule.

## Archaeology method and provenance

This assessment was built from:

- all tracked source and runtime configuration;
- `PROJECT.md`, `BUILD-PLAN.md`, `DECISIONS.log`, handoff orders/questions/reviews,
  and the canonical contracts, events, state machines, extension, security, and UI docs;
- both migrations and the live `yellow_test` PostgreSQL catalog;
- test names and executable checks, not directory names;
- a real local process probe;
- the open GitHub pull-request list and branch ancestry;
- existing research documents and the unreviewed PR #18 blueprint.

The local runtime probe on 2026-08-21 produced:

```text
GET http://127.0.0.1:3199/health       -> 200 {"status":"ok"}
GET http://127.0.0.1:3199/api/extensions -> 404 NOT_FOUND
```

This is expected: `src/server.ts` starts the default app without a database,
tenant resolver, or extension registry. Extension endpoints exist in the app factory
and pass integration tests when dependencies are injected, but are not wired into the
production entry point.

## Current stack

| Concern | Current choice | Evidence |
|---|---|---|
| Language/runtime | TypeScript strict on Bun 1.3.14 | `package.json`, `tsconfig.json`, Dockerfile |
| HTTP | Elysia 1.4.x | `src/app.ts` |
| Operational store | PostgreSQL 16.15 | pinned Compose image |
| Cache | Valkey 8 container, not yet used by app code | `docker-compose.yml` |
| Architecture | Modular monolith; 13 bounded contexts plus context-free kernel | `PROJECT.md`, import-boundary test |
| SQL access | Bun SQL, explicit transactions, no ORM | `src/kernel/db.ts`, scripts |
| Events | PostgreSQL transactional outbox with per-consumer cursor/dedupe | `src/kernel/outbox.ts` |
| Authentication primitives | Argon2id password helpers; exact-claim HS256 JWT | identity context |
| Testing | Bun unit/integration tests + Python PostgreSQL invariant referee | `tests/` |
| Delivery | Docker/Compose and GitHub Actions | Dockerfile, Compose, CI |
| Frontend | None; static HTML mockups only | `docs/mockups/`, `docs/UI-SPEC.md` |
| Mobile/PWA | None | planned in BUILD-PLAN Phase 10 |
| AI | None | product/architecture documentation only |

The dependency surface is deliberately small: Elysia at runtime, TypeScript and Bun
types for development, and a pinned Python PostgreSQL driver for CI/referee execution.

## Directory map

| Path | Purpose | Assessment |
|---|---|---|
| `src/kernel/` | tenancy, DB transactions, audit, events, relay, extensions, approvals | Substantive Phase 1 code |
| `src/contexts/identity/` | passwords, JWT, bearer resolution, org hierarchy | Substantive but no login/user-management HTTP workflow |
| `src/contexts/*/index.ts` | 12 remaining context public surfaces | Empty boundary placeholders |
| `src/http/` | security headers and extension HTTP adapter | Partial API |
| `scripts/` | migration, seed, schema drift, licence and boundary checks | Mature Phase 0 tooling |
| `migrations/` | immutable 80-table baseline + two kernel delivery tables | Strong schema foundation |
| `tests/` | unit/integration, schema fixtures, invariant referee | Strong kernel/platform coverage |
| `docs/` | contracts, UI, security, events, research, architecture | Rich but contains stale promises and multiple generations |
| `handoff/` | orders, questions, reviews, ledger, roadmap | Durable multi-agent work record |
| `prototype/` | Python occupancy stress prototype and results | Valuable proof artifact, not runtime |
| `.github/workflows/` | Windows state, quality, container, DB gates | Mature Phase 0 CI |

## Database and schema

### Live catalog

The live `yellow_test` catalog reported:

- 83 physical public tables;
- 2 public views;
- 73 RLS-enabled tables;
- 73 public RLS policies;
- 129 indexes;
- required extensions: `btree_gist`, `pgcrypto`, `ltree`, `pg_trgm`.

The 83 physical tables are the immutable 80-table baseline, `schema_migration`, and the
two Phase 1 consumer tables. Information Schema reports 85 relations when the two views
are included.

### Strong schema decisions worth preserving

- Claim-range occupancy with a GiST exclusion constraint and two authorized functions.
- RLS on tenant records and `security_invoker=true` on both views.
- Tenant-leading composite keys/indexes.
- Insert-only facts, outbox, documents, occupancy, journals, and posting lines.
- Balanced journals through a deferred constraint trigger.
- Property-local business dates and sealed-day enforcement.
- Money as integer minor units plus currency.
- Token-only payment instruments.
- Organization hierarchy via `ltree`.
- Global extension types and tenant-scoped extension instances.
- Account-owned folios, not reservation-owned folios.
- Canonical channel/inbound/push-cursor and fiscal/statutory adapter storage boundaries.

### What schema presence does not prove

The baseline intentionally anticipates later phases. A table does not provide its
commands, authorization, transactions, error semantics, events, UI, integrations, or
failure recovery. For example, `reservation`, `journal`, `payment`, `channel`, and
`stats_daily` exist, but there are no production application services for them.

### Schema risks to carry forward

- The broad baseline front-loads many assumptions before application feedback.
  Migrations must remain additive and evidence-led.
- Generic JSONB enables extension but can hide hot predicates. The existing rule to
  promote hot data to typed columns is essential.
- Several mutable head tables rely on future application transition guards.
- Platform tables that intentionally bypass tenant RLS require narrower capabilities and
  repeated behavioral isolation tests.
- A global advisory lock serializes outbox sequence allocation. It protects ordering but
  needs measured throughput before the event volume grows.

## Implemented application capabilities

### Health and HTTP safety

`GET /health` is public, database-free, and exact. Security headers are applied to
success, not-found, wrong-method, and error paths. CSP contains no third-party or
executable source.

Limit: the server entry point exposes only health. There is no environment-validated
composition root for database/auth/API services.

### Tenant transaction boundary

`TenantContextMiddleware` resolves identity before acquiring a connection.
`Database.withTenantTransaction` reserves one backend, begins a transaction, sets
`app.tenant_id` transaction-locally, assumes `app_role`, commits or rolls back, and
releases the reservation. Tests cover rejected identities, backend reuse, interleaving,
rollbacks, RLS behavior, and health bypass.

This is foundational and high-value. It is not a complete authorization system.

### Identity and authentication primitives

- Argon2id hashing and verification using Bun.
- Strict JWT issue/verify with an exact v1 claim set, 15-minute TTL, 60-second skew,
  UUID JTI, tenant and scope claims.
- Bearer-to-tenant resolver.
- Scope grammar constrained to canonical contexts.
- Tenant-safe org hierarchy queries and a structural GiST operator proof.

Missing: login, refresh/session lifecycle, key rotation/KID, revocation, MFA/passkeys,
user/role administration, API clients, account recovery, security-event handling, and
HTTP authorization for most future commands.

### Audit fact log

`recordFact` derives business date from the audited property timezone, inserts facts
inside the caller transaction, carries actor/request/operation data, supports
supersession, and is protected from application UPDATE/DELETE.

Limit: it is a primitive used by only the Phase 1 mutations, not proof that all baseline
entities are audited.

### Event bus and relay

- Same-transaction outbox publication.
- Serialized sequence allocation to prevent commit-order gaps.
- Per-consumer row lock, durable cursor, and processed-event marker.
- Different consumers receive the complete stream.
- Same-consumer workers serialize.
- Crash after consumer commit but before publication acknowledgement is deduplicated.
- Bounded polling and pruning.

Limit: the relay is a class, not a deployed worker. No NATS integration exists (by
decision), no dead-letter/operator UI exists, and no domain consumer is wired at startup.

### Extension registry

- Runtime type registration under a platform scope.
- A deliberately bounded JSON-Schema subset.
- Tenant-scoped instance creation, validation, listing, and audit.
- Compatibility checks for proposed schemas.
- Six launch types and thirty launch instances in deterministic seed data.
- API adapter tests for authority and isolation.

Limits:

- the default server does not wire the endpoints;
- paths are `/api/...` rather than the documented `/api/v1/...`;
- there is create/list but no complete lifecycle/activation/version HTTP contract;
- the platform read path uses deploy authority plus an explicit predicate, a known
  high-risk boundary that must remain heavily tested;
- the validator is not a complete standards-compliant JSON Schema implementation.

### Approval primitive

Pending approvals can transition once to approved, rejected, or expired. Human decisions
forbid self-approval. Fact and event evidence commit with the mutable head. Concurrent
decisions yield one winner.

Limit: no HTTP API, policy evaluation, expiry scheduler, notifications, delegation, or
domain integration exists.

## Partial or foundation-only capabilities

| Area | Evidence | Honest status |
|---|---|---|
| Organization/property | `tenant`/`org_node` schema, demo seed, hierarchy queries | Partial |
| Inventory/occupancy | Full schema, functions, stress prototype/referee | Foundation exists; no TS commands/API |
| Rates/policies | Tables, current-rate view, contracts/extensions | Foundation exists |
| Reservations | Tables, state-machine and API contracts | Foundation exists |
| Guest/CRM | Party/contact/consent tables | Foundation exists |
| Stay/front desk | Segment, folio linkage, travel/vehicle tables | Foundation exists |
| Housekeeping | Unit condition/task-sheet/discrepancy tables | Foundation exists |
| Finance | Strong ledger schema and invariant tests | Foundation exists; no posting service |
| Payments | Token-only schema and provider port documentation | Foundation exists |
| Groups/events | Group/block/allotment tables and contracts | Foundation exists |
| Distribution | Channel/map/inbound/push-cursor tables | Foundation exists |
| Tax/fiscal/statutory | Tables, extension schemas, planned adapters | Foundation exists |
| Reporting | `stats_daily` table and documented metrics | Foundation exists |
| Automation | Table, seeded action schemas | Foundation exists |
| Task/workflow | Generic task table | Foundation exists |
| UI/PWA | UI specification and static mockups | Design only |
| AI/agents | Constitution and blueprint | Design only |
| Owner/STR accounting | Profile/config hints only | Missing domain behavior |

## UI routes

Runtime routes discovered from source:

| Method | Route | Runtime status |
|---|---|---|
| GET | `/health` | Wired and tested |
| POST | `/api/extension-types` | Factory-only; requires injected registry |
| POST | `/api/extensions` | Factory-only; requires injected registry |
| GET | `/api/extensions` | Factory-only; requires injected registry |

No web application routes exist. Paths in `docs/UI-SPEC.md` such as
`/p/{property}/res/{id}` are contracts for later implementation, not present routes.
The HTML mockups are documents, not a production client.

## API conformance gaps

`docs/CONTRACTS.md` requires `/api/v1`, idempotency keys on mutating POSTs,
problem-detail errors, pagination, and response correlation IDs. The extension endpoints
currently use `/api`, ad-hoc response bodies, no idempotency store, and request correlation
only inside audit facts. This is acceptable as unmerged Phase 1 scaffolding but must be
closed before treating the public API as stable.

No OpenAPI artifact or contract-test harness exists.

## Authentication, authorization, and tenancy

### Strengths

- Identity-derived tenant context; tenant IDs are not taken from bodies.
- Transaction-local PostgreSQL tenant context under `app_role`.
- RLS as backstop and explicit behavioral two-tenant tests.
- Exact scope grammar and explicit scope checks on extension routes.
- Structural import boundaries.

### Gaps

- No staff sign-in/session/refresh/revocation workflow.
- No route-wide authorization framework or policy conditions.
- No property/department scope claims yet.
- No RBAC management commands despite baseline tables.
- No separate service identity flow for API clients.
- No MFA, passkeys, secure recovery, session inventory, or suspicious-login controls.
- No authorization surface for approval/org/event primitives.
- Deploy-role platform reads require continued explicit filtering and review.

## Events, jobs, and workers

The event envelope and catalogue are documented. Only approval events are emitted by
current application behavior. Event publishing and delivery are implemented and tested,
but the process composition is absent.

No deployed jobs currently execute:

- relay polling;
- hold expiry;
- outbox pruning;
- business-day roll/seal readiness;
- notification delivery;
- projection rebuild;
- ARI push;
- statutory/fiscal submission;
- automation evaluation.

`expire_holds()` and `prune_outbox()` exist as SQL functions, but scheduling is not wired.

## AI and integrations

There is no AI provider abstraction, agent runtime, retrieval/knowledge service,
redaction pipeline, tool authorization policy, prompt/evaluation suite, or AI telemetry.
This is correctly classified as missing rather than partial.

There are no live integrations with payment providers, OTAs, GDS, messaging, locks,
fiscal authorities, accounting systems, storage, email, or SMS/WhatsApp. Provider ports
and adapter boundaries are documentation/schema foundations only.

## Testing

### Current executable coverage

- migration checksum/locking/rollback/privilege behavior;
- deterministic seed and drift detection;
- database acceptance and exact schema;
- health and security headers;
- dependency licences and vulnerability audit;
- source import boundaries;
- password/JWT behavior and tenant auth;
- tenant-context isolation and connection cleanup;
- fact-log atomicity and immutability;
- outbox ordering, replay, concurrency, crash recovery, and pruning;
- extension validation/authority/isolation/audit;
- approval state machine/concurrency/tenant isolation;
- organization hierarchy semantics/isolation/index structure;
- canonical 11-test occupancy/ledger/business-day/document/RLS referee.

### Gaps

- no production hospitality journey exists to test;
- no UI, accessibility, visual, browser, or device tests;
- no API contract/fuzz/property-based suite;
- no load baseline for the application kernel;
- no fault injection for real external adapters;
- no backup/restore or disaster-recovery drill in CI;
- no AI evaluation;
- no jurisdiction golden files beyond the future plan.

The `tests/PMS_QA_Test_Suite.md` journey cases are largely aspirational and must not be
counted as passing runtime journeys merely because test names exist or are skipped.

## Deployment and operations

### Present

- pinned multi-stage Bun image;
- Compose app, migrate, seed, PostgreSQL, and Valkey services;
- non-root runtime user;
- PostgreSQL health and `pg_stat_statements`;
- GitHub Actions on Linux and Windows;
- fresh-database migration, seed, drift, container health, and referee gates;
- configurable Compose host ports and project isolation.

### Missing

- production environment composition and secret validation;
- TLS/ingress, DNS, deployment automation, rollbacks;
- backups, restore drills, replication/failover;
- structured application logs, metrics, traces, correlation propagation;
- alerting/on-call/runbooks;
- database connection pool budgets and PgBouncer deployment;
- data retention jobs and privacy operations;
- real SLO dashboards.

## Performance concerns

- The only domain throughput evidence is the occupancy prototype/referee, not an end-to-end
  reservation benchmark.
- Outbox publication deliberately serializes its insert tail with a global advisory lock.
  Correctness wins now; measure p95/p99 and queueing before load justifies redesign.
- The organization GiST test proves operator/index compatibility, not natural planner
  selection under production cardinality, cache, and bloat.
- Extension visibility/compatibility uses platform-wide reads and could become expensive
  without pagination and tenant/type indexes matched to access patterns.
- No payload, query-count, bundle, or client-render benchmarks exist.
- Valkey is running but unused; retaining an idle stateful service has operational cost
  until Phase 2's cache benchmark decides its value.

## Security and privacy concerns

Priority concerns before public exposure:

1. Build a real composition root with fail-fast secret/config validation.
2. Replace single static symmetric signing operation with an explicit key rotation and
   revocation/session strategy; do not change algorithms casually without an ADR.
3. Add consistent problem responses, request-size limits, rate limiting, correlation IDs,
   and structured security logs.
4. Complete property/department/policy authorization beyond tenant-and-scope.
5. Preserve deploy-role separation; isolate platform administration from tenant traffic.
6. Add retention, access logging, export, and anonymization commands for PII.
7. Create AI-context minimization/redaction before sending any guest data to a model.
8. Threat-model public booking, webhook, OTA, payment, and file-import boundaries before
   those slices are exposed.
9. Keep payment collection entirely in PSP-hosted fields/redirects and never accept PAN.
10. Validate backup encryption and restore, not only database correctness.

No claim of PCI, GDPR, tax, accessibility, or jurisdictional compliance is currently
warranted.

## Technical debt and documentation drift

| Item | Consequence | Disposition |
|---|---|---|
| `state.sh` still prints Phase 0 and counts architect response 011 as open | Misleading session ground truth | Fix under a later scoped order |
| Orders 019–026 remain open | Correct until independent Phase 1 review/merge | Do not mark merged |
| `EVENTS.md` still describes NATS relay as current | Conflicts with D-14/Postgres bus | Reconcile in an event-doc order |
| Contract path `/api/v1` vs extension `/api` | Premature API drift | Correct before public API freeze |
| Default server exposes health only | Tested APIs are not deployed behavior | Add composition root in a future order |
| Empty context indices | Useful boundary scaffold but easily mistaken for implementation | Keep; classify honestly |
| `ARCHITECTURE-v3.html`, master prompt, new V1 docs | Multiple generations can diverge | Use PROJECT + decisions + new architecture as routing hierarchy |
| Open PR #18 | Useful operating-language research, but stale base/order number and no review | Preserve as input; do not merge blindly |
| Static HTML walkthrough/mockups | Helpful communication assets, not tested UI | Retain as references |
| Windows checkout is stale | Editing it would lose Phase 1 evidence | Continue in Linux worktree |

## Useful existing work to preserve

- Ten Invariants and their executable referee.
- Immutable baseline checksum and forward-only migration discipline.
- Transaction-local tenant context and RLS/security-invoker posture.
- Occupancy claim-range design and stress evidence.
- Integer-money, balanced-journal, sealed-day, and gapless-document controls.
- Typed kernel boundaries, context import enforcement, and tiny dependency set.
- Audit/outbox/approval/extension primitives.
- PostgreSQL migration/seed/drift tooling.
- Two-agent handoff history and written corrections where builder challenged architect.
- UI peek/drawer/workbench/deep-link concepts.
- Existing research rounds and PR #18's “one graph, many workspaces” synthesis.

## Code to refactor — only when its next consumer justifies it

- Introduce a real application composition root rather than extending the health-only
  default singleton.
- Align HTTP adapters to the v1 contract and reusable authorization/problem/correlation
  middleware.
- Separate platform administration capabilities from tenant request capabilities with
  explicit narrow ports.
- Replace duplicated UUID/name validation with strongly typed boundary constructors when
  enough consumers exist.
- Evolve the limited schema validator deliberately; either certify its subset contract or
  adopt a permitted standard implementation after dependency review.
- Add a command/application-service layer before hospitality behavior, so UI/API/AI do not
  call repositories independently.

No framework or repository-wide rewrite is justified.

## Code that appears obsolete

No tracked production code is proven obsolete. The Python occupancy prototype, static
mockups, Windows walkthrough, and old research prompts are historical/reference artifacts,
not candidates for deletion without a retention decision. The safe action is to label
their authority and purpose, not remove them.

## Git and review state

- `origin/main` contains the reviewed Phase 0 integration.
- The current Phase 1 head is 22 commits ahead of `origin/main` before Order 027 docs.
- Orders 019–026 are a linear implemented stack with green builder evidence but no
  independent Phase 1 exit review.
- No PR currently represents that Phase 1 stack.
- GitHub PR #18 is an unreviewed, green, Phase-0-based architecture/prototype proposal
  whose concepts were considered as research input.
- Order 027 must be independently reviewed and must not merge itself.

## Assessment conclusion

Yellow should **not** be rewritten and should **not** jump to a broad UI prototype as if
the domain were finished. The current kernel is valuable. The next safe sequence is:

1. independently review and integrate Orders 019–026;
2. ratify/correct this constitution and architecture package;
3. issue a Phase 2 plan against the now-observed kernel;
4. implement one end-to-end inventory/occupancy/availability slice through shared
   commands and executable proofs;
5. expand toward the coherent V1 journey in dependency order.

That sequence preserves the full Hospitality Operating System destination while keeping
every claim testable.
