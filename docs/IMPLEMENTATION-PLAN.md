# Implementation Plan

**Plan date:** 2026-08-21
**Status:** Dependency-aware proposal; it does not issue or authorize implementation
orders. `BUILD-PLAN.md` and reviewed handoff orders remain execution authority.

## Outcome

Deliver one truthful operating chain before breadth:

`property -> inventory -> availability -> rates -> guest -> reservation -> arrival ->
housekeeping -> check-in -> folio -> payment -> checkout -> business-day audit`

Then extend that same chain into direct booking, distribution, groups, compliance,
reporting, revenue, owner operations, automation, and AI.

Every slice must be runnable and testable. A slice is not done because tables, screens,
prompts, or adapters exist.

## Current starting point

- Phase 0 is merged and independently reviewed.
- Orders 019–026 are implemented on a linear Phase 1 stack.
- Builder checks have been green, but no independent Phase 1 exit review has occurred.
- The default server still exposes health only.
- No Phase 2 order exists.
- Order 027 adds architecture/research documentation only.

Therefore the first milestone is a gate, not new product code.

## Standing completion dimensions

For each capability report these independently:

| Dimension | Question |
|---|---|
| Domain | Are state, invariants, and commands explicit? |
| Persistence | Are schema/constraints/indexes/migrations correct? |
| Authorization | Are tenant/property/role/policy and negative cases proven? |
| API | Is the versioned transport contract implemented and idempotent? |
| Events/audit | Are facts/events atomic, attributable, replayable, and catalogued? |
| Failure | Are concurrency, dependency failure, retry, reconciliation, and compensation handled? |
| Experience | Is there an appropriate accessible device/role surface? |
| Operations | Are health, logs, metrics, runbook, and recovery present? |
| Tests | Do unit/integration/journey/load/security proofs run? |
| Documentation | Do domain, contract, event, journey, and runbook match code? |

The honest status is the weakest material dimension.

## Gate 0 — Phase 1 exit and documentation ratification

**User outcome:** None directly; establish a trustworthy kernel and plan.

### Work

1. Push the complete Phase 1 stack and Order 027 documentation.
2. Create the Phase 1 cumulative review request with order/commit/proof provenance.
3. Independent architect re-runs the pre-registered proofs for Orders 019–026.
4. Correct findings on scoped branches.
5. Merge reviewed Phase 1 through the designated cumulative PR; never self-merge.
6. Re-run `main` CI and the 11/11 referee.
7. Review/ratify or amend the constitution, domain model, architecture, journey map, and
   capability matrix.
8. Write the Phase 2 order plan from the merged state.

### Exit proof

- independent review artifact;
- all Phase 1 DoD proofs reproduced;
- `main` CI green;
- `./setup.sh --db-only` = 11/11;
- state reports the correct phase/open work;
- documentation discrepancies have tracked orders.

### Explicit non-goals

No Phase 2 code, broad prototype, schema rewrite, or new event.

## Slice 1 — Property Inventory to Authoritative Hold

**Product outcome:** An authorized property user can configure a small property's
sellable inventory, see truthful availability, and place/release an expiring hold.

**Dependencies:** Gate 0.

### Commands and behavior

- create/read/update allowed property inventory configuration;
- create unit types, spaces, and sellable-unit mappings;
- open/close OOO/OOS and restrictions as scoped by reviewed orders;
- search PostgreSQL-backed availability;
- place/release/expire hold only through occupancy functions;
- rebuild and compare availability projection;
- expose conflict and blocker explanations.

### Required decisions before order

- exact CRUD mutability/effective-date rules for inventory entities;
- event catalogue verification;
- hold guarantee and idempotency;
- overbooking/default vertical semantics;
- worker scheduling for expiry;
- whether any schema change is truly necessary.

### Executable proof

- exclusive/bed races and direct-DML denial;
- two-tenant API isolation;
- hold expiry/release transition;
- projection rebuilt from zero equals truth;
- 500-space availability p99 budget;
- database outage and stale projection behavior;
- audit/outbox atomicity.

