# Capability Matrix

> Historical assessment, not today's feature status. For the 2026-09-05 founder
> requirements and their observed/proposed distinctions, use the
> [feature register](../FEATURE-REGISTER.md) and
> [current research](STAFF-STR-ECOSYSTEM-2026-09.md). Current phase state is in
> [BUILD-PLAN.md](../../BUILD-PLAN.md); exact implementation/review evidence remains
> in orders, reviews and the ledger. The assessment below is preserved unchanged.

**Assessment date:** 2026-08-21
**Method:** Source, tests, live catalog, runtime probe, and decisions were inspected.
A filename or table alone never earns “implemented.”

## Classification

- **IMPLEMENTED** — executable production-path behavior exists and is tested.
- **PARTIAL** — some executable behavior exists, but a core workflow or production
  composition is absent.
- **FOUNDATION EXISTS** — schema, contract, interface, or proof foundation exists; there
  is no usable capability yet.
- **MISSING** — no meaningful repository implementation.
- **RESEARCH REQUIRED** — product/legal/provider semantics must be resolved before design.

Phase 1 entries are physically implemented on the current branch but remain unmerged and
independently unreviewed. That review status is stated separately; it does not turn code
into a product capability.

## Platform and engineering foundation

| Capability | Status | Repository evidence | Missing before usable |
|---|---|---|---|
| Health/liveness | IMPLEMENTED | `GET /health`; exact response and container tests | Readiness/dependency health |
| Security headers/CSP | IMPLEMENTED | global Elysia hooks and path/error tests | Browser app-specific CSP evolution |
| Forward-only migrations | IMPLEMENTED | checksum, lock, rollback, ledger, integration tests | Operational deploy runbook |
| Deterministic demo seed | IMPLEMENTED | exact tenant/property + launch registry tests | Production onboarding |
| Schema drift gate | IMPLEMENTED | normalized PG16 dump and CI | Review process for intentional drift |
| Dependency licence gate | IMPLEMENTED | fail-closed SPDX evaluation | Approved-exception workflow remains decision-only |
| Vulnerability audit | IMPLEMENTED | blocking `bun audit` in CI | Response/runbook |
| Context import boundaries | IMPLEMENTED | canonical directories + negative fixture tests | Command/query/event surface conventions |
| Docker/Compose development | IMPLEMENTED | pinned app/Postgres/Valkey, tools profiles | Production deployment |
| CI on Linux/Windows | IMPLEMENTED | quality/container/database/state jobs | Branch protection/required checks confirmation |
| Observability | FOUNDATION EXISTS | correlation fields, `pg_stat_statements`, health | structured logs, metrics, traces, alerting |
| Backup/recovery | MISSING | architecture prose only | encrypted backup + restore drill |
| Feature flags | MISSING | constitution only | model, lifecycle, cleanup policy |
| Public developer platform | FOUNDATION EXISTS | contract/event docs | versioned APIs, OAuth/service auth, webhooks, sandbox |
| Custom views/saved views | MISSING | UI/product docs | user-scoped view model |
| Search/command palette | FOUNDATION EXISTS | UI specification and PR #18 blueprint | shared command/query registry and client |
| Adaptive multi-device UI | FOUNDATION EXISTS | UI principles/static mockups | production frontend/PWA |
| Accessibility | FOUNDATION EXISTS | WCAG target in docs | semantic UI and automated/manual tests |
| Internationalization/RTL | FOUNDATION EXISTS | timezone/currency schema and docs | locale framework, translations, RTL tests |
| Offline/degraded operation | FOUNDATION EXISTS | offline hold concept/contracts | lease protocol, client queue, conflict UI |
| Performance budgets | FOUNDATION EXISTS | occupancy stress proof and documented targets | end-to-end benchmarks and telemetry |
| Cost engineering | FOUNDATION EXISTS | dependency/architecture doctrine | measured cost attribution |

## Identity, tenancy, policy, and audit

