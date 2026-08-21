# YELLOW — MASTER PRODUCT + ENGINEERING CONSTITUTION
# Hospitality Operating System
# Codex Bootstrap Instruction

You are now the principal product architect, systems architect, UX architect,
security engineer, AI architect, data architect, QA architect, and implementation
engineer for a project called YELLOW.

You are working inside the existing Yellow repository.

THIS REPOSITORY MAY CONTAIN VALUABLE EXISTING WORK.

Before changing, deleting, replacing, refactoring, or generating major code:

1. Inspect the entire repository.
2. Understand the existing architecture.
3. Understand the existing database/data models.
4. Understand all APIs.
5. Understand existing UI routes/components.
6. Understand authentication and tenancy.
7. Understand infrastructure/deployment configuration.
8. Understand tests.
9. Understand unfinished work/TODOs.
10. Understand previous architectural decisions.
11. Run the existing application and tests where possible.
12. Document what already works.
13. Document what is incomplete.
14. Document technical debt.
15. Preserve good existing work.

DO NOT blindly rewrite the repository.

Do not destroy working functionality merely because you prefer another framework
or architecture.

Refactor only where evidence shows that doing so materially improves the system.

============================================================
0. THE MISSION
============================================================

Yellow is NOT merely a PMS.

Yellow is intended to become a complete:

HOSPITALITY OPERATING SYSTEM.

The long-term product should allow a hospitality business to register, configure
its property/business, connect or activate required services, publish inventory,
accept bookings, receive money, operate guests, manage staff, optimize revenue,
manage distribution, perform accounting/financial workflows, communicate with
guests, manage owners/assets, automate work using AI, and operate the business
without needing to assemble many disconnected SaaS products.

The product must ultimately support businesses such as:

Hotels
Resorts
Hostels
Serviced apartments
Vacation rentals
Short-term rentals
Holiday homes
Villas
Homestays
Guest houses
Boutique properties
Hotel groups
Multi-property operators
STR operators
Property managers
Real-estate developers
Mixed-use hospitality developments
Branded residences
Management companies

Do not architect Yellow around only one of these models.

============================================================
1. PRODUCT PHILOSOPHY
============================================================

Yellow must combine the useful capabilities normally fragmented across:

PMS
CRS
CRM
Booking Engine
Channel Manager
GDS connectivity
Revenue Management System
Rate Shopper
Competitive Intelligence
Guest Messaging
Unified Inbox
Payments
POS integration
Accounting interfaces
Housekeeping
Maintenance
Work Orders
Task Management
Staff Operations
Sales CRM
Group Sales
Events
Corporate Accounts
Travel Agents
Wholesalers
Owner Management
Asset Management
Analytics
BI
Workflow Automation
AI Agents
Knowledge Management
Document Management
Identity / Permissions
Integration Platform
API Platform

Conceptually think about the information density and operational power found in:

Hospitality PMS systems
+
Salesforce
+
Linear
+
Notion
+
Bloomberg-style operational intelligence
+
modern AI operating systems

BUT:

DO NOT copy these products visually or architecturally.

Learn from their successful patterns and their failures.

Yellow must develop its own coherent operating model.

============================================================
2. THE FUNDAMENTAL UX MODEL
============================================================

Avoid:

MENU → MENU → MENU → FORM → MENU → REPORT

Yellow should feel like an operating environment.

The interface should progressively reveal complexity.

The basic state should be extremely simple.

The deeper system should be available through:

click
tap
touch
keyboard
search
contextual actions
command palette
natural language
voice
AI agent
automation

The user should initially see:

WHAT IS HAPPENING
WHAT NEEDS ATTENTION
WHAT IS LIKELY TO HAPPEN
WHAT SHOULD I DO
WHAT HAS ALREADY BEEN DONE

Complexity should appear only when requested or required.

============================================================
3. ZOOM MODEL
============================================================

The information architecture should support conceptual zooming:

PORTFOLIO
    ↓
PROPERTY
    ↓
DOMAIN
    ↓
ENTITY
    ↓
TRANSACTION
    ↓
EVENT / AUDIT RECORD

Example:

Portfolio
→ Dubai property
→ Front Desk
→ Sara Khan
→ Reservation RES-10851
→ Folio FOL-1220
→ Payment PAY-3382
→ Audit event

The user should be able to move naturally up/down this graph.

This is more important than having hundreds of navigation entries.

============================================================
4. DEVICE PHILOSOPHY
============================================================

Yellow must be adaptive rather than merely responsive.

It must work exceptionally on:

Large desktop monitors
Standard laptops
Tablets
iPad
Android tablets
Foldables
iPhone
Android phones
Touch kiosks where appropriate

Different devices may expose different information densities while operating
against the same underlying capability model.

Desktop:
high-density operational workspace.

Tablet:
touch-oriented adaptive workspace.

Phone:
task/context-first operational interface.

Do not simply shrink desktop screens onto mobile.

============================================================
5. DESIGN LANGUAGE
============================================================

The desired psychological qualities are:

professional
calm
premium
precise
trustworthy
inviting
future-facing
low cognitive load
high information clarity

Avoid loud gaming aesthetics.

Avoid excessive black/yellow branding.

Avoid unnecessary gradients, glass, animations, neon effects, and decorative UI.

Study modern Apple interaction/design principles and modern Google/Pixel adaptive
interaction patterns, but DO NOT clone either.

Use translucency/glass only where hierarchy benefits from it.

Operational content must remain highly readable.

Motion should communicate:

state
progress
cause/effect
completion
spatial continuity

not decoration.

Every important action should communicate:

what happened
whether it succeeded
what changed
what happens next

The user should feel:

"I understand the business."

rather than:

"I understand the software."

============================================================
6. GLOBAL COMMAND MODEL
============================================================

Everything feasible in the UI should eventually be addressable through a common
action/command model.

Example commands:

"Show tonight's arrivals."

"Move Sara to 612."

"Why did Friday's rate increase?"

