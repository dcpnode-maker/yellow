# Master Build Prompt — Next-Generation Hospitality Management Platform

**Version:** 0.1 (draft for review)
**Purpose:** A single authoritative prompt/specification to drive design and implementation sessions (Claude Code, architecture reviews, ADRs).
**Status:** Requires resolution of the Open Decisions in §10 before implementation begins.

---

## 0. Provenance and Constraints

This specification was written from hospitality domain knowledge and publicly available industry standards. It is **not** derived from any vendor's documentation, source code, screenshots, or database schema.

**Legitimate reference sources for this project:**
- USALI (Uniform System of Accounts for the Lodging Industry) — ledger structure, revenue buckets, statistics, night audit accounting
- HTNG and OpenTravel/OTA message specifications — reservation, ARI, folio, and profile payload shapes
- Public REST API documentation of competing products (Mews, Apaleo, Cloudbeds) — modern domain decomposition
- PCI DSS, GDPR, and regional fiscal/e-invoicing regulations
- Direct interviews with hotel operators (front office managers, night auditors, revenue managers, housekeeping supervisors)

**Prohibited inputs:**
- Any incumbent vendor's documentation, help text, training material, or screenshots used as a design source
- Any incumbent's database schema, terminology quirks, screen layout, or report template
- Any material obtained under a licence containing reverse-engineering or confidentiality restrictions

**Rule of thumb for every design decision:** work forward from the operational problem ("a hotel needs to split one stay's charges across three payers and close the financial day"), never backward from how a specific product solved it. Where an incumbent's approach is discussed, it is discussed as industry practice and re-derived, not transcribed.

Feature-level parity with market incumbents is an explicit goal and carries no legal exposure — functionality, methods, and systems are not protectable expression. Exposure lives entirely in *how* an implementation is arrived at. Design independently and record that independence.

**Record-keeping requirement:** every significant module carries an ADR (Architecture Decision Record) stating the requirement, the sources consulted, the options considered, and the rationale. This is both good engineering practice and the evidence of independent derivation.

---

## 1. Mission

Build a multi-tenant, multi-property hospitality management platform with the complete functional scope of an enterprise PMS, on a modern architecture, at a fraction of the resource cost.

**Target scope:** Property Management System, Channel Manager, Booking Engine, Central Reservation System, Revenue Management hooks, CRM, and back-office financial integration.

**Target segments:** Independent hotels, small-to-mid chains, serviced apartments, hostels, and short-term rental operators. Multi-property and multi-brand from day one. Priority geographies: Gulf (VAT + e-invoicing), India (GST), US, Western Europe.

**Non-negotiable qualities:**
1. **Financial correctness.** Ledgers balance, postings are immutable, every mutation is attributable. A folio that does not balance is a legal liability.
2. **Sub-100ms perceived interaction** on all high-frequency screens.
3. **Operational continuity.** The front desk must function during network loss and must never be blocked by a batch process.
4. **Low cost to run.** A 50-property tenant should be servable on commodity hardware.
5. **Complete auditability.** Every state change reconstructible with actor, timestamp, and reason.

---

## 2. Architectural Directives

### 2.1 Shape
- **Modular monolith**, single deployable, with hard module boundaries enforced in code (import rules, per-module public APIs, no cross-module table access).
- Extract to a separate service **only** on demonstrated need. Anticipated candidates: availability/pricing engine, channel synchronisation worker, reporting ingestion.
- Modules communicate through an in-process event bus with the same contract they would use over the wire, so extraction is mechanical.

### 2.2 Stack (default position — see §10 for open questions)
- **Runtime/API:** TypeScript on Bun + Elysia. Chosen for domain-modelling expressiveness, ecosystem depth for payments/tax/telemetry, and hireability. A PMS is I/O- and complexity-bound, not CPU-bound; language-level throughput is not the constraint.
- **Escape hatch:** the availability and pricing engine is CPU-bound at scale. Specify it as a pure function behind a hard interface. Implement in TypeScript first; port to Rust (FFI native module or gRPC service) only if profiling under realistic load proves it the bottleneck.
- **Maximum two languages in the system.** Each additional language is a build pipeline, a dependency scanner, a debugging context, and a hiring constraint.