| Capability | Status | Repository evidence | Missing before usable |
|---|---|---|---|
| Shared-schema tenant isolation | IMPLEMENTED | RLS, transaction-local GUC, two-tenant tests | Review/merge Phase 1 and enforce on every future route |
| Tenant request middleware | IMPLEMENTED | fail-before-checkout, rollback/reuse/interleaving proofs | production composition root |
| Organization hierarchy reads | IMPLEMENTED | `ltree` ancestor/descendant/sibling queries/tests | org CRUD/reparent commands and authorization |
| Local password and loopback login | PARTIAL | Bun Argon2id, database-backed generic login, per-process source/account budgets, capped failure backoff, zero-queue four-slot hash bound, bounded state and authoritative peer-key proofs | shared multi-process/public limiter, trusted-proxy topology, recovery and credential lifecycle |
| JWT issue/verify | IMPLEMENTED | exact claims/signature/skew/scope tests; enabled runtime rejects repository-known fallback and local setup generates an ephemeral CSPRNG key | key rotation, revocation and sessions |
| Bearer identity resolution | IMPLEMENTED | resolver + auth integration tests | production wiring |
| Staff/user administration | FOUNDATION EXISTS | `app_user`/role/permission tables | CRUD, invitations, deactivation, audit, UI |
| RBAC | FOUNDATION EXISTS | role/permission/user_role schema | evaluation and management |
| Scoped/policy authorization | PARTIAL | JWT scopes and extension checks | property/department conditions and shared policy engine |
| API clients/service identity | FOUNDATION EXISTS | `api_client` table | issuance, rotation, scopes, auth flow |
| MFA/passkeys | MISSING | security destination only | decision and implementation |
| Audit envelope/fact log | IMPLEMENTED | transaction/property date/immutability tests | universal adoption by every mutation |
| Approval primitive | IMPLEMENTED | state/concurrency/self-approval/fact/event tests | API, policy binding, expiry worker, notifications |
| Generic task foundation | FOUNDATION EXISTS | `task` table | commands, states, queues, dependencies, evidence |
| Workflow/automation | FOUNDATION EXISTS | `automation` table and launch schemas | evaluator, trigger subscriptions, actions, approvals |
| Extension registry | PARTIAL | validation, type/instance/audit/API tests | production wiring, lifecycle/version API, full contract |
| Configuration model | PARTIAL | launch extension types/instances | property setup commands and broader governance |

## Eventing and background work

| Capability | Status | Repository evidence | Missing before usable |
|---|---|---|---|
| Transactional event publication | IMPLEMENTED | outbox atomicity/order proofs | adoption by future commands |
| Durable in-process consumption | IMPLEMENTED | cursor/dedupe/replay/multi-consumer tests | deployed consumers |
| Relay crash recovery | IMPLEMENTED | crash-window and same-consumer concurrency proofs | worker process/supervision |
| Event catalogue | FOUNDATION EXISTS | `docs/EVENTS.md` | schema compatibility tooling and implemented producers |
| Dead-letter/replay operations | FOUNDATION EXISTS | durable outbox and documented replay | error model, retry policy, operator UI |
| Notifications | MISSING | event catalogue/product docs | channel adapters, preferences, aggregation |
| Scheduler/jobs | FOUNDATION EXISTS | SQL expiry/prune functions | supervised scheduling and job observability |
| Real-time client updates | MISSING | planned SSE/WebSocket | projection subscriptions and UI |

## Property, inventory, and sellability

| Capability | Status | Repository evidence | Missing before usable |
|---|---|---|---|
| Property identity/basic config | PARTIAL | org property schema, deterministic demo property | onboarding/editing, addresses, policies, users |
| Building/floor/space model | FOUNDATION EXISTS | `org_node` + `space`/relations | CRUD and constraints at command layer |
| Room/unit types | FOUNDATION EXISTS | `unit_type` | CRUD, validation, vertical defaults |
| Sellable units/composites | FOUNDATION EXISTS | `sellable_unit` and mapping | commands and projections |
| Exclusive/bed occupancy arbitration | FOUNDATION EXISTS | SQL choke point + strong stress/referee proof | TS command layer and API integration |
| Holds with TTL | FOUNDATION EXISTS | table, states, `expire_holds()` | command, scheduler, events |
| OOO/OOS | FOUNDATION EXISTS | schema and event contract | commands, maintenance linkage, sellability effect |
| Restrictions | FOUNDATION EXISTS | schema/contracts | evaluation and APIs |
| Overbooking policy | FOUNDATION EXISTS | schema | guarded policy semantics and recovery |
| Availability projection | FOUNDATION EXISTS | table/event plan | rebuilder and parity proof |
| Availability search | MISSING | contract only | projection query, policy/rate join, benchmark |
| Offline inventory leases | FOUNDATION EXISTS | design concept | lease allocator/sync/conflict proof |
| Valkey cache | FOUNDATION EXISTS | container only | adapter, invalidation, A/B benchmark |

## Commercial core: rates, reservation, guest, distribution