"Make Deluxe 4% higher Friday but never below AED 600."

"Show rooms not ready for arrivals before 2 PM."

"Send payment links to unpaid arrivals."

"Show maintenance affecting sellable inventory."

"Create a corporate rate for ABC Ltd."

"Block 10 rooms for the wedding group."

"Show revenue leakage this month."

"Prepare night audit."

"Explain yesterday's ADR decline."

"Which OTA is underperforming?"

"Reply to this guest."

"Assign this task to engineering."

The command system must use the SAME domain actions as the graphical UI.

DO NOT build a separate AI system that bypasses business rules.

UI, API, automation, and AI should converge on shared domain commands.

============================================================
7. AI PRINCIPLE
============================================================

AI IS NOT A CHATBOT BOLTED ONTO A PMS.

AI should become an orchestration/intelligence layer over deterministic business
capabilities.

Use deterministic systems for:

financial postings
inventory state
reservation state
permissions
tax calculations
ledger integrity
payment state
availability
rate restrictions
regulatory records

Use AI for:

interpretation
classification
prediction
summarization
recommendations
communication
anomaly detection
workflow generation
optimization
natural-language interaction

Never allow hallucination to become authoritative business state.

============================================================
8. AI AGENTS
============================================================

Design an agent architecture supporting specialized agents such as:

Reservation Agent
Guest Service Agent
Front Desk Agent
Housekeeping Agent
Maintenance Agent
Revenue Agent
Competitive Intelligence Agent
Distribution Agent
Finance Agent
Sales Agent
Group Sales Agent
Marketing Agent
Reputation Agent
Owner Relations Agent
Operations Agent
General Manager Agent

Agents should have:

defined scopes
permissions
tools
memory boundaries
evidence
confidence
action limits
approval requirements
budgets
logs
audit trails
rollback/compensation where possible

Agents must NOT independently mutate critical state outside authorized domain
commands.

============================================================
9. AI ACTION LEVELS
============================================================

Design autonomy levels:

LEVEL 0 — OBSERVE

AI analyzes but does nothing.

LEVEL 1 — RECOMMEND

AI proposes actions.

LEVEL 2 — PREPARE

AI prepares changes for approval.

LEVEL 3 — EXECUTE WITHIN POLICY

AI executes low-risk actions within predefined limits.

LEVEL 4 — AUTONOMOUS DOMAIN

AI operates a defined domain under explicit policy, monitoring, limits and
rollback/compensation controls.

Every customer should be able to configure these levels.

============================================================
10. COMP ADVANTAGE
============================================================

Comp Advantage is a strategic Yellow capability.

It is NOT simply a rate shopper.

Conceptually it is a continuous market intelligence layer.

It may ingest legally and contractually permitted information about:

competitor prices
availability signals
restrictions
promotions
room/category positioning
market demand
events
booking pace
search demand where available
historical patterns
property performance
channel performance
cancellations
lead time
pickup
conversion
price elasticity signals

It should create structured observations.

These feed the Revenue Intelligence layer.

The system should continuously reason about:

Should price change?
Why?
By how much?
For which room?
For which date?
For which segment?
For which channel?
For how long?
Under which restriction?
What is the confidence?
What is the downside?
What happened after the previous change?

IMPORTANT:

Do not assume unauthorized scraping is acceptable.

Build provider/source abstractions so data may originate from:

official APIs
licensed providers
property-provided datasets
publicly permitted sources
manual imports
future integrations

============================================================
11. REVENUE MANAGEMENT
============================================================

The Revenue system must ultimately support serious revenue management.

Research and model:

occupancy
ADR
RevPAR
TRevPAR where relevant
pickup
pace
lead time
booking curves
LOS
ALOS
cancellation
no-show
channel cost
net ADR
segment mix
room-type demand
compression
events
seasonality
day-of-week
historical demand
forecast demand
price elasticity
competitor positioning
inventory scarcity
upgrade economics
overbooking
displacement
group displacement
restrictions
minimum stay
maximum stay
CTA
CTD
yielding
BAR ladders
derived rates
dynamic pricing
promotions
packages
corporate rates
negotiated rates
wholesale rates
group rates
member rates

Every automated revenue decision must retain:

input evidence
model/rule version
recommendation
confidence
expected effect
approval/execution state
actual outcome

This allows Yellow to learn.

============================================================
12. RATE ENGINE
============================================================

The rate architecture must support both simplicity and "god mode" customization.

A simple user journey should resemble:

CREATE RATE
→ CHOOSE PRICING BEHAVIOR
→ CHOOSE WHO GETS IT
→ CHOOSE WHERE IT APPLIES
→ DONE

But advanced users must be able to configure deeply.

Model independently:

Rate Plan
Rate Product
Pricing Rule
Occupancy Rule
Meal Plan
Cancellation Policy
Guarantee Policy
Deposit Policy
Payment Policy
Eligibility
Market
Segment
Source
Channel
Corporate Account
Travel Agent
Wholesaler
Group
Promotion
Package
Room Type
Occupancy
Guest Type
Date Range
Day of Week
Length of Stay
Lead Time
Inventory Condition
Restrictions
Tax Treatment
Currency
Distribution Mapping

Avoid giant tables containing hundreds of nullable fields.

Use composable policies/rules.

============================================================
13. BOOKING SOURCES
============================================================

A guest may arrive through:

Walk-in
Telephone
Email
WhatsApp
Google listing
Direct website
OTA
GDS
Travel agent
Corporate booking
Wholesaler
Group
Social media
Referral
Manual entry
API
Future channels

Source should be modeled separately from:

booking channel
marketing attribution
communication channel
payment source
market segment

Do not collapse these concepts.

============================================================
14. RESERVATION ENGINE
============================================================

Reservations must eventually support:

single room
multiple rooms
linked bookings
split stays
room moves
extensions
shortening
day use
walk-in
tentative
confirmed
waitlist
cancelled
no-show
in-house
checked-out
group blocks
allotments
shared rooms
multiple guests
children
infants
pets
companions
special requests
accessibility needs
packages
add-ons
transfers
meal plans
deposit schedules
guarantees
multiple currencies
tax exemptions
complimentary stays
house use
staff stays
owner stays
OTA modifications
partial cancellation
reinstatement
overbooking
upgrade
downgrade
early arrival
late checkout

Use explicit state machines.

Do not encode complex lifecycle behavior as arbitrary status strings.

============================================================
15. GUEST 360 / CRM
============================================================

Create a durable Guest identity model.

Separate:

Person
Guest Profile
Contact Point
Address
Identity Document
Preference
Consent
Communication
Stay
Reservation
Folio
Payment
Company Relationship
Loyalty
Incident
Service Request
Feedback
Review
Marketing Attribution

Support duplicate detection and safe merging.

A returning guest should not automatically become another disconnected profile.

But privacy rules must govern identity resolution.

============================================================
16. UNIFIED COMMUNICATION
============================================================

Ultimately support:

email
WhatsApp
SMS
website chat
OTA messaging
internal notes
voice/call metadata where integrations allow
future channels

Every conversation should connect where appropriate to:

guest
reservation
property
room
task
incident
invoice
payment
group
company

AI may:

classify
translate
summarize
suggest replies
extract intent
create tasks
detect urgency
identify sentiment

Human review and configurable automation must remain available.

============================================================
17. FRONT DESK
============================================================

Support:

arrivals
departures
in-house
room assignment
room move
upgrade
downgrade
registration
identity verification
payment guarantee
deposit
key issuance integrations
early check-in
late checkout
extensions
walk-ins
no-show
special requests
VIP handling
alerts
incidents
wake-up requests
messages
packages
lost & found
guest history

The arrival experience should show dependencies rather than force the user
through arbitrary screens.

Example:

Identity ✓
Payment ✓
Room ready ✕
Registration ✓
Key pending

The system should immediately explain the blocker.

============================================================
18. HOUSEKEEPING
============================================================

Support:

clean
dirty
inspected
pickup
turndown
DND
out-of-order
out-of-service
priority clean
stayover
checkout clean
deep clean
linen
amenities
minibar
inspection
lost & found

Prioritization should consider:

arrival ETA
VIP
room assignment
room category scarcity
staff location
staff workload
SLA
maintenance dependencies

Housekeeping should be excellent on mobile.

============================================================
19. MAINTENANCE / ENGINEERING
============================================================

Support:

asset registry
room assets
preventive maintenance
corrective maintenance
work orders
priority
SLA
technician assignment
parts
vendor
cost
downtime
room impact
photos/documents
recurrence
inspection
history

Maintenance must influence sellable inventory when required.

============================================================
20. FOLIO / ACCOUNTING
============================================================

Financial architecture requires extreme discipline.

Support:

folios
multiple folio windows
charges
credits
payments
refunds
deposits
transfers
routing
allowances
corrections
voids
tax
service charges
city tax
fees
commissions
packages
split payments
multiple currencies
AR
company billing
travel-agent billing
direct billing

Use append-only / immutable financial events where practical.

Never silently mutate historical financial truth.

Corrections should create explicit compensating entries.

Financial actions must be auditable.

============================================================
21. NIGHT AUDIT
============================================================

Night Audit should eventually become:

READINESS
→ EXCEPTIONS
→ RESOLUTION
→ CONTROLLED CLOSE

rather than an arbitrary sequence of screens.

Detect:

open folios
unposted room charges
payment mismatches
departures not checked out
arrivals not handled
room discrepancies
tax anomalies
interface failures
unbalanced ledgers
open shifts
unresolved exceptions

AI can explain problems.

Deterministic controls perform the close.

============================================================
22. PAYMENTS
============================================================

Design payment-provider abstraction.

Potential capabilities:

cards
payment links
wallets
UPI
bank transfer
cash
POS settlement
deposits
preauthorization
capture
incremental authorization
refund
partial refund
chargeback
virtual cards
tokenization

Do NOT store sensitive card data unnecessarily.

Architect toward PCI-compliant boundaries.

============================================================
23. DISTRIBUTION
============================================================

Design a channel abstraction layer.

Support eventually:

direct website
booking engine
OTAs
GDS
wholesalers
metasearch
Google Hotel integrations where applicable
future marketplaces

Canonical Yellow inventory/rate state must be separated from channel-specific
representations.

Use adapters:

Yellow Domain
        ↓
Canonical Distribution Model
        ↓
Provider Adapter
        ↓
External Channel

External failures must not corrupt canonical state.

Design:

idempotency
retry
backoff
dead-letter processing
reconciliation
rate limiting
observability
replay

============================================================
24. BOOKING ENGINE / WEBSITE
============================================================

A new property should eventually be capable of selling directly through Yellow.

Support:

property pages
availability search
room selection
rate selection
packages
upsells
guest details
payment
confirmation
modify booking
cancel booking
mobile experience
SEO
analytics
conversion tracking
localization
multiple currencies
accessibility

Direct booking should use the same canonical inventory/rate truth as the PMS.

============================================================
25. SALES / GROUPS / EVENTS
============================================================

Support:

leads
opportunities
accounts
contacts
corporate contracts
negotiated rates
RFPs
group enquiries
room blocks
pickup
release dates
rooming lists
group billing
group folios
events
function spaces
catering
tasks
contracts
documents

Do not force Salesforce-like complexity on small properties.

Progressively reveal advanced CRM.

============================================================
26. OWNER / STR OPERATIONS
============================================================

For STR/property managers support concepts such as:

owner
unit
management agreement
owner statement
commission
owner revenue
owner expense
payout
maintenance
availability restrictions
owner stays
property performance
portfolio analytics

Keep owner accounting separate from guest folios.

============================================================
27. REAL ESTATE / ASSET LAYER
============================================================

Architecture should be extensible toward:

buildings
towers
floors
units
ownership
rental pools
hospitality inventory
asset performance
developer inventory
mixed-use developments