### 2.3 Data
- **PostgreSQL 16+ as the single system of record.** ACID, foreign keys, check constraints, and serialisable isolation are requirements for a financial system, not preferences.
- **No graph database for the core.** The genuinely graph-shaped concerns (org hierarchy, corporate account trees, profile relationships) are handled by `ltree` and recursive CTEs. A second system of record would introduce dual-write consistency problems for roughly 5% of queries.
- **Range types + GiST indexes** (`tstzrange`, `daterange`) for all interval logic — occupancy, out-of-order periods, rate validity, restriction windows.
- **Partitioning** on postings and reservations by property and business date. Cold partitions detachable. Hot working set stays small — this is the primary cost lever.
- **Availability is a materialised projection, never a read-time computation.** Maintained transactionally on every inventory-affecting write. This is the single highest-read path in the system.
- **DragonflyDB** for availability windows, rate quotes, and session state. Event-driven invalidation, not TTL-based.
- **OLTP/OLAP separation.** Analytical and management reporting runs off a streamed replica (ClickHouse at scale, DuckDB for small deployments). No manager report ever touches the transactional database.

### 2.4 Event model
- **Append-only event log as the substrate for the financial and inventory domains.** Postings, inventory movements, and reservation state transitions are events; balances, availability, and current state are projections.
- Not full CQRS/event-sourcing across every module — apply it where audit, temporal query, and reconstruction genuinely matter (Financials, Inventory, Reservations). Elsewhere, conventional state tables with an audit trail.
- Events are versioned, typed, and carry: event id, tenant, property, business date, actor, correlation id, causation id, payload, schema version.

### 2.5 Multi-tenancy
Tiered, as an upsell ladder rather than a single upfront choice:
1. **Shared schema + RLS** — default; keeps marginal cost per tenant near zero.
2. **Schema-per-tenant** — mid-tier, for isolation-sensitive customers.
3. **Dedicated database/cluster** — enterprise, for regulatory or contractual isolation.

The application layer must be agnostic to which tier a tenant occupies. Tenant resolution happens once at request boundary and is enforced in the data layer, not by convention.

### 2.6 Hierarchy
`org_node` tree using `ltree`: Group → Brand → Region → Property → Building/Wing → Floor → Unit. Every entity is scoped to a node. Permissions, reporting, inventory, and rate distribution all resolve against subtrees.

---

## 3. Bounded Contexts

Twelve contexts. Each owns its tables. Cross-context reads go through published interfaces; cross-context writes go through events.

| # | Context | Owns | Key published events |
|---|---|---|---|
| 1 | **Identity & Tenancy** | tenants, org_node, users, roles, tasks, sessions, API clients | UserProvisioned, RoleChanged |
| 2 | **Inventory & Availability** | units, unit types, slots, holds, OOO/OOS, availability projection, restrictions | SlotHeld, SlotReleased, AvailabilityChanged, UnitStatusChanged |
| 3 | **Rates & Offers** | rate plans, price rules, packages, promotions, policies, derived/linked rates | RatePlanPublished, PriceChanged, RestrictionChanged |
| 4 | **Reservations** | reservations, stay segments, shares, links, guarantees, traces, alerts | ReservationCreated, ReservationModified, ReservationCancelled, NoShowRecorded |
| 5 | **Stay Operations** | check-in/out, unit moves, in-stay changes, queue, guest requests, wake-ups, messages | GuestArrived, GuestDeparted, UnitMoved, StayExtended |
| 6 | **Housekeeping & Assets** | unit condition, task sheets, attendants, credits, inspections, work orders, maintenance, linen/facility schedules | UnitConditionChanged, TaskCompleted, WorkOrderRaised |
| 7 | **Financials** | folios, billing windows, postings, routing, ledgers, payments, deposits, AR, cashier sessions, day-close | ChargePosted, PaymentReceived, FolioSettled, DayClosed |
| 8 | **Profiles & CRM** | guest/company/agent/source/group profiles, contacts, relationships, preferences, memberships, consent, stay history | ProfileCreated, ProfilesMerged, ConsentChanged |
| 9 | **Groups & Events** | blocks, allotments, wash schedules, rooming lists, cutoff, function space, catering, banquet orders | BlockStatusChanged, BlockPickedUp, BlockCutoff |
| 10 | **Distribution** | channel mappings, ARI push, inbound booking ingestion, OTA/GDS/CRS connectors, booking engine, error queue | ARIPushed, ExternalBookingReceived, MappingFailed |
| 11 | **Tax & Compliance** | tax rules, jurisdictions, fiscal documents, invoice numbering, e-invoicing, statutory registers, police/immigration reporting | TaxCalculated, FiscalDocumentIssued |
| 12 | **Reporting & Analytics** | projections, statistics, forecasts, dashboards, exports, BI feeds | (consumer only) |