| Capability | Status | Repository evidence | Missing before usable |
|---|---|---|---|
| Rate plans/derived rates | FOUNDATION EXISTS | rate tables/contracts | commands, derivation, resolution |
| Bitemporal rate prices | FOUNDATION EXISTS | insert-only model/current view | application service and historical tests |
| Policies | FOUNDATION EXISTS | policy and extension schemas | evaluator |
| Promotions/packages/negotiated rates | FOUNDATION EXISTS | schema | pricing/allowance behavior |
| Quote | MISSING | availability contract | deterministic pricing/tax/policy result |
| Reservation creation/commit | FOUNDATION EXISTS | schema, state machine, contracts | command transaction and API |
| Reservation modification | FOUNDATION EXISTS | segment/diff model in docs | re-arbitration command and audit/events |
| Cancellation/no-show/reinstatement | FOUNDATION EXISTS | state machine/schema | policy execution and postings |
| Split stays/room moves/shares | FOUNDATION EXISTS | segment/guest model | commands, occupancy transaction, UI |
| Group blocks/allotments | FOUNDATION EXISTS | group/block tables | status/pickup/wash/rooming-list workflows |
| Waitlist | FOUNDATION EXISTS | table | offers, expiry, promotion |
| Durable guest identity | PARTIAL | Party domain plus strict property-authorized operator HTTP/UI search/create, normalized contacts/roles, masked exact duplicate review, server Party-id booking handoff and tenant/concurrency/privacy proofs | edit, merge/anonymise, addresses, documents, preferences, consent, guest-360 and public booking |
| Guest 360 | MISSING | UI/product docs | read model and UI |
| Consent/privacy requests | FOUNDATION EXISTS | consent/erasure tables | purpose enforcement/export/anonymization |
| Unified communications | FOUNDATION EXISTS | message table/event catalogue | channel adapters, threads, permissions, AI assistance |
| Direct booking engine | MISSING | contract/product docs | public search-to-book client and API |
| OTA/channel ingestion | FOUNDATION EXISTS | channel/map/inbound schema | provider adapters and certification |
| ARI distribution | FOUNDATION EXISTS | push cursor/event design | adapter, batching, reconciliation |
| GDS/wholesale/metasearch | RESEARCH REQUIRED | destination only | provider access, contracts, economics |
| Attribution/source/channel separation | FOUNDATION EXISTS | reservation/channel concepts | explicit command/query behavior |

## Operations

| Capability | Status | Repository evidence | Missing before usable |
|---|---|---|---|
| Arrival/departure/in-house worklists | FOUNDATION EXISTS | state/UI contracts | queries and UI |
| Room assignment/check-in | FOUNDATION EXISTS | state machine/schema | statutory/payment/condition guards |
| Checkout | FOUNDATION EXISTS | state machine/account/folio schema | balance/AR settlement command |
| Travel/vehicle/pickup | FOUNDATION EXISTS | tables and automation concept | commands/tasks/UI |
| Housekeeping condition | FOUNDATION EXISTS | `unit_condition` | state commands/events |
| Task sheets/inspection | FOUNDATION EXISTS | schema/state docs | generation/allocation/mobile flow |
| Discrepancies | FOUNDATION EXISTS | schema and sleep/skip research | detection/resolution/seal interaction |
| Maintenance/work orders | PARTIAL | generic task + OOO/OOS + space relations | asset registry and maintenance workflow |
| Lost and found | MISSING | destination only | domain model/workflow |
| Queue/wake-up/guest requests | FOUNDATION EXISTS | queue/message/task primitives | commands and service UX |
| Staff shifts/teams/SLAs | MISSING | destination only | workforce domain |
| Knowledge/SOP system | MISSING | destination only | documents, access, retrieval |

## Finance and payments

