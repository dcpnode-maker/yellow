# Order 014 — Yellow V1 Interactive Hospitality OS Prototype

## Mission

Build a production-quality **interactive prototype shell** that proves Yellow's operating language before deeper feature implementation.

Read first, in this order:

1. `PROJECT.md`
2. `docs/UI-SPEC.md`
3. `docs/YELLOW-ARCHITECTURE-V1.md`
4. `BUILD-PLAN.md` (Phase 10 UI intent only; do not advance project phase)
5. `DECISIONS.log` entries relevant to UI, command palette, PWA, property switcher, guest, reservation, folio, housekeeping and revenue.

## Why this order exists

The existing static prototype demonstrated only a small portion of the product surface. This order must prove a UI model capable of containing hundreds of hospitality capabilities without becoming a menu maze.

The prototype should feel like one living operating system, not separate PMS/CRM/RMS modules.

## Scope

Allowed:

- new prototype-only frontend files/directories
- prototype-only fixtures / mock data
- prototype-only client-side state
- UI components supporting the surfaces below
- documentation for running the prototype
- tests that validate navigation/state/interaction behavior

Do not modify:

- `migrations/0001_init.sql`
- any production table/schema
- occupancy logic
- financial/journal logic
- RLS/tenant rules
- production state machines
- existing API contracts
- production event definitions

If the prototype appears to require a production schema/API/state transition change, STOP and write a question in `handoff/questions/`.

## Prototype surfaces

### 1. Big Picture / Property Health

Default home surface. Minimal persistent chrome. Must summarize operational, guest, revenue, financial, distribution, housekeeping/maintenance and AI/automation health.

Every tile supports progressive disclosure into the relevant workbench.

### 2. Arrivals / Departures / In-house

Operational boards with configurable columns and realistic state badges. Opening a row follows PEEK -> DRAWER -> WORKBENCH behavior.

### 3. Grid / Tape Chart

Interactive spaces x dates view. Must demonstrate room status, booking source, guest name, stay status, quick peek and reservation drawer without modal stacking.

### 4. Reservation Workspace

Demonstrate:

- guest(s)
- source/channel
- dates
- room/unit
- rate and policies
- travel details
- notes/alerts
- payment/deposit summary
- messages
- actions
- audit/timeline

Use progressive disclosure. Do not try to place all fields on the first view.

### 5. Guest 360

A single guest identity surface demonstrating relationships to reservations, stays, folios/payments, conversations, preferences, companions/company, requests/issues and lifetime history.

### 6. Folio / Payment Workbench

Prototype the interaction language only: ledger rows, balance, folio windows/tabs, settlement status, payment summary, reversal/correction terminology. No real financial logic.

### 7. Unified Inbox

One conversation surface spanning mock WhatsApp, email, website chat and OTA messages. Show AI draft/routing context tied to the canonical guest/reservation.

### 8. Housekeeping / Operations

Role-aware mobile-friendly task view plus control view. Show room readiness, priority, arrival dependency, inspection and discrepancy state.

### 9. Revenue + Comp Advantage

Not a rate-shopper page. Show:

- market posture
- property posture
- pickup/pace
- comp movement
- recommendation
- reason/evidence
- expected impact
- actual-result placeholder
- approve/execute workflow

### 10. AI Agent Control Center

Show specialized agents, current tasks, proposed actions, approvals, execution history and explanations. AI must appear as an operational workforce using the same command model as humans.

### 11. Universal Command / Voice Surface

Cmd/Ctrl+K plus visible mobile equivalent. Example intents:

- “move 204 to 310”
- “show arrivals missing statutory data”
- “why is next Wednesday weak?”
- “message Sara that room 512 is ready”

Voice is represented as the same command pipeline, not a separate feature.

### 12. Property Configuration

Demonstrate how deep customization remains discoverable without filling the main navigation: property model, terminology, fields, workflows, policies, roles, integrations and AI permissions.

## Navigation rule

Do not build a huge left-menu containing every domain.

Persistent navigation should expose only the highest-level operating surfaces. Everything else must remain reachable through context, search, command, drill-down, role-aware shortcuts or progressive disclosure.

## Data model in prototype

Use a single realistic fixture graph so the same guest/reservation/property context appears consistently across screens. Avoid isolated demo data per page.

At minimum create interconnected mock entities for:

- 1 organization
- 2 properties
- 20+ spaces
- 12+ guests
- 20+ reservations across direct/OTA/GDS/walk-in/phone/email/WhatsApp
- stays / folio summaries / messages / tasks / housekeeping status
- revenue observations and comp signals
- agent tasks/decisions

## Interaction requirements

- responsive desktop + phone
- no modal-over-modal
- deep-link-like client routes or route state
- browser back preserves conceptual surface hierarchy where practical
- keyboard navigation demonstrated
- click/tap parity
- command palette demonstrated
- progressive disclosure throughout
- no dead buttons in the primary demo path

## Primary demo path

A reviewer must be able to complete this coherent journey:

`Big Picture -> Arrivals -> Reservation -> Guest 360 -> Folio -> Message -> Grid -> Housekeeping -> Revenue/Comp Advantage -> Ask Yellow -> Agent action preview`

without losing guest/property context.

## Visual intent

High information density without visual noise. Fast professional software, not a generic admin dashboard. The design should feel calm, obvious and highly responsive.

Avoid copying any named product's visual design. Borrow principles, not appearance.

## Performance intent

Prototype interactions should feel instant. Keep dependencies light. Prefer existing stack/dependencies in the repo. Do not add a large component framework merely to accelerate mockup work.

## Deliverables

1. interactive prototype in the repo
2. short `README` with run command and demo path
3. coherent fixture graph
4. interaction/navigation tests where practical
5. screenshots optional; working prototype is authoritative
6. PR describing what is real vs mocked and listing unanswered architecture questions

## Definition of Done

- primary demo path is fully clickable
- phone and desktop are usable
- same fixture entities remain consistent across surfaces
- no production database/schema/state-machine changes
- no modal stacking
- command palette works with several fixture intents
- AI/Comp Advantage surfaces show evidence -> recommendation -> action flow
- reviewer can discover deeper capability without a giant navigation tree
- existing project checks remain green for files touched by this order

## Stop conditions

Stop and write a question instead of inventing a production rule if work touches:

- migrations / new production tables
- occupancy claims
- journal/posting behavior
- fiscal chains
- RLS / tenant scoping
- new production state transitions
- new production events

This order is intentionally a prototype contract. Its purpose is to let the founder approve the operating experience before the architecture is expanded around it.