---

## 4. Cross-Cutting Domain Primitives

Implement these once, correctly, before any module.

- **BusinessDate** — a property-scoped logical date, distinct from wall-clock time. All postings, statistics, and statuses key to it. Branded type; never a raw `Date`.
- **Money** — integer minor units + ISO currency code. No floats anywhere in the financial path. Explicit rounding policy per jurisdiction. Multi-currency with rate-at-time-of-transaction retention.
- **TemporalRange** — half-open interval semantics `[start, end)` uniformly. Ambiguity here causes off-by-one-night bugs, the most common class of PMS defect.
- **Slot** — the atomic unit of sellable inventory (unit × date, or unit × time window for hourly/day-use products). Everything in Inventory reduces to slot state.
- **StateMachine** — reservation, block, folio, and unit lifecycles declared as data, with exhaustive transition checks enforced by the type system.
- **Actor** — user, system job, API client, or channel; attached to every mutation.
- **TenantContext** — resolved once per request; enforced at the data layer.
- **Policy** — cancellation, guarantee, deposit, no-show, and early-departure rules as composable evaluable objects, not scattered conditionals.

---

## 5. Functional Requirement Catalogue

Complete target scope. Sequencing in §9.

### 5.1 Identity, Tenancy & Configuration
- Tenant provisioning, org_node tree CRUD, property setup wizards.
- Users, roles, and **task-level permissions** (hundreds of granular grants, e.g. rate override, discount ceiling, post-adjustment, check-in-with-unclean-unit, void-payment). Roles composable and scoped to org subtrees.
- Delegation, temporary elevation, four-eyes approval for defined actions.
- SSO (SAML/OIDC), MFA, session policy, IP restriction, device registration.
- **Configuration as versioned, typed, diffable data** — schema-validated, environment-promotable, diffable between properties, with rollback. Explicitly not an untyped flag soup: every setting declares type, default, dependencies, and blast radius.
- Configuration templates and inheritance down the org tree, with per-node override and override visibility.

### 5.2 Inventory & Availability
- Unit types, units, unit features/attributes, unit classes, connecting units, virtual/component units (a suite that is also two sellable rooms — must not double-sell).
- Slot model supporting nightly, hourly, day-use, and long-stay products under one abstraction.
- Availability projection by property, unit type, and date; house-level and type-level counts.
- Overbooking limits by unit type, by class, and house-wide, with date-range control.
- Sell limits, allocation to channels, and per-channel availability views.
- Out of Order (removed from inventory, affects occupancy denominator) vs Out of Service (unsellable but counted) — distinct, with reason codes and date ranges.
- **Restrictions:** open/close, closed-to-arrival, closed-to-departure, minimum and maximum length of stay, minimum/maximum advance booking, full-pattern LOS. Applicable by date range × unit type × rate plan × channel.
- Holds/options with expiry; soft holds during booking flow with automatic release.
- Real-time availability push to Distribution on every inventory-affecting event.
- Availability forecast and pace projection.

### 5.3 Rates & Offers
- Rate plan hierarchy: class → category → plan → price rows.
- Price dimensions: date range, unit type, day-of-week, occupancy tier (1/2/3/4+), extra adult, extra child by age bucket, length of stay.
- Derived rates (percentage/absolute offset from a parent plan), linked rates, dynamic rates.
- **Packages:** components with independent posting rhythm (per stay / per night / per person / per adult / per child), allowance amounts with over- and under-consumption handling, included-in-rate vs added-to-rate, and package ledger accounting (package revenue vs component cost variance).
- Policies attached to rate plans: guarantee type, cancellation window and penalty, deposit rule and maturity, no-show charge, early-departure fee.
- Negotiated rates tied to company/agent profiles, with rate access codes.
- Promotions, promo codes, and campaign attribution.
- Rate strategies: occupancy-triggered rules, competitor-triggered rules, day-of-week and season rules.
- Best-available-rate logic and rate parity monitoring.
- Yield/RMS integration surface: accept recommended rates and restrictions inbound, publish demand and pace data outbound.
- Rate audit trail — who changed which price, when, and why.