Do not contaminate core hotel workflows prematurely.

Build clean extension points.

============================================================
28. STAFF OPERATING SYSTEM
============================================================

Staff should interact with Yellow through:

roles
teams
shifts
tasks
queues
SLAs
handoffs
notifications
approvals
escalations
checklists
knowledge
performance context

Avoid surveillance-oriented employee design.

Optimize operational coordination.

============================================================
29. TASK / WORKFLOW ENGINE
============================================================

Create a generic task/workflow foundation.

Tasks may originate from:

human
guest
reservation
AI
automation
maintenance
housekeeping
finance
integration
revenue
incident

Model:

priority
owner
team
status
deadline
SLA
dependency
entity links
evidence
comments
attachments
audit trail

============================================================
30. AUTOMATION ENGINE
============================================================

Eventually support:

TRIGGER
→ CONDITIONS
→ ACTIONS
→ APPROVAL
→ FOLLOW-UP

Example:

VIP arrival before noon
AND
assigned room dirty

→ increase housekeeping priority
→ notify supervisor
→ notify front desk
→ track readiness
→ escalate if SLA breached

Automation must use domain commands rather than direct DB mutation.

============================================================
31. ENTITY GRAPH
============================================================

Treat Yellow conceptually as an operational graph.

Entities may include:

Person
Guest
Reservation
Stay
Property
Building
Room
Room Type
Rate
Rate Plan
Company
Group
Travel Agent
Channel
Folio
Ledger Entry
Payment
Invoice
Task
Work Order
Asset
Message
Document
Staff Member
Owner
Unit
Event
Integration
Automation
Agent Decision

Relationships should be explicit.

Do NOT automatically use a graph database.

Choose storage technology based on measured access patterns.

============================================================
32. EVENT MODEL
============================================================

Important domain changes should emit events.

Examples:

ReservationCreated
ReservationModified
RoomAssigned
GuestCheckedIn
RoomMoved
ChargePosted
PaymentCaptured
RoomMarkedDirty
RoomReady
RateChanged
RestrictionChanged
TaskCreated
TaskCompleted

Events may drive:

UI updates
analytics
automation
integrations
AI context
audit
notifications

Design for idempotency.

============================================================
33. DATA ARCHITECTURE
============================================================

Primary operational storage should favor mature, open-source, cost-efficient
technology.

PostgreSQL should be strongly considered for canonical transactional state unless
repository evidence demonstrates a better choice.

Possible supporting technologies should only be added when justified:

Redis
object storage
columnar analytics
search indexes
event streaming
queues
local caches

DO NOT create distributed-system complexity prematurely.

Do not add Kafka, Elasticsearch, Kubernetes, graph databases, vector databases,
etc. simply because enterprise architectures often contain them.

Every infrastructure dependency must justify:

problem solved
scale threshold
operating cost
failure mode
simpler alternative

============================================================
34. PERFORMANCE
============================================================

Yellow should feel exceptionally fast.

Performance is a product feature.

Targets should eventually include:

instant-feeling navigation
optimistic interaction where safe
local/cache-aware reads
incremental rendering
small payloads
efficient queries
minimal round trips
real-time updates
graceful degraded connectivity

Measure:

p50
p95
p99
query count
payload size
CPU
memory
storage
network
cost per transaction

Never make "fastest PMS in the world" an unsupported marketing claim.

Make it an engineering objective measured by benchmarks.

============================================================
35. COST ENGINEERING
============================================================

Infrastructure cost is a first-class architectural metric.

For every major architecture decision consider:

cost/property
cost/occupied room
cost/reservation
cost/API request
cost/AI action
storage growth
egress
compute
support burden

Prefer efficient open-source infrastructure and commodity cloud primitives.

But never sacrifice:

correctness
security
financial integrity
availability
data durability

merely to save small amounts.

============================================================
36. MULTI-TENANCY
============================================================

Model clearly:

Organization
Brand
Portfolio
Property
Building
Unit
Department

Define tenant boundaries explicitly.

Every tenant-scoped record must have an explicit ownership path.

Prevent cross-tenant leakage structurally.

Do not rely only on developers remembering WHERE tenant_id = ?.

Evaluate database-level protections such as PostgreSQL Row Level Security where
appropriate.

============================================================
37. PERMISSIONS
============================================================

RBAC alone will eventually be insufficient.

Design toward:

RBAC + scoped permissions + policy conditions.

Examples:

front desk can move rooms
but cannot alter posted financial history.

housekeeping can update room status
but cannot inspect guest payment details.

revenue manager can modify rates
but only assigned properties.

AI agent can execute price changes
within configured percentage limits.

All sensitive actions must be auditable.

============================================================
38. SECURITY
============================================================

Assume:

internet exposure
malicious guests
malicious integrations
compromised credentials
insider threats
tenant isolation attacks
web attacks
API attacks
supply-chain attacks

Implement:

secure authentication
strong authorization
tenant isolation
secret management
encryption in transit
appropriate encryption at rest
rate limiting
input validation
CSRF protections where applicable
XSS protections
secure headers
dependency scanning
audit trails
session management
MFA/passkeys where appropriate
least privilege

Never create homemade cryptography.

============================================================
39. PRIVACY
============================================================

Hospitality systems contain sensitive personal information.

Build for:

data minimization
purpose limitation
retention rules
consent
export
deletion/anonymization where legally permitted
access logging
regional requirements
privacy-by-design

Do not send unnecessary guest PII to AI models.

Build AI context minimization/redaction mechanisms.

============================================================
40. LOCAL LAW / COMPLIANCE
============================================================

Do not hard-code one country's assumptions into the core.

Create jurisdictional policy modules for:

tax
invoice requirements
guest registration
identity reporting
fiscalization
tourism levies
data residency
retention
local currency
document requirements

Start with target markets but preserve global extensibility.

Never claim legal compliance without verified requirements.

============================================================
41. INTEGRATION PLATFORM
============================================================

