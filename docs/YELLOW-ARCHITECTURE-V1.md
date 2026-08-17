# Yellow Architecture V1 — Hospitality Operating System Blueprint

Status: working blueprint for the interactive V1 and subsequent implementation.  
Authority: `PROJECT.md` remains canonical. If this document conflicts with `PROJECT.md`, `PROJECT.md` wins.

## 1. Product thesis

Yellow is not a collection of PMS modules. It is one hospitality operating system where guest, property, staff, money, inventory, communication, distribution and AI operate over the same canonical domain model.

The user experience must be **simple at first glance, infinite on demand**. A new receptionist, a GM, an owner, a revenue manager, a guest and an AI agent should all interact with the same underlying system through different surfaces and permissions.

Primary interaction modes are equivalent interfaces to the same command layer:

- click / tap / touch
- keyboard
- command palette
- voice
- API
- AI agent

No interface receives privileged business logic. Every consequential action maps to the same validated application command and produces the same audit/event trail.

## 2. Core design law

> Infinite capability. Finite primitives.

Yellow expands by composing stable primitives instead of adding isolated modules. The initial canonical graph is:

`Organization -> Property -> Space -> Sellable Inventory`

`Party/Guest -> Reservation -> Stay -> Folio -> Payment`

with relationships to:

`Rate`, `Policy`, `Message`, `Task`, `Document`, `Asset`, `Workflow`, `Event`, `Agent`, `Integration`, `Company`, `Channel`, `Group`, `Owner`.

The existing database and context boundaries remain authoritative until changed through the repo decision process.

## 3. One graph, many workspaces

Yellow must never require a user to mentally stitch together separate CRM/PMS/housekeeping/revenue systems.

A guest workspace can reveal, progressively:

- identity and contact graph
- reservations and stays
- folios, payments and documents
- preferences, consents and statutory details
- companions, companies and travel agents
- conversations across channels
- requests, complaints, incidents and tasks
- loyalty / segmentation / lifetime value
- AI summaries and recommendations
- complete audit timeline

A property workspace can reveal:

- operational health
- revenue health
- financial health
- guest health
- distribution health
- housekeeping / maintenance health
- compliance readiness
- AI/automation health

The default view shows only what matters now; deeper information is available through progressive disclosure.

## 4. Surface model

Retain `docs/UI-SPEC.md` as the UI contract and extend its philosophy:

1. **PEEK** — immediate read-only context.
2. **DRAWER** — common actions on one entity while preserving surrounding context.
3. **WORKBENCH** — deep operational work.
4. **COMMAND** — natural-language/keyboard/voice entry into the same application command layer.
5. **BIG PICTURE** — role-aware operational health view with drill-down into any entity or decision.

No modal-over-modal flows. No dead-end pages. No state loss. Every meaningful entity/workbench is deep-linkable.

## 5. Capability research model

Yellow will not copy product feature lists. Every discovered capability from hospitality, CRM, ERP, RMS, distribution, ecommerce, workflow, finance, logistics, trading, consumer UX or AI systems is normalized as:

1. Problem solved
2. User intent
3. Current industry implementation
4. Best documented implementations
5. Entities involved
6. State transitions
7. Edge cases
8. Failure/bug patterns
9. Regulatory implications
10. Automation opportunity
11. AI opportunity
12. Performance requirement
13. Reliability requirement
14. Cost / dependency profile
15. Open-source / self-build alternatives
16. Yellow-native design

Official documentation and specifications are primary evidence. Public bugs, GitHub issues, operator reports and forums are used to discover failure modes and hidden edge cases; consequential claims must be verified where possible.

## 6. Hospitality domains to cover

The research/build surface is intentionally larger than a PMS:

- PMS / stay operations
- CRS / reservation services
- booking engine / direct web conversion
- channel management / OTA / GDS / metasearch
- RMS / pricing / forecasting / restrictions
- Comp Advantage / market surveillance
- CRM / CDP / loyalty / marketing
- guest communications / contact centre / voice
- housekeeping / laundry / lost & found
- maintenance / engineering / assets
- groups / blocks / MICE / events
- payments / deposits / chargebacks
- native hotel finance / AR / AP / ledger / audit
- tax / fiscalisation / statutory reporting
- owner / STR / serviced-apartment workflows
- procurement / inventory / workforce extensions
- reporting / BI / forecasting
- workflow / rules / approvals
- developer platform / APIs / webhooks / extensions
- AI agents and human-agent collaboration