### Minimal experience

A small staff inventory/availability workbench or API explorer that invokes production
commands. No decorative property setup suite.

## Slice 2 — Rate and Quote

**Product outcome:** Staff or a guest channel receives a reproducible nightly quote with
total, policies, restrictions, eligibility, and tax placeholder/version boundaries.

**Dependencies:** Slice 1.

### Behavior

- rate-plan and insert-only rate-price commands;
- derived rate resolution and explicit overrides;
- package/promotion/negotiated precedence;
- restriction and occupancy pricing;
- quote snapshot/version/freshness;
- availability option references a quote but remains non-binding until hold.

### Proof

- bitemporal “valid then/known then” query;
- derived parent change and child override;
- overlapping-rule deterministic precedence;
- property timezone policy cutoff;
- bigint/currency only;
- tenant/property authorization;
- quote changes when relevant evidence/version changes and remains reproducible otherwise.

### Non-goals

Full revenue optimization, competitor data, or every jurisdictional tax regime.

## Slice 3 — Guest and Reservation Commit

**Product outcome:** A staff user can search/hold, identify or create a guest, commit one
or more reservation segments, and receive a confirmation without double-selling.

**Dependencies:** Slices 1–2.

### Behavior

- party search/create and safe duplicate suggestion;
- reservation command/state implementation;
- hold-to-commit and direct commit;
- multiple segments/rooms/guests;
- source/channel/attribution separation;
- cancellation/no-show/reinstatement;
- modification/extension/shortening through re-arbitration;
- existing catalog events and audit;
- idempotent `/api/v1` contract.

### Proof

- two final-unit commits: one success, one occupancy conflict;
- retry same idempotency key: same result; changed payload: conflict;
- cancellation releases occupancy and applies versioned policy;
- reinstatement cannot restore unavailable room;
- OTA-like duplicate message does not duplicate reservation;
- tenant B cannot search/read/mutate A;
- complete state-machine generated test.

### Minimal experience

Arrivals-ready reservation workbench using PEEK/DRAWER/WORKBENCH and keyboard flow.

## Slice 4 — Arrival, Assignment, and Housekeeping Readiness

**Product outcome:** Staff can prepare arrivals, assign rooms, see blockers, queue an
early guest, complete cleaning/inspection tasks, and check in safely.

**Dependencies:** Slice 3.

### Behavior

- arrival/due-in projection;
- room assignment and do-not-move/override decisions;
- travel details and ETA;
- independent room condition and occupancy;
- housekeeping task/inspection/discrepancy flow;
- maintenance/OOO dependency through generic work orders initially;
- readiness graph;
- check-in guards and key-provider placeholder port.

### Proof

- dirty/OOO destination blocked without exact authority;
- sleep/skip/person discrepancy cases;
- VIP/ETA priority is explainable, not arbitrary;
- room move creates a new segment and updates old/new room conditions;
- two assignments race safely;
- mobile/offline task update conflict behavior;
- missing jurisdiction field blocks only configured property.

### Minimal experience

Desktop arrivals/readiness workbench plus phone housekeeping queue over the same commands.

## Slice 5 — Folio, Posting, and Payment Settlement

**Product outcome:** A checked-in stay can receive charges, route/transfer them, take a
tokenized payment, settle all windows, and retain an immutable audit trail.

**Dependencies:** Slice 4.

### Behavior

- account/folio/window opening;
- transaction-code configuration;
- balanced charge/transfer/adjust/reversal commands;
- statement/balance queries;
- hosted PSP sandbox adapter and signed idempotent webhooks;
- deposit/preauthorization/capture/refund basics;
- cashier session;
- AR transfer with permission.

### Proof

- unbalanced commit rejected;
- original posting cannot update/delete;
- adjustment/reversal leaves original;
- duplicate webhook yields one settlement;
- provider success/local timeout reconciliation;
- multiple windows must settle or explicitly transfer;
- 1,000-posting trial balance remains zero;
- no PAN in requests, logs, DB, facts, events, or fixtures;
- tenant and role separation.