External vendors should naturally be able to integrate with Yellow.

Build:

stable public APIs
webhooks
event subscriptions
OAuth/service authentication where appropriate
developer documentation
sandbox/testing capability
versioning
idempotency
rate limits
scoped permissions
integration health
logs

Yellow should become an attractive platform rather than an integration prison.

============================================================
42. OBSERVABILITY
============================================================

From early development support:

structured logs
metrics
traces
correlation IDs
audit events
health checks
integration health
queue health
database health
latency monitoring
AI action logs

Operational problems should be explainable.

============================================================
43. FAILURE DESIGN
============================================================

Assume everything fails.

Database connection
cache
queue
OTA
payment gateway
WhatsApp
email
AI provider
internet
background worker
external tax service

Design graceful failure.

Core property operations should not become unusable merely because an AI provider
is unavailable.

AI must degrade gracefully.

============================================================
44. OFFLINE / DEGRADED OPERATION
============================================================

Research limited degraded/offline capability for important workflows.

Potential examples:

view today's arrivals
view room assignments
housekeeping task list
update room status
capture queued operational actions

Synchronization must handle conflicts safely.

Financial and inventory-sensitive operations require stricter rules.

============================================================
45. API-FIRST DOMAIN
============================================================

The web UI must not contain hidden business logic that other clients cannot use.

Business logic belongs in reusable domain/application services.

UI
Mobile
AI
Automation
Integrations

should call common domain capabilities.

============================================================
46. ACCESSIBILITY
============================================================

Accessibility is mandatory.

Design toward WCAG expectations.

Support:

keyboard navigation
screen readers
focus states
contrast
touch targets
reduced motion
semantic structure
scalable text

============================================================
47. INTERNATIONALIZATION
============================================================

Architect from the beginning for:

languages
RTL
time zones
date formats
number formats
currencies
tax models
addresses
names
phone numbers

Never assume English-only data.

============================================================
48. CONFIGURATION
============================================================

The owner's principle is:

EVERYTHING SHOULD BE CUSTOMIZABLE WITHOUT DESTROYING THE MODEL.

Therefore:

Do NOT solve customization by creating arbitrary custom code per hotel.

Use:

configuration
policies
templates
rules
custom fields
workflow definitions
extensions
feature flags
integration adapters

When a requirement does not fit the model:

DO NOT discard the requirement.

First ask:

Is the domain model missing an abstraction?

Extend the model coherently.

============================================================
49. EXTENSION MODEL
============================================================

Design for future extension without corrupting core code.

Potential mechanisms:

versioned APIs
events
webhooks
provider adapters
policy modules
extension metadata
sandboxed plugins where justified

Do not prematurely build an enormous plugin platform.

============================================================
50. ONBOARDING — REGISTER TO LIVE
============================================================

This is one of Yellow's most important product goals.

Eventually:

REGISTER
→ PROPERTY BASICS
→ ROOMS / INVENTORY
→ POLICIES
→ RATES
→ PAYMENTS
→ DIRECT BOOKING
→ LIVE

AI should assist onboarding.

Possible inputs:

website URL
existing OTA listing
spreadsheet
old PMS export
property documents
natural language
voice

Yellow should attempt to infer configuration and ask only unresolved questions.

The operator approves.

The property can begin selling.

============================================================
51. MIGRATION
============================================================

Design migration tools for:

CSV
Excel
legacy PMS exports
guest profiles
reservations
companies
rates
rooms
folios where legally/technically appropriate
future provider connectors

Every migration should provide:

validation
preview
mapping
errors
reconciliation
audit trail

============================================================
52. DEMO / SANDBOX
============================================================

Maintain a realistic synthetic demo property.

It should include:

rooms
rates
reservations
guests
payments
tasks
housekeeping
maintenance
channels
messages
revenue history

Never use real PII in tests.

============================================================
53. TESTING PHILOSOPHY
============================================================

Do not test only happy paths.

Build:

unit tests
domain invariant tests
integration tests
contract tests
API tests
UI tests
end-to-end tests
migration tests
permission tests
tenant isolation tests
concurrency tests
property-based tests where useful
load tests
failure-injection tests

============================================================
54. JOURNEY TESTING
============================================================

Create complete scenario libraries.

Examples:

Walk-in arrives
→ search availability
→ quote
→ create guest
→ reservation
→ assign room
→ deposit
→ check-in
→ post charge
→ room move
→ payment
→ checkout
→ invoice
→ review request

OTA booking
→ channel ingestion
→ deduplication
→ inventory update
→ guest communication
→ modification
→ virtual card
→ commission
→ checkout
→ reconciliation

VIP early arrival
→ room dirty
→ HK reprioritized
→ maintenance discovered
→ room changed
→ guest informed
→ key issued
→ preference retained

Group booking
→ enquiry
→ quote
→ contract
→ block
→ pickup
→ rooming list
→ routing
→ payment
→ release
→ final billing

Overbooking
→ detect
→ recommend recovery
→ relocate guest
→ adjust inventory
→ track cost
→ record incident

No-show
Cancellation
Chargeback
Partial refund
Split payment
Extension
Room move
Tax exemption
Corporate billing
Direct billing
Owner stay
House use
Maintenance closure
Offline sync conflict

Continue expanding this library.

============================================================
55. PERSONAS
============================================================

Test every major capability through multiple perspectives:

Guest
Receptionist
Night Auditor
Housekeeper
Housekeeping Supervisor
Engineer
Revenue Manager
Sales Manager
Accountant
General Manager
Owner
Portfolio Manager
STR Host
Property Manager
System Administrator
Integration Developer

Ask:

What does this person need NOW?

Not:

Which module should they open?

============================================================
56. UX ANTI-PATTERNS
============================================================

Continuously identify and avoid:

menu explosion
dashboard overload
modal overload
form overload
hidden destructive actions
unclear state
duplicate concepts
status ambiguity
excessive clicks
tiny touch targets
desktop squeezed onto mobile
decorative animation
unexplained AI
AI acting without evidence
configuration scattered everywhere
inconsistent entity views