### 5.4 Reservations
- **Search and quote engine** ("look to book"): multi-criteria search, results matrix of rate plans × unit types, restriction visibility, alternate-date and alternate-property suggestions, upsell offers.
- Multi-room, multi-unit-type, and multi-segment stays (rate or unit type changing mid-stay) in one booking.
- Cart/basket semantics with holds before commit.
- Reservation record: stay dates, ETA/ETD, unit type booked vs unit type charged (distinct fields — required for upgrades), unit assignment (optional at booking), rate plan, fixed-rate flag, per-night rate overrides with authorisation.
- Statistical attribution: market segment, source, origin, channel, booker — defaulted from rate plan, independently overridable, and the basis of all revenue reporting.
- Guarantee and payment: guarantee type, payment method, tokenised card capture (no PAN ever stored), deposit schedule with maturity dates and automatic chase.
- Enrichment: preferences (inherited from profile), packages, special requests, traces (department-targeted, date-scheduled tasks), alerts (fire at defined lifecycle points), comments, attachments, transport/flight details, accompanying guests.
- **Shares** — multiple reservations occupying one unit with independent folios and configurable rate splitting.
- **Linked reservations** — travelling parties, families, multi-unit bookings with a lead reservation.
- Routing instructions defined at booking time.
- **Lifecycle:** Draft → Reserved → (Waitlisted / Tentative) → Due In → In House → Due Out → Checked Out; with Cancelled (numbered, reason-coded) and No Show branches, and permitted reinstatement subject to inventory.
- Waitlist with automatic promotion on availability.
- Modification history with full before/after diffs and attribution.
- Cancellation and no-show policy evaluation with automatic penalty posting.
- Confirmation, modification, cancellation, and pre-arrival communications via a templated multi-channel delivery layer (email, SMS, WhatsApp, print).

### 5.5 Stay Operations
- Arrivals worklist with filters: due-in, VIP, unit ready, ETA window, unassigned, deposit outstanding, incomplete profile, flagged.
- **Unit assignment:** manual, and automated by preference, feature, floor, exposure, connecting requirement, loyalty tier, and length of stay. Bulk assignment for groups.
- Pre-registration, advance check-in (checked in before unit ready, completing automatically when condition permits), and mobile/self check-in.
- Identity capture: document scan/OCR, nationality, visa data where legally required, consent capture.
- Payment authorisation with rule-based amounts (stay value + incidental buffer) and automatic top-up for extended stays and threshold breaches.
- Registration card generation and digital signature capture.
- Key encoding via lock interfaces; mobile key issuance.
- **Queue management** — guests waiting on units, prioritised to housekeeping with elapsed timers and escalation.
- Check-in commit: status transition, folio open, interface enablement (POS posting, PBX, Wi-Fi, TV, minibar).
- In-stay: unit moves (with or without charge transfer, full move history), stay extension and shortening with re-quote, rate changes, occupancy changes, package changes, upgrade/downgrade.
- Guest requests and service tickets with SLA tracking, wake-up calls, messages, locators, DND/service-refused, lost and found.
- Departure: interim folio presentation, per-window settlement, early departure with fee, late checkout with charge or comp, express checkout, group mass checkout, auto-checkout at day close, checkout with balance transferred to AR (permission-gated).

### 5.6 Housekeeping & Assets
- **Two independent status axes:** condition (Clean / Dirty / Pickup / Inspected) and occupancy (Vacant / Occupied). Plus OOO/OOS as a third orthogonal state.
- Housekeeping board: unit grid filterable by floor, section, condition, departure/stayover, VIP, arrival priority.
- **Task sheet generation** with credit weighting (departure vs stayover vs refresh), allocation by section/floor/attendant capacity, target credits per attendant, and automated balancing.
- Mobile attendant app: task list, start/stop timers, condition updates, issue reporting with photos, offline capable.
- Supervisor inspection workflow and pass/fail with re-clean.
- **Discrepancy detection and reconciliation** (sleeps and skips) before day close.
- Facility management: scheduled linen change, deep clean, turndown, preventive maintenance driven by length-of-stay and calendar rules; green/reuse programmes.
- Work orders and maintenance: raise, assign, track, escalate, close; link to OOO/OOS periods; asset register with warranty and service history.
- Lost and found with matching and disposal workflow.
- Minibar and consumable posting from mobile.