### Minimal experience

Folio workbench with immutable rows, windows, exact balance, recovery guidance, and
hosted test payment.

## Slice 6 — Checkout and Continuous Business-Day Close

**Product outcome:** Staff can check out a guest, issue an appropriate document, roll the
property business date, resolve exceptions, and seal deterministically.

**Dependencies:** Slice 5.

### Behavior

- checkout/AR/open-folio policy;
- room condition after departure;
- room/tax scheduled postings with idempotency;
- readiness projection for arrivals, departures, cashiers, discrepancies, interfaces;
- continuous roll independent of seal;
- carry-forward approval;
- seal and post-seal correction behavior;
- basic document issue/number/hash and non-jurisdictional rendering.

### Proof

- checkout with unresolved balance blocks or explicit AR path succeeds;
- repeated roll/post job cannot duplicate charge;
- property-local midnight/DST cases;
- multiple unsealed days remain operable;
- sealed day blocks ordinary journal;
- document numbers remain gapless under concurrency;
- correction creates new document/journal.

### Minimal experience

“Night Audit” terminology where configured, implemented as readiness → exceptions →
resolution → controlled close.

## Milestone A — One synthetic property can operate a stay

After Slice 6, run a non-skipped journey:

`setup property -> create inventory/rates -> search -> hold -> guest -> reserve ->
prepare/clean -> assign/check in -> post -> pay -> check out -> issue document ->
roll/seal`

It must use production APIs/commands and real PostgreSQL, with two tenants and failure
injection. This is the first point Yellow can honestly say a coherent core PMS vertical
exists.

## Slice 7 — Direct Booking and Guest Communication

**Product outcome:** A property can publish an accessible direct booking journey and
communicate confirmation/pre-arrival/service messages.

**Dependencies:** Milestone A.

### Behavior

- public property/content/availability/quote/book pages;
- hosted payment/deposit;
- confirmation/modify/cancel;
- email first, then approved messaging providers behind one port;
- unified conversation links to guest/reservation/task;
- consent/preferences/templates;
- bot/card-testing defense.

### Proof

- accessibility keyboard/screen-reader/touch journey;
- price/policy parity with staff quote;
- bot/rate-limit behavior;
- message delivery retry/fallback;
- guest cannot access another booking;
- PSP-hosted payment boundary;
- slow/offline UI does not fake success.

## Slice 8 — First OTA Distribution

**Product outcome:** One certified provider can ingest new/modified/cancelled bookings
and converge rates/availability/restrictions.

**Dependencies:** Milestone A; provider access may run in parallel administratively.

### Behavior

- connection/capabilities and credential health;
- versioned unit/rate maps;
- raw inbound envelope + idempotent normalization;
- canonical reservation commands;
- ARI batching/cursor/retry/reconciliation;
- error queue and replay;
- commission/payment-term capture.

### Proof

- duplicate/retried/out-of-order messages;
- modification before acknowledgement;
- confirmed overbooking incident;
- partial ARI failure converges;
- mapping retirement/in-flight message;
- provider sandbox certification cases;
- canonical state survives outage.

Implement Booking.com or Expedia first only after partner access confirms feasibility;
do not build fake adapters around imagined payloads.

## Slice 9 — Groups, Blocks, and Sales

**Product outcome:** A sales user can manage enquiry-to-definite block, allotment,
pickup/cutoff/wash, rooming list, and group billing routing.

**Dependencies:** Reservations, inventory, rates, finance.

### Proof

- deduct versus non-deduct status;
- status transition with insufficient inventory;
- idempotent cutoff/wash;
- elastic pickup limit;
- 200-row rooming-list import preview/error/commit;
- one-member cancellation;
- conflicting routing rejection;
- group master and member folios reconcile.

Function spaces/catering follow as a later sub-slice after room blocks work.

## Slice 10 — Launch Jurisdiction Compliance