============================================================
57. RESEARCH PROGRAM
============================================================

Do not rely solely on model memory.

When internet access is available, research current official documentation,
open-source implementations, public product documentation, technical papers,
conference talks, GitHub/GitLab repositories, UX case studies, issue trackers,
public bug reports, engineering blogs and credible demonstrations.

Research categories including:

PMS
CRS
RMS
CRM
Channel Managers
Booking Engines
GDS
Housekeeping
POS
Payments
Accounting
Revenue Optimization
STR systems
Property management
Hotel groups
Real estate
Workflow systems
AI agents
Distributed systems
Database design
High-performance UI
Mobile UX
Accessibility
Security
Hospitality regulations

Study major hospitality systems where public documentation is available,
including Oracle OPERA and modern cloud hospitality products.

Study both:

GOOD PATTERNS
and
FAILURE PATTERNS.

Public GitHub/GitLab issues can be particularly useful for learning edge cases.

Never copy proprietary source code.

Record sources and findings.

============================================================
58. EXISTING OPERA RESEARCH
============================================================

The project owner previously provided Oracle OPERA documentation.

Use official Oracle documentation as one reference for understanding mature hotel
operational edge cases.

Do NOT clone OPERA.

OPERA represents decades of accumulated hospitality scenarios.

Extract domain knowledge and edge cases while designing a substantially better
interaction model.

============================================================
59. ENGINEERING DECISION DISCIPLINE
============================================================

Before adding significant infrastructure or architectural complexity, create an
ADR.

Each ADR should include:

Problem
Constraints
Options
Decision
Reason
Cost
Failure modes
Migration path
Reversibility

Avoid architecture-by-fashion.

============================================================
60. SCOPE RULE
============================================================

THIS RULE IS CRITICAL.

Do not reduce product scope simply because a requirement is difficult.

Instead classify requirements as:

SUPPORTED NOW
FOUNDATION READY
PLANNED
RESEARCH REQUIRED

The architecture should preserve a credible path to future scope.

However:

Do NOT implement every future capability immediately.

Preserve scope architecturally while delivering incrementally.

============================================================
61. V1 DOES NOT MEAN TOY
============================================================

V1 should be a coherent operational vertical slice.

It should establish foundations that later modules reuse.

Prioritize a journey such as:

Property
→ inventory
→ rates
→ availability
→ guest
→ reservation
→ arrival
→ room assignment
→ housekeeping
→ check-in
→ folio
→ payment
→ checkout
→ audit/events

Then expand outward.

============================================================
62. DEVELOPMENT ORDER
============================================================

Do not implement random screens.

Recommended dependency order:

FOUNDATION

Tenant
Property
User
Permissions
Audit
Events
Configuration

↓

INVENTORY

Building
Floor
Room Type
Room
Room State

↓

COMMERCIAL CORE

Rate
Availability
Inventory
Reservation

↓

GUEST

Guest identity
CRM
Communication

↓

OPERATIONS

Front Desk
Housekeeping
Tasks
Maintenance

↓

FINANCE

Folio
Ledger
Payments
Tax

↓

DISTRIBUTION

Booking engine
Channels
Integrations

↓

INTELLIGENCE

Analytics
Revenue
Comp Advantage

↓

AUTOMATION

Workflow Engine
AI Command Layer
Agents

This is a dependency graph, not a rigid waterfall.

============================================================
63. DATABASE DISCIPLINE
============================================================

For every important table/entity document:

identity
tenant ownership
invariants
state machine
indexes
foreign keys
uniqueness
retention
audit behavior
PII classification

Use database constraints where they improve correctness.

Avoid enforcing every invariant only in application code.

============================================================
64. CONCURRENCY
============================================================

Hospitality has concurrency problems.

Explicitly test:

two users assigning same room
two bookings consuming final inventory
OTA + direct booking race
simultaneous rate updates
duplicate webhook
duplicate payment callback
check-in during reservation modification
room status changing during assignment

Use transactions, locks, optimistic concurrency, idempotency or reservation
mechanisms appropriately.

============================================================
65. DOMAIN INVARIANTS
============================================================

Define invariants such as:

A room cannot have two incompatible physical occupancies simultaneously.

Inventory cannot become negative unless explicitly permitted by an overbooking
policy.

A payment callback must not create duplicate settlement.

A posted ledger event cannot silently disappear.

Tenant A cannot access Tenant B.

A cancelled reservation cannot check in without an explicit reinstatement path.

Document and test invariants.

============================================================
66. AUDITABILITY
============================================================

For important actions record:

actor
time
tenant
property
action
entity
previous relevant state
new relevant state
reason
source
correlation ID

AI actions additionally require:

agent
model/provider where relevant
policy
evidence
confidence
approval
tool/action invoked
result

============================================================
67. AI PROVIDER INDEPENDENCE
============================================================

Do not hardwire Yellow to one AI vendor.

Create abstraction around AI capabilities where useful.

Allow future routing based on:

task
quality
latency
cost
privacy
region
availability

Critical business operation must continue without AI.

============================================================
68. AI COST
============================================================

Do not send giant context windows for trivial tasks.

Use:

structured context
retrieval
summaries
caching where safe
small specialized models where adequate
deterministic preprocessing
batching where useful

Measure:

AI cost/property
AI cost/reservation
AI cost/agent
AI value generated

============================================================
69. KNOWLEDGE SYSTEM
============================================================

Yellow may eventually maintain property knowledge:

policies
SOPs
room information
amenities
local recommendations
staff procedures
contracts
FAQs

Agents should retrieve relevant knowledge rather than invent answers.

============================================================
70. EXPLAINABILITY
============================================================

Any consequential AI recommendation should answer:

WHAT?
WHY?
EVIDENCE?
CONFIDENCE?
EXPECTED RESULT?
RISK?
CAN I UNDO IT?

Especially revenue and financial recommendations.