| Capability | Status | Repository evidence | Missing before usable |
|---|---|---|---|
| Account-owned folios/windows | PARTIAL | tenant-coherent schema, atomic `FolioService.openPrimary`, plus exact-string server snapshot statement and authorized operator read surface | additional windows, settlement lifecycle and guest/public presentation |
| Balanced journal/posting ledger | PARTIAL | tenant/date/currency-coherent schema, read-only tx-code routing, atomic untaxed `ChargeService.postCharge` with seal serialization, and strict operator charge adapter | tax-aware and scheduled charges, corrections/transfers, payments and settlement |
| Immutable corrections/reversals | FOUNDATION EXISTS | schema/contracts/invariants | commands and UX |
| Business day/seal | FOUNDATION EXISTS | table/functions/invariant tests | roll/readiness/exceptions workflow |
| Cashier sessions | FOUNDATION EXISTS | table | lifecycle, over/short, permissions |
| Routing/transfers/allowances | FOUNDATION EXISTS | contracts/automation | deterministic commands |
| Payments | PARTIAL | immutable operation/attempt/receipt model, deterministic token-only provider, one balance-capped capture, exact journals, signed bounded synthetic callback and replay proof | real remote PSP adapter/certification, settlement UX and chargebacks |
| Deposits/preauth/incremental auth | PARTIAL | journal-free authorization/increment chain plus expiring hosted deposit request, liability capture and capped immutable partial/full folio application | guarantee policy automation, deposit refunds, delivery channels and remote provider certification |
| Refunds/chargebacks | PARTIAL | bounded partial-refund commands with capture payment/journal lineage | disputes, chargebacks, permissions and operational UX |
| Accounts receivable | FOUNDATION EXISTS | accounts/ar allocation | invoicing, allocation, aging, statements |
| Owner accounting/statements | MISSING | vertical flags/product destination | separate owner ledger/payout model |
| Multi-currency settlement | RESEARCH REQUIRED | single-currency journals + FX concept | explicit product/provider/jurisdiction design |
| Night-audit readiness | FOUNDATION EXISTS | continuous-close docs and SQL seal | projections, exceptions, controlled UI |

## Tax, fiscal, statutory, and reporting

| Capability | Status | Repository evidence | Missing before usable |
|---|---|---|---|
| Tax rule storage | FOUNDATION EXISTS | tax assignment + jurisdiction extension | evaluator/golden files |
| Hotel GST/VAT calculations | RESEARCH REQUIRED | provisional docs/decisions | current jurisdiction verification per release |
| Fiscal documents/numbering/hash | FOUNDATION EXISTS | series/document + invariant proof | issue/render/correction services |
| India IRP | RESEARCH REQUIRED | provider plan/submission table | current sandbox/credentials/spec adapter |
| Saudi ZATCA | RESEARCH REQUIRED | provider plan/submission table | signing/clearance chain/certification |
| UAE eInvoicing | RESEARCH REQUIRED | provider-routed decision | accredited provider selection and adapter |
| Guest statutory reporting | RESEARCH REQUIRED | submission table/adapter plan | country-by-country verified fields/timing |
| Daily statistics | FOUNDATION EXISTS | `stats_daily` | projection consumer and reconciliation |
| Operational/financial reports | MISSING | UI/report catalog only | queries, permissions, export/render |
| Revenue metrics/forecasting | MISSING | destination and stats schema | data pipeline, definitions, models |
| Regulatory retention | RESEARCH REQUIRED | privacy docs | jurisdiction policy modules |

## Revenue, Comp Advantage, owner, asset, and AI

| Capability | Status | Repository evidence | Missing before usable |
|---|---|---|---|
| Revenue-management metrics | FOUNDATION EXISTS | documented definitions | trusted data projections |
| Dynamic pricing/restrictions | MISSING | destination only | deterministic policy engine |
| Competitive observations | MISSING | Comp Advantage concept | licensed/source adapters and provenance model |
| Recommendation evidence/outcomes | FOUNDATION EXISTS | fact/event/approval primitives | revenue decision aggregate |
| Owner/unit/agreements | MISSING | product destination only | bounded-context decision |
| Owner payouts/statements | MISSING | product destination only | separate accounting model |
| Asset/building/unit extension | FOUNDATION EXISTS | org/space models | ownership/agreements/performance extension |
| AI provider routing | MISSING | destination only | privacy/cost/quality port |
| Agent registry/permissions/budgets | MISSING | approval/audit foundations only | agent identity/policy/tool model |
| Natural-language command layer | MISSING | UX concept only | canonical command registry and parser |
| AI recommendations/explanations | MISSING | fact/approval foundations | evidence/confidence/outcome model |
| AI autonomous execution | RESEARCH REQUIRED | autonomy levels only | risk policy, evaluation, rollback |
| Knowledge retrieval | MISSING | destination only | property knowledge, ACLs, provenance |
| AI redaction/context minimization | MISSING | privacy principle only | enforced pipeline and tests |

## Cross-capability conclusion

The platform foundation is ahead of the product surface. The next value does not come
from adding more baseline tables or designing hundreds of screens. It comes from using
the verified kernel to deliver a truthful vertical chain:

`property -> inventory -> occupancy arbitration -> availability -> rate -> guest ->
reservation -> arrival -> folio -> payment -> checkout -> audit/events`

Each slice should move rows from **FOUNDATION EXISTS** to **PARTIAL** and then
**IMPLEMENTED** only when domain rules, persistence, authorization, API, events, tests,
failure handling, and an appropriate user surface agree.