**Product outcome:** A property in one selected launch jurisdiction calculates verified
tax, captures statutory data, issues/submits documents, and sees failures.

**Dependencies:** Finance/documents and founder-selected market/provider.

### Work sequence

1. verify current primary law/spec and record effective date;
2. create golden tax/invoice/statutory fixtures;
3. implement jurisdiction policy module;
4. implement official sandbox/provider adapter;
5. build submission queue/reconciliation/receipts;
6. build exception UI/runbook;
7. obtain external certification/onboarding where required.

### Proof

- boundary rates/rounding/timezones;
- missing identity blocks only applicable property;
- duplicate submission idempotency;
- accepted/rejected/timeout reconciliation;
- immutable correction/credit-note flow;
- exact signed/QR/hash/provider fixtures.

Do not claim compliance from passing internal tests alone.

## Milestone B — One property can sell and operate without another core PMS

Requires Milestone A + direct booking + payment + first distribution + launch compliance
+ operational reports + backup/restore/monitoring. This is the constitution's product
test in a constrained market, not the full destination.

## Slice 11 — Reporting and Revenue Intelligence

**Product outcome:** GM/revenue/owner roles see defined, reconciled operational and
commercial metrics and can approve evidence-backed rate actions.

### Behavior

- rebuildable daily/pace/pickup projections with watermarks;
- metric dictionary/version;
- operational/financial/segment/channel/net contribution views;
- forecast baseline;
- market observation source abstraction;
- recommendation/evidence/confidence/expected/actual outcome;
- approval then normal rate/restriction command.

### Proof

- projections rebuild to source truth;
- metric denominator/gross-net reconciliation;
- stale/unknown/sold-out observations distinguish correctly;
- recommendation cannot breach floor/ceiling/scope;
- changed state invalidates stale approval;
- AI/provider outage leaves manual revenue workflow.

Comp Advantage begins with licensed/manual/API observations, never unauthorized scraping.

## Slice 12 — Maintenance, Assets, and Workforce Coordination

**Product outcome:** Engineering and operations can manage assets/work orders, downtime,
preventive maintenance, SLA, and cross-department handoffs.

Requires an ADR/model decision for asset ownership and work-order lifecycle.

### Proof

- asset failure affects every linked space but no others;
- closing work order does not sell unsafe room;
- preventive recurrence idempotency;
- offline technician conflict;
- parts/vendor/cost authorization;
- handoff/SLA escalation without notification spam.

## Slice 13 — Owner and STR Operations

**Product outcome:** An operator can manage owners/units/agreements, owner stays,
expenses, effective-dated payout rules, and statements separately from guest folios.

Requires founder market decision and separate accounting model.

### Proof

- owner-stay occupancy uses canonical choke point;
- granular co-host/owner permissions;
- agreement change does not rewrite existing stay economics;
- cancellation after payout produces adjustment/receivable;
- gross-to-net statement reconciles;
- no cross-owner data leakage;
- long-stay monthly payout/fee/tax cases.

## Slice 14 — Workflow Automation

**Product outcome:** Authorized users configure trigger → condition → action → approval →
follow-up workflows using existing commands.

### Proof

- duplicate event fires one business effect;
- policy/permission checked at execution time;
- dry run is read-only and evidence-rich;
- changed state invalidates stale prepared action;
- bounded retry/dead-letter;
- recursion/cycle/budget limits;
- audit links trigger, rule version, approval, command, and outcome.

## Slice 15 — Controlled AI Command and Agent Foundation

**Product outcome:** A user can ask Yellow a natural-language operational question,
receive a sourced answer/recommendation, prepare a command, approve it, and execute
through the same deterministic service.

### First narrow path

`“Show today's blocked arrivals and prepare messages to guests whose rooms will be late.”`

This exercises authorized retrieval, aggregation, property knowledge, draft preparation,
approval, message command, audit, and outcome without letting AI touch inventory/money.

### Proof