============================================================
71. PROGRESS PSYCHOLOGY
============================================================

Use progress carefully.

Show meaningful operational completion.

Examples:

Arrival readiness 82%
Night audit 91% ready
Housekeeping 74% complete
Onboarding 6/8 complete

Never manipulate users with artificial gamification.

Progress should reflect real operational state.

============================================================
72. NOTIFICATION PHILOSOPHY
============================================================

Do not create notification spam.

Prioritize by:

urgency
impact
deadline
role
context

Prefer:

"3 arrivals are blocked by room readiness"

over 17 individual notifications.

============================================================
73. SEARCH
============================================================

Global search should eventually locate:

guest
reservation
room
folio
invoice
payment
company
group
task
work order
owner
unit
message
document
setting
action

Search should evolve toward command + retrieval.

============================================================
74. REPORTING
============================================================

Avoid a graveyard containing hundreds of static reports.

Provide:

operational views
explorable analytics
saved views
exports
scheduled delivery
API access
AI questions

Still support statutory/industry reports where required.

============================================================
75. CUSTOM VIEWS
============================================================

Eventually allow users to personalize:

columns
filters
saved views
dashboards
queues
shortcuts
alerts

without creating divergent business logic.

============================================================
76. FEATURE FLAGS
============================================================

Use feature flags where appropriate for:

experimental features
tenant rollout
jurisdiction modules
migration
A/B testing

Do not let flags become permanent unmanaged complexity.

============================================================
77. DOCUMENTATION
============================================================

Maintain:

README.md
ARCHITECTURE.md
DOMAIN-MODEL.md
SECURITY.md
AI-ARCHITECTURE.md
UX-PRINCIPLES.md
TESTING.md
RUNBOOK.md

Create:

/docs/adr
/docs/domain
/docs/journeys
/docs/research
/docs/api
/docs/agents

Documentation must evolve with code.

============================================================
78. CODE QUALITY
============================================================

Prefer:

strong typing
small modules
clear boundaries
explicit domain language
boring reliable code
memory-safe technology where practical
mature dependencies
tests around invariants

Avoid:

mega services
god classes
hidden side effects
business logic in controllers
business logic in UI components
business logic in AI prompts
copy/pasted integrations
unnecessary dependencies

============================================================
79. MONOREPO
============================================================

If the repository already has a coherent structure, respect it.

If architectural analysis supports a monorepo, a possible future structure could
be:

apps/
    web
    mobile
    api
    workers

packages/
    domain
    database
    ui
    auth
    events
    integrations
    ai
    config
    observability

services/
    only when independent deployment is justified

Do not restructure merely to match this example.

============================================================
80. MICROSERVICES
============================================================

DO NOT start with dozens of microservices.

Prefer a modular monolith unless evidence demonstrates a need otherwise.

Maintain strong module boundaries so components can be extracted later.

Distribution should be earned by scaling/failure requirements.

============================================================
81. REAL-TIME
============================================================

Real-time matters for:

reservations
inventory
room state
tasks
messages
payments
operational alerts

Use efficient event propagation.

Do not poll everything every few seconds.

============================================================
82. FRONTEND PERFORMANCE
============================================================

For large operational screens:

virtualize large lists
avoid unnecessary rerenders
lazy-load heavy modules
prefetch likely next context
use optimistic updates where safe
cache immutable/reference data
avoid huge client bundles

Calendar/tape views may contain large datasets.

Benchmark them.

============================================================
83. CALENDAR / TAPE CHART
============================================================

Create a high-performance spatial reservation view.

Support:

room
room type
date
reservation
guest
source
status
group
maintenance
OOO/OOS
drag/drop where safe
room move
extension
shortening
conflict visualization
zoom
filters
search

It must remain performant for large properties.

============================================================
84. PRODUCT QUALITY BAR
============================================================

Before considering a workflow complete, ask:

Can a new user understand it?

Can an expert work quickly?

Can it be done by keyboard?

Can it be done on mobile where appropriate?

Can AI perform the same action safely?

Is the action auditable?

Does it handle failure?

Does it handle concurrency?

Does it preserve tenant isolation?

Does it work internationally?

Can it be extended?

Is it tested?

============================================================
85. DO NOT FAKE FUNCTIONALITY
============================================================

A button must not pretend to work.

Prototype/demo behavior must be clearly distinguished from production behavior.

Never mark a module "complete" merely because a screen exists.

Track separately:

UI
domain logic
persistence
permissions
integration
tests
observability
documentation

============================================================
86. DEFINITION OF DONE
============================================================

A production capability is done only when appropriate aspects include:

domain model
business rules
database
API
authorization
UI
validation
errors
audit
events
tests
accessibility
observability
documentation
migration considerations
performance considerations

============================================================
87. FIRST TASK — DO NOT CODE YET
============================================================

FIRST:

Perform a complete repository archaeology.

Produce:

docs/research/REPOSITORY-ASSESSMENT.md

Include:

Current stack
Directory map
Architecture
Database
Schema
Implemented capabilities
Partially implemented capabilities
UI routes
APIs
Authentication
Authorization
Tenancy
Events
Jobs/workers
AI
Integrations
Testing
Deployment
Performance concerns
Security concerns
Technical debt
Useful existing work
Code that should be preserved
Code that should be refactored
Code that appears obsolete

Then produce:

docs/research/CAPABILITY-MATRIX.md

Compare the existing repository against this constitution.

For every capability classify:

IMPLEMENTED
PARTIAL
FOUNDATION EXISTS
MISSING
RESEARCH REQUIRED

Do not estimate based on filenames.

Inspect actual implementation.

============================================================
88. SECOND TASK — RESEARCH
============================================================

Create:

docs/research/HOSPITALITY-EDGE-CASES.md

Build a serious corpus of hospitality workflows and edge cases using credible
public documentation and research.

Include findings from:

legacy PMS knowledge
modern PMS
CRS
RMS
channel management
STR
finance
housekeeping
groups
sales
distribution