### 5.7 Financials
- **Folio model** with 8+ independent billing windows per stay, each independently settleable.
- **Transaction codes**: hierarchy of groups → subgroups → codes, each with revenue classification (USALI-aligned), tax treatment, ledger mapping, and generates-inclusive-tax flags.
- **Posting engine:** automatic (accommodation and tax at day close, fixed recurring charges, package elements), interface-driven (POS, PBX call accounting with markup, minibar, spa, parking, laundry), and manual with reason and reference.
- **Immutable postings.** Same-business-date reversal is a correction; prior-date is an adjustment posting a compensating entry with reason code. Nothing is ever deleted.
- **Routing:** transaction-code-level routing to another window, another stay, a group master, or an AR account. With authoriser, limit, and date range.
- Splits, transfers, and moves between windows and folios, with full traceability.
- Discounts, comps, and allowances with authorisation ceilings by role.
- **Payments:** tokenised card (auth, incremental auth, capture, refund, void), cash, cheque, bank transfer, digital wallets, regional methods, gift cards, vouchers. PCI DSS scope minimisation — PAN never enters the application.
- Deposits: request, receipt, maturity tracking, application at check-in, forfeiture, refund. Deposit ledger.
- **Ledgers:** Guest, Deposit, Package, and Accounts Receivable/City. Trial balance across all.
- Cashier sessions: open, post, settle, foreign exchange with rate capture, paid-outs, petty cash, drawer count, close, and cashier report. Unclosed cashiers block day close.
- Credit control: per-window credit limits, high-balance report, authorisation sufficiency monitoring, automated top-up.
- **Accounts Receivable:** accounts tied to profiles, invoice creation from transferred folios, aging, statements, payment application and allocation, dunning cycles, credit notes, write-offs, credit limits, commission handling for agents.
- **Day close (continuous, not blocking):** the financial day boundary is a logical projection cut, not a system freeze. Accommodation and tax post on a scheduled per-property trigger; statistics finalise; the business date rolls; the system never becomes unavailable. Pre-close validations (unresolved arrivals/departures, open cashiers, condition discrepancies, interface backlogs) surface continuously through the day as a live readiness dashboard rather than as a blocking gate at 3 AM.
- Reconciliation reports, ledger balance proofs, and a hard "books closed" seal per business date after which only adjustments (never edits) are possible.
- General ledger export to external accounting systems, with mapping configuration.

### 5.8 Profiles & CRM
- Profile types: Guest, Company, Travel Agent, Source, Group, Vendor, Contact.
- Relationships and hierarchies: parent company → subsidiaries, agent → consortium, contact → account, with inherited negotiated rates and credit terms.
- Per profile: addresses (multiple, typed), communication channels, preferences (typed and inheritable to reservations), memberships and loyalty tiers with points accrual/redemption, negotiated rates, notes, alerts, attachments, credit rating, commission terms.
- Stay and revenue history with lifetime value, ADR, and segment analysis.
- **Duplicate detection** on fuzzy match across name, contact, document, and card token; merge workflow with history, ledger, and future-reservation consolidation and full reversibility record.
- Blacklist/do-not-accommodate with reason and authorisation.
- **Data protection:** consent capture per purpose, purpose limitation enforcement, retention schedules with automated purge, right-to-erasure anonymisation preserving financial record integrity, data export/portability, processing register, and cross-border transfer controls.
- Guest communication history and campaign integration.

### 5.9 Groups & Events
- Block creation: code, account, contact, dates, block type, market/source, reservation method (rooming list / call-in / individual), cutoff date or rolling cutoff days.
- **Status lifecycle** — Inquiry → Tentative → Definite → Actualised → Cancelled/Lost/Refused — with per-status *inventory deduction behaviour as configuration, not code*.
- Room and rate grid: unit types × dates showing original / contracted / blocked / picked-up / remaining, with per-date per-type rates.
- **Wash schedules** — automatic staged reduction of unpicked allotment on a date schedule.
- Elastic vs non-elastic blocks (pickup beyond grid from house availability).
- Rooming list import (spreadsheet and API) with validation and bulk reservation creation.
- Cutoff processing returning unpicked inventory to house.
- Group master folio with routing of defined charge types from member stays; individual incidentals retained on guest folios.
- Group arrival: bulk assignment, mass check-in, bulk key generation, welcome-desk mode.
- Block performance: pickup pace, wash accuracy, realised vs contracted.
- **Function space and catering:** space inventory, setup styles and capacities, bookings with setup/teardown buffers, banquet event orders, menus, resources, and event billing to the master folio.