- prompt injection in guest content cannot change tool policy;
- tenant/property/role data minimization;
- unsupported claim cites no evidence and is rejected/qualified;
- provider outage yields normal manual workflow;
- retry does not duplicate messages;
- budget/autonomy limits;
- approval revalidates recipients/current readiness;
- model/provider/prompt/policy/evidence/cost/result logged.

Revenue, finance, and autonomous agents follow only after evaluations and tenant policies
for lower-risk paths are trustworthy.

## Slice 16 — Migration and Ecosystem Platform

**Product outcome:** A real property can import validated source data, reconcile, go live,
and connect vendors through stable APIs/webhooks.

### Behavior/proof

- CSV/Excel/source connector mapping and preview;
- stable row identities, partial-error report, dry-run reconciliation;
- staged cutover and rollback plan;
- profiles/reservations/future stays/open balances scope by approved policy;
- public OpenAPI/webhooks, service auth, versioning, rate limits, sandbox;
- provider certification harness;
- no silent truncation, duplicate, or cross-tenant import;
- post-import counts/money/occupancy reconcile exactly.

## Cross-cutting work attached to slices

Do not build separate horizontal “security month” or “documentation phase.” Every slice
includes:

- threat/failure model;
- permissions and two-tenant negatives;
- idempotency/concurrency;
- audit/events;
- accessibility/device behavior;
- international/timezone/currency;
- telemetry/runbook;
- performance/cost measurement;
- documentation updates.

Large shared investments occur when first needed:

| Foundation | First consumer |
|---|---|
| API v1 problem/correlation/idempotency middleware | Slice 1 |
| Production composition/config | Slice 1 |
| Supervised scheduler | hold expiry in Slice 1 |
| Frontend foundation | minimal Slice 1 experience or Slice 3 if API-first |
| Object storage | identity/document attachment slice |
| PSP port | Slice 5 |
| Messaging port | Slice 7 |
| Provider adapter harness | Slice 8 |
| Jurisdiction policy framework | Slice 10 |
| Recommendation model | Slice 11 |
| Agent/tool gateway | Slice 15 |

## Batch and review strategy

- One reviewed phase plan at a time.
- Orders carry exact Scope, Forbidden, DoD, and pre-registered negative proofs.
- Hard-floor failures stop immediately.
- Tier 3 gets independent architect review with reviewer-executed proof.
- A phase exits through one cumulative full-diff review/PR.
- Codex never approves or merges its own work.
- Documentation-only plans do not waive code review.

## Proposed first order after review

After Gate 0, the architect should decompose Slice 1 and issue only its first bounded
order. A safe candidate is:

**Tenant-safe unit-type and space commands with audit/events, before occupancy mutation.**

It should:

- use baseline tables only if their existing constraints suffice;
- define exact mutable fields and property ownership;
- use the Phase 1 tenant transaction/audit/EventBus;
- add API v1 transport only if the production composition decision is included;
- prove tenant B cannot see/write A, duplicate command idempotency, rollback atomicity,
  and no direct occupancy write;
- stop before hold/occupancy if any schema/event/invariant ambiguity appears.

The architect may choose a different decomposition after independent Phase 1 review.
No code should start from this document alone.

## What not to do next

- Do not merge or execute PR #18's broad prototype order as written.
- Do not start hundreds of screens.
- Do not add owner/agent/market tables speculatively.
- Do not rewrite the kernel/framework.
- Do not expose baseline tables through generic CRUD.
- Do not let AI or automation receive raw database mutation tools.
- Do not claim “PMS complete” at Milestone A or “Hospitality OS complete” at Milestone B.
- Do not postpone tenant/security/failure/accessibility work until after feature breadth.

## Progress reporting

At each slice end publish:

1. user journey now possible;
2. exact implemented/partial/foundation/missing classification changes;
3. commands/events/schema/API/UI added;
4. executable proof output and provenance;
5. known edge cases and deferred decisions;
6. performance/cost/security observations;
7. next proposed slice;
8. review and merge status.

This makes progress legible without reducing the destination or overstating completion.