Scope is not removed to reduce cost. Architecture must make scope economical.

## 7. Guest journey principle

Guest-facing Yellow must optimize for an agreeable flow for the largest reasonable population, while remaining accessible and configurable.

The journey is continuous:

`discover -> evaluate -> book -> confirm -> pre-arrival -> arrive -> stay -> request/service -> pay -> depart -> review -> return`

The guest should not need to know which hotel department owns a request. Yellow resolves intent internally and routes/executes work.

Information already known to the ecosystem should not be requested again unless law, security or freshness requires it.

## 8. Staff journey principle

Staff should think in outcomes, not modules.

Examples:

- “Check in Sara.”
- “Move 204 to 310.”
- “Why are bookings weak next Wednesday?”
- “Show unresolved departures with balances.”

Yellow resolves the command, checks permissions/guards, previews material consequences when required, executes deterministically, records facts/events and updates every affected surface.

## 9. AI operating model

AI is a reasoning/orchestration layer, never the source of transactional truth.

Initial agent families:

- Reservation Agent
- Front Office Agent
- Guest Service Agent
- Housekeeping Agent
- Revenue Agent
- Distribution Agent
- Comp Advantage Agent
- Finance Agent
- Marketing/CRM Agent
- Maintenance Agent
- Compliance Agent
- General Manager Agent

Agents must use the same contracts as humans and integrations. High-impact actions require policy-controlled authorization/approval. Every material automated decision must be attributable, observable and explainable.

The desired commercial loop is:

`observe -> understand -> predict -> decide -> execute -> measure -> learn`

## 10. Comp Advantage

Comp Advantage is a layer above individual revenue agents. It continuously assembles external and internal market state, including when legally and technically available:

- competitor price/inventory/promotion movement
- booking pace and pickup
- cancellation / lead-time / LOS changes
- channel performance and net contribution
- market compression
- events and holidays
- demand signals
- ranking / review / reputation movement
- historical elasticity and strategy outcomes

It produces strategy, not just rate shopping. Every change should be traceable to evidence and measured against actual outcome.

## 11. Performance and cost doctrine

The existing repo performance budgets remain gates. Additional principles:

- modular monolith by default
- PostgreSQL remains transactional authority
- aggressively minimize network hops
- materialize/read-optimize where evidence warrants it
- use caches as disposable projections, never truth
- prefer OSS/permissive dependencies where they meaningfully outperform self-build
- self-build narrow critical capabilities when dependency cost, lock-in, latency or scope loss is unacceptable
- measure before adding infrastructure

Every millisecond, query, byte, service and dependency must justify its existence.

## 12. Extensibility doctrine

> Configuration is data. Customization is composition. Code forks are last resort.

A property should be able to vary terminology, fields, forms, workflows, approvals, taxes, documents, policies, rates, housekeeping states, reports, messages, roles and integrations without forking Yellow.

When a legitimate requirement cannot be represented, treat it first as evidence of a missing primitive or extension point. Expand the platform model coherently rather than hiding the requirement.

## 13. Immediate V1 prototype objective

The first interactive prototype is not feature-complete software. It must prove the operating language that can contain the full system.

It must include realistic, clickable demonstrations of:

- Big Picture / Property Health
- Arrivals / Departures / In-house
- Grid / tape chart
- Reservation drawer + workbench
- Guest 360 graph
- Folio / payment workbench
- Unified inbox
- Housekeeping / task control
- Revenue + Comp Advantage
- AI Agent Control Center
- Universal command/voice interaction
- Property configuration / progressive disclosure
- Role-aware navigation with minimal persistent menu surface

The prototype must make additional depth visibly discoverable without presenting hundreds of permanent menu items.

## 14. Acceptance philosophy

A Yellow surface is successful when a user can answer:

- What is happening?
- What needs attention?
- Why?
- What can I do now?
- What happened after I acted?

without learning the internal module architecture.

The system may be extremely deep, but it must feel natural.

## 15. Non-negotiable relationship to the existing kernel

This blueprint does not override the Ten Invariants, state machines, contracts, event rules, immutable financial/occupancy design or tenant isolation in the current repository. Interactive prototype work must not mutate the database baseline or invent new production state transitions. Any later architecture change follows the normal `DECISIONS.log` and review process.