### 5.10 Distribution
- Channel mapping: unit type and rate plan mapping per channel, with validation and drift detection.
- **ARI push** — availability, rates, and restrictions, event-driven and near-real-time, with delta batching and per-channel throttling.
- Inbound booking ingestion with idempotency, mapping resolution, and a **worked error queue** for unmappable or conflicting messages.
- Modification and cancellation ingestion with conflict resolution against local changes.
- Connectors: OTAs, GDS via a switch, wholesalers, metasearch, and existing channel managers (RateGain for hotels; Rentals United / Hosthub for short-term rental).
- **Direct booking engine:** availability search, upsell, package selection, payment, confirmation; embeddable and white-labellable; multi-property and multi-language.
- Rate parity monitoring and violation alerting.
- Commission tracking and reconciliation per channel.
- Channel performance analytics: production, ADR, cancellation rate, cost of acquisition.

### 5.11 Tax & Compliance
- **Rules-driven tax engine:** multiple concurrent taxes and fees, inclusive and exclusive, percentage and flat, per-night/per-stay/per-person, threshold- and tier-based (e.g. rate-band-dependent GST), exemptions by guest type and document, and compounding order.
- Jurisdiction resolution by property with effective-dated rule versions.
- Fiscal document issuance: sequential immutable invoice numbering per series, credit notes, and required document formats.
- **E-invoicing / fiscalisation integrations:** ZATCA (Saudi Arabia), UAE, India GST e-invoice/IRN, EU country regimes, with a pluggable provider interface so new jurisdictions are configuration plus a connector, not a rewrite.
- Statutory guest registers, police/immigration reporting (regionally variable formats), and tourism/city tax returns.
- Audit export packs in jurisdiction-required formats.
- Retention and immutability guarantees satisfying tax law (typically 5–10 years).

### 5.12 Reporting & Analytics
- Operational: arrivals, departures, in-house, unit status, discrepancies, task sheets, traces, queue, credit, high balance, cashier, deposits due, no-show.
- Financial: trial balance, ledger summaries, revenue by transaction group, tax summary, package variance, AR aging, commission due.
- Statistical (USALI-aligned): occupancy, rooms sold, ADR, RevPAR, TRevPAR, GOPPAR inputs, by segment/source/channel/rate plan, with pace and pickup.
- Forecasting: occupancy and revenue forecast, group pace, wash-adjusted projections, staffing forecast from arrivals/departures/stayovers.
- Manager dashboards, flash reports, and scheduled distribution.
- Custom report builder and full data export/BI feed.
- **Natural-language querying** over the event log and projections.

### 5.13 Platform & Integration Surface
- **API-first, without exception:** every capability exposed in the UI is a public, documented, versioned API. The UI is a first-class API consumer with no privileged path. This is the primary lever for building integration gravity.
- Webhooks with subscription management, retry, and replay.
- **Interface layer** for on-property hardware and systems: door locks, POS, PBX/call accounting, TV/entertainment, Wi-Fi/network access control, energy management, minibar, spa/golf/activity systems, digital signage, kiosk, ID scanners, payment terminals. Adapter pattern with a certification harness per vendor.
- **Migration tooling as a first-class product:** import from incumbent PMSes with profile, reservation, folio history, AR balance, and configuration mapping; dry-run with reconciliation report; staged cutover; rollback. Treat this as a product feature with a UI, not a services engagement.
- Extension model: tenant-authored scripts/rules at defined hook points, sandboxed.

---

## 6. Non-Functional Requirements

| Concern | Target |
|---|---|
| Availability search (cached) | p99 < 50 ms |
| Availability search (cold) | p99 < 200 ms |
| Reservation write | p99 < 300 ms |
| Screen interaction (perceived) | < 100 ms; no spinner under 300 ms |
| ARI push latency | < 5 s from inventory event |
| Uptime | 99.95%, no scheduled downtime for day close |
| Offline front desk | Check-in, checkout, and posting continue through network loss with reconciliation on restore |
| Recovery | RPO < 1 min, RTO < 15 min |
| Cost | A 50-property tenant servable on commodity hardware |
| Audit | 100% of mutations attributable and reconstructible |
| Accessibility | WCAG 2.2 AA |
| i18n | Full RTL, multi-language, multi-currency, multi-calendar (incl. Hijri) |

---

## 7. UI Directives

Design from first principles. Do not reference incumbent screen layouts. But adopt the one thing incumbents get right: **density is correct for this user**.