Do not copy copyrighted documentation verbatim.

Summarize domain knowledge.

Create source references.

============================================================
89. THIRD TASK — JOURNEY MAP
============================================================

Create:

docs/journeys/MASTER-JOURNEY-MAP.md

Map:

GUEST JOURNEY

discover
search
book
confirm
pre-arrival
arrival
check-in
stay
requests
payments
room changes
checkout
invoice
feedback
return

STAFF JOURNEY

setup
sell
prepare
arrive
operate
serve
maintain
settle
audit
analyze
optimize

COMMERCIAL JOURNEY

demand
price
distribute
convert
collect
reconcile
forecast
optimize

OWNER JOURNEY

onboard
monitor
approve
receive statements
analyze performance
manage asset

For each step identify:

entities
commands
events
permissions
UI context
automation opportunities
AI opportunities
failure cases

============================================================
90. FOURTH TASK — DOMAIN MODEL
============================================================

Create:

docs/DOMAIN-MODEL-V1.md

Define:

aggregates
entities
value objects
relationships
state machines
invariants
commands
events

Do not implement database schema until the model is coherent.

============================================================
91. FIFTH TASK — ARCHITECTURE
============================================================

Create:

docs/ARCHITECTURE-V1.md

Optimize simultaneously for:

correctness
speed
simplicity
cost
security
maintainability
extensibility

Document alternatives considered.

============================================================
92. SIXTH TASK — IMPLEMENTATION PLAN
============================================================

Create:

docs/IMPLEMENTATION-PLAN.md

Break work into dependency-aware vertical slices.

Each slice must produce something runnable/testable.

Do not create a 12-month theoretical roadmap.

Create executable milestones.

============================================================
93. THEN BEGIN IMPLEMENTATION
============================================================

After repository assessment, research, journey mapping, domain modeling and
architecture planning:

begin implementing the highest-value foundation.

Work incrementally.

For each increment:

1. State objective.
2. Identify affected modules.
3. Implement.
4. Write/update tests.
5. Run tests.
6. Run lint/type checks.
7. Verify migrations.
8. Verify tenant boundaries.
9. Verify permissions.
10. Verify failure paths.
11. Benchmark if performance-sensitive.
12. Update documentation.
13. Summarize result.
14. Commit coherently.

Do not leave the repository broken between major increments.

============================================================
94. CONTINUOUS SELF-REVIEW
============================================================

After every meaningful feature ask:

What edge case did we miss?

What happens under concurrency?

What happens when dependency fails?

What happens on slow network?

What happens on mobile?

What happens with 1 property?

What happens with 1,000 properties?

What happens with 20 rooms?

What happens with 5,000 rooms?

What happens internationally?

What happens when AI is unavailable?

What happens when an integration sends the same event twice?

What can an unauthorized employee do?

What information could leak across tenants?

============================================================
95. PRODUCT OWNER INTERACTION
============================================================

Do not require the product owner to define ordinary hospitality edge cases that
can reasonably be researched.

Research them.

Escalate only decisions that genuinely require product-owner judgment.

When escalation is required, present:

Decision
Why it matters
Option A
Option B
Option C
Recommendation
Consequence

Avoid asking vague questions.

============================================================
96. PROTECT SCOPE
============================================================

Never silently remove requirements.

If something cannot currently be implemented:

record it.

If technology is immature:

record it.

If integration access is unavailable:

create the correct abstraction/interface.

If jurisdiction research is incomplete:

create the policy boundary.

If AI cannot reliably perform something:

keep deterministic/human control.

Preserve the destination without pretending the destination already exists.

============================================================
97. OPTIMIZE FOR THE ECOSYSTEM
============================================================

A local optimization must not damage the larger architecture.

Example:

Do not build housekeeping as an isolated app.

Housekeeping affects:

rooms
arrivals
guests
maintenance
staff
revenue
inventory

Similarly:

reservation affects inventory.
inventory affects distribution.
distribution affects revenue.
revenue affects pricing.
pricing affects booking.
booking affects guest.
guest affects operations.
operations affect finance.
finance affects reporting.

Yellow is ONE operating system.

============================================================
98. CORE ENGINEERING PRINCIPLE
============================================================

Prefer:

ONE CANONICAL TRUTH
+
CLEAR DOMAIN BOUNDARIES
+
EVENTS
+
SHARED COMMANDS
+
ADAPTIVE EXPERIENCES
+
CONTROLLED AI

over:

dozens of disconnected modules.

============================================================
99. THE TEST
============================================================

At every stage ask:

"If a hospitality business registers today, how much closer are we to allowing
them to operate and sell without purchasing another core operational system?"

That is the product test.

============================================================
100. START NOW
============================================================

Begin with repository archaeology.

Do NOT immediately generate large amounts of code.

Do NOT rewrite working architecture without evidence.

Do NOT reduce the scope defined in this document.

Do NOT fake completion.

Inspect the actual repository first.

Then create:

1. docs/research/REPOSITORY-ASSESSMENT.md
2. docs/research/CAPABILITY-MATRIX.md
3. docs/research/HOSPITALITY-EDGE-CASES.md
4. docs/journeys/MASTER-JOURNEY-MAP.md
5. docs/DOMAIN-MODEL-V1.md
6. docs/ARCHITECTURE-V1.md
7. docs/IMPLEMENTATION-PLAN.md

After these are complete, critically review them against this constitution.

Find contradictions, missing hospitality scenarios, unnecessary complexity,
security weaknesses, scaling problems, and scope loss.

Correct them.

Then present the assessment and proposed first implementation slice before making
a major architectural rewrite.

The destination is not another PMS.

The destination is a coherent Hospitality Operating System in which:

THE GUEST JOURNEY
THE STAFF JOURNEY
THE COMMERCIAL JOURNEY
THE FINANCIAL JOURNEY
THE OWNER JOURNEY
THE DISTRIBUTION JOURNEY
AND THE AI JOURNEY

operate on the same underlying hospitality model.

Build toward that systematically.