- **Users are keyboard-driven power users under time pressure.** A front desk agent checking in a 200-room group needs throughput, not whitespace. Most modern PMS UIs lose to older ones on task completion time because they optimised for the demo.
- **Keyboard-first:** command palette, global shortcuts, strict tab-order discipline, type-ahead everywhere, no mouse required for any core workflow.
- **Dense virtualised data grids** for the screens people live in: tape chart, availability grid, arrivals, housekeeping board, folio.
- **Progressive disclosure, not buried depth.** All the information, one keystroke away.
- **Optimistic updates and prefetch.** Perceived speed is the product.
- **Role-shaped surfaces over one API:** housekeeping mobile, front desk desktop, manager dashboard, guest-facing web. Genuinely different applications, not one responsive layout.
- **Real-time by default:** availability, folio state, and unit condition push over websockets.

Use the `ui-ux-pro-max` skill for visual direction, palette, typography, and component patterns when implementation begins.

---

## 8. Intelligence Layer

The structural advantage of a 2026 build over a 1996 codebase. Not a chatbot bolted on — capabilities that require the event log and modern inference:

- Price and restriction recommendations from demand, pace, and event signals.
- Overbooking risk scoring and no-show probability per reservation.
- Arrival-flow prediction for staffing and queue management.
- Anomaly detection on postings, adjustments, and cashier activity (fraud and error surfacing).
- Automated unit assignment optimisation across preferences, upgrades, and housekeeping efficiency.
- Natural-language reporting and operational querying.
- Guest message drafting and multilingual communication.
- Housekeeping route and credit optimisation.

---

## 9. Delivery Sequencing

Architecture assumes the complete domain from day one. Build order gets properties live early so priorities come from operators.

- **Phase 0 — Foundations:** primitives (§4), tenancy, org tree, identity, config framework, event bus, audit.
- **Phase 1 — Sellable core:** Inventory & Availability, Rates, Reservations, Profiles, Folio/Posting/Ledger, Stay Operations, basic Housekeeping, day close. *Milestone: one real property operating.*
- **Phase 2 — Commercially viable:** Payments, Tax & Compliance for launch jurisdictions, Distribution + booking engine, full Housekeeping, Groups/Blocks, routing and windows, core reporting. *Milestone: ten properties, paying.*
- **Phase 3 — Enterprise:** AR, packages with allowance accounting, multi-property consolidation, hardware interfaces, migration tooling, RMS hooks, analytics warehouse.
- **Phase 4 — Moat:** intelligence layer, function space/catering, loyalty, forecasting, additional jurisdictions, certification programme (PCI DSS L1, SOC 2, ISO 27001).

---

## 10. Open Decisions

To be resolved before implementation. Each carries a default position if unresolved.

1. **Frontend framework and rendering model.** Default: React + TanStack Router/Query, SPA with aggressive prefetch.
2. **Event infrastructure.** Default: Postgres-backed outbox + LISTEN/NOTIFY; defer Kafka/NATS until volume demands it.
3. **Depth of event sourcing.** Default: event-sourced for Financials and Inventory; conventional state + audit elsewhere.
4. **Offline strategy.** Default: local-first write queue on the front desk client with server reconciliation.
5. **Availability engine language.** Default: TypeScript behind a pure interface; Rust port only on profiler evidence.
6. **Payments approach.** Default: orchestration layer over multiple regional PSPs rather than a single provider.
7. **Deployment target.** Default: containerised, cloud-agnostic, single-tenant-deployable for enterprise.
8. **Extension model.** Default: defer to Phase 3.
9. **Monorepo tooling and module boundary enforcement.** Default: Bun workspaces + dependency-cruiser rules.
10. **First jurisdiction for tax/fiscal depth.** Default: UAE + Saudi (ZATCA), then India GST.

---

## 11. How to Use This Prompt

For any implementation or design session, supply:
1. This document (or the relevant §5 subsection).
2. The bounded context being worked on and its published interface.
3. The resolved decisions from §10.
4. The ADR log to date.

**Standing instructions for the assistant:**
- Design from the operational requirement, never from an incumbent's implementation.
- Produce an ADR for every non-obvious decision.
- Types before code; schema before types; entities and events before schema.
- Assume the complete domain when modelling, even when implementing a subset.
- Flag any requirement that appears to conflict with an earlier decision rather than silently resolving it.
- Financial correctness beats every other consideration, including performance and elegance.
