# Domain Model V1

**Status:** Conceptual model for planning; no schema authority.
**Executable schema authority:** `migrations/0001_init.sql` and forward migrations.
**Behavior authority:** `docs/CONTRACTS.md`, `docs/STATE-MACHINES.md`,
`docs/EVENTS.md`, and `DECISIONS.log`.
**Conflict rule:** `PROJECT.md` wins.

This model reconciles the Yellow product destination with the repository that exists.
It does not authorize a migration, status, event, or command. Target additions are
explicitly labelled and require their own reviewed decision/order.

## Modeling principles

1. Hospitality is a connected model, not a set of isolated SaaS modules.
2. Aggregates own consistency boundaries; references across them are IDs, queries, and
   events, not shared mutable objects.
3. PostgreSQL is authoritative for inventory, money, permissions, tax/fiscal state, and
   every other deterministic business fact.
4. Every critical mutation passes through a domain command in a transaction.
5. UI, API, automation, integrations, and AI share those commands.
6. Head rows answer “now”; append-only facts/events answer “how and why.”
7. Configuration extends stable primitives; it does not create property-specific forks.
8. Tenant and property ownership are explicit.
9. Time distinguishes instant, property-local business date, and half-open stay period.
10. Schema foundation is not implemented behavior.

## Context map

### Platform kernel

The kernel is not a fourteenth business context and imports none.

Owns capabilities for:

- tenant transaction establishment;
- audit envelopes and append-only facts;
- event publication/consumption/relay;
- approval requests;
- extension/configuration registry;
- generic task/automation foundations;
- migration and schema integrity tooling.

### Canonical bounded contexts

| # | Context | Primary responsibility | Current executable behavior |
|---:|---|---|---|
| 1 | Identity | tenant/org/user/role/permission/auth | Password/JWT/resolver/hierarchy reads |
| 2 | Inventory | spaces, unit types, sellable units, physical claims, holds, restrictions | SQL choke point/proofs only |
| 3 | Rates | rate plans/prices/packages/promotions/policies | Schema only |
| 4 | Reservations | reservation lifecycle, segments, guests, waitlist | Schema/contracts only |
| 5 | Stay Operations | arrival/check-in/out, travel, vehicles, queues/messages | Schema/contracts only |
| 6 | Housekeeping | conditions, task sheets, discrepancies | Schema/contracts only |
| 7 | Financials | accounts, folios, journals, payments, day close, AR | Schema/invariant proofs only |
| 8 | CRM | party identity, contacts, preferences, consent | Schema only |
| 9 | Groups | linked/share/block/allotment semantics | Schema/contracts only |
| 10 | Distribution | channels, mapping, inbound, ARI cursors | Schema only |
| 11 | Tax/Fiscal | tax rules, documents, fiscal submission | Schema/invariant proofs only |
| 12 | Statutory/Privacy | guest reporting and erasure | Schema only |
| 13 | Reporting | operational/statistical projections | Schema only |

Owner/asset management is a **target extension/context decision**, not an existing
canonical context. It may reuse identity/org/space and finance events, but owner
agreements, owner statements, and payouts must not be forced into guest folios.

## Core identifiers and value objects

| Value object | Meaning and rules |
|---|---|
| `TenantId` | UUID; present on every tenant-owned aggregate and leading its access path |
| `OrgNodeId` | UUID scoped to tenant; property nodes carry valid IANA timezone and currency |
| `ActorId` | Authenticated human/service/agent identity; never accepted from an untrusted body |
| `CorrelationId` | UUID tracing one user/system intention across facts/events/integrations |
| `IdempotencyKey` | Caller key + tenant + command + canonical request hash |
| `Money` | `amountMinor: bigint` + ISO `currency`; no float or implicit FX |
| `BusinessDate` | Date derived from the relevant property's timezone |
| `Instant` | UTC instant with explicit serialized offset at boundaries |
| `StayPeriod` | Half-open interval `[from,to)`; positive duration |
| `OccupancyClaim` | Exclusive `[0,∞)` or positional `[p,p+1)` range |
| `Quantity` | Integer or exact decimal policy; never binary float for money effects |
| `Percentage` | Validated rational/decimal plus explicit basis and rounding |
| `PolicyVersion` | Immutable/effective-dated reference to rules used for a decision |
| `DocumentNumber` | Series-scoped, gapless identity assigned only on issue |
| `ExternalReference` | Provider + property + external ID + version/message identity |
| `Scope` | `context.resource:action` plus future property/department conditions |
| `EvidenceRef` | Source, observed/recorded time, version, freshness, and access classification |
| `Confidence` | Calibrated value with model/rule provenance; never authority by itself |
| `LocaleContext` | language, script direction, timezone, date/number/currency format |

Types should be branded at application boundaries when implemented.

## Aggregate catalogue

### Tenant and Organization aggregate — Identity

**Root:** Tenant / organization root.
**Entities:** `tenant`, `org_node`.
**Value objects:** org path, node kind, timezone, currency, address target.
**Invariants:**

- every node belongs to one tenant;
- every path prefix exists in the same tenant;
- a property has timezone and default currency;
- hierarchy queries include tenant equality;
- reparenting, when introduced, is an explicit versioned command, never raw path update.

**Current commands/queries:** hierarchy reads only.
**Target commands:** create/rename/reparent property/brand/region/outlet, subject to
future orders and events.

### User and Access aggregate — Identity

**Root:** `app_user`.
**Entities:** role, permission, user-role assignment, API client, credential/session
(target).
**Invariants:**

- verified identity chooses tenant;
- authentication and authorization are separate;
- deactivated/expired identities cannot mint/use sessions;
- role assignment cannot exceed grantor authority;
- sensitive actions require explicit scope/policy and audit.

**Current behavior:** password/JWT primitives and bearer resolution.
**Target:** login/session/revocation/MFA and role administration.

### Configuration aggregate — Kernel

**Roots:** `extension_type` (platform) and `extension` (global/tenant instance).
**Entities:** schema definition, versioned instance, activation fact.
**Invariants:**

- instance content validates against its type schema;
- tenant instance visibility is global plus own tenant only;
- schema change is compatible with all existing instances or follows a migration plan;
- active configuration is effective-dated and auditable.

Current code supports registration, creation, list, and compatibility checking; complete
activation/version lifecycle is target behavior.

### Approval aggregate — Kernel

**Root:** `approval_request`.
**States:** pending → approved | rejected | expired.
**Invariants:** terminal decisions are final; requester cannot approve/reject; one
concurrent winner; mutable head + append-only facts/events.

An approval does not itself perform the protected action. Execution must revalidate
current state and policy after approval.

### Task/Workflow aggregate — Kernel target behavior

**Root:** `task` or future workflow instance.
**Entities:** assignment, dependency, evidence, comment/attachment reference, SLA.
**Target states:** must be decided before implementation; existing generic status text is
not permission to invent a lifecycle.
**Invariants:** tenant/entity links, one current owner/team policy, guarded transitions,
complete audit, idempotent automation actions.

### Space and Sellable Inventory aggregate — Inventory

**Roots:** `space`, `unit_type`, `sellable_unit`.
**Entities:** space relations, sellable-unit membership, authority, restrictions,
OOO/OOS, overbooking limit.
**Value objects:** capacity, claim mode, attributes, availability date range.
**Invariants:**

- physical space and commercial sellable unit are distinct;
- composite units cannot create incompatible physical claims;
- hot availability predicates are typed/indexed;
- OOO/OOS and maintenance effects are explicit intervals;
- canonical state is independent of channel representations.

### Occupancy aggregate — Inventory

**Root:** the logical claim identified by `slot_ref`; persisted in
`space_occupancy` through authorized functions only.
**Entities:** hold and reservation-segment claims.
**States:** hold active → consumed | expired | released; segment occupancy lifecycle is
driven by reservation commands.
**Invariants:**

- no incompatible claims overlap on a space;
- direct DML is denied;
- every write is tenant-scoped and transactional;
- a room move closes/trims one segment and creates another;
- PostgreSQL constraint acceptance is the final sellability decision;
- projection/cache are disposable.

### Availability aggregate/read model — Inventory

Availability is a query/projection, not an authority. It combines unit supply, occupancy,
restrictions, OOO/OOS, allotments, and overbooking policy. Search returns options, not a
promise. Hold/commit must re-enter the occupancy aggregate.

### Rate aggregate — Rates

**Root:** `rate_plan`.
**Entities:** `rate_price`, package, package element, promotion, negotiated rate, policy
reference.
**Value objects:** date range, day mask, occupancy, eligibility, market/segment/channel,
price, restriction, derivation.
**Invariants:**

- prices are insert-only and bitemporal;
- supersession is explicit;
- deterministic precedence is documented and tested;
- historical “valid then/known then” queries remain possible;
- policy/tax/currency versions used by a quote are retained.

### Quote aggregate — target application aggregate

A quote is an expiring, reproducible proposal combining availability, nightly prices,
tax, policies, package elements, and eligibility. It needs stable input/version references
before public booking work. It does not reserve inventory unless a hold is created.

### Reservation aggregate — Reservations

**Root:** `reservation`.
**Entities:** segments, reservation guests, alerts, waitlist reference, group link.
**Value objects:** confirmation number, source/channel/attribution, stay intent,
guarantee/deposit terms, special requirements.
**Canonical states:** quote, reserved, due_in, in_house, due_out, checked_out, cancelled,
no_show, exactly as `STATE-MACHINES.md` defines.
**Invariants:**

- illegal transitions are rejected;
- confirmation requires accepted occupancy;
- segment period/unit changes re-arbitrate through occupancy;
- cancellation/no-show releases claims and applies versioned policy atomically;
- reinstatement rechecks availability;
- attribution concepts are not collapsed;
- every externally relevant transition emits the existing catalogued event.

### Reservation Group aggregate — Groups

**Root:** `reservation_group`.
**Entities:** block status definition, allotment, rooming-list batch, member reservation
references, routing reference.
**Invariants:**

- deduction is configured on status, not inferred from name;
- pickup consumes allotment before house inventory when deducting;
- wash/cutoff releases are idempotent and auditable;
- member folios remain distinct from group/master account routing;
- shares and linked bookings do not imply identical financial ownership.

### Party/Guest aggregate — CRM

**Root:** `party`.
**Entities:** roles, contact points, addresses, identity documents, relationships,
memberships, preferences, consents.
**Value objects:** normalized contact, name components, consent purpose/version,
identity match evidence.
**Invariants:**

- a person is not the same thing as a reservation guest occurrence;
- duplicate detection proposes; merge requires authority and evidence;
- merges retain source identities and audit and must not corrupt active stays/financials;
- access, retention, export, anonymization, and legal holds follow jurisdiction policy;
- AI receives only minimized/redacted necessary context.

### Stay aggregate — Stay Operations

The current schema uses reservation/segments plus operational tables rather than a
separate `stay` table. Conceptually, a stay is the in-house execution of reservation
segments.

**Entities:** arrival/readiness, travel detail, queue entry, vehicle, room/key/interface
references, service requests.
**Invariants:** check-in guards exact due-in state, one current assigned booked segment,
one open primary folio, authoritative room condition and configuration-selected
recorded identity evidence; check-out guards folio settlement/AR transfer; physical
occupancy and financial account lifecycle remain separable where policy allows open
folio.

Order 200 is the active first Phase-6 slice. `org_node.config.statutory_adapter_key`
selects one exact effective active tenant-owned `statutory_adapter`; a non-empty valid
`required_identity_fields` declaration activates the generic rule that every
reservation Party has at least one recorded `identity_document`. This readiness gate
does not expose PII and does not interpret country-specific fields. Clean/inspected
rooms pass; dirty/pickup requires a distinct exact property grant and attributable
reason. Commit changes only reservation plus active segment to `in_house` and appends
minimized evidence. It creates no account/folio, occupancy, key, financial, day,
statutory-submission, tax/fiscal or checkout effect.

Whether a separate persisted Stay root is needed is **research required**; do not add one
without measured command/query needs.

### Room Condition aggregate — Housekeeping

**Root:** `unit_condition`.
**Entities:** task sheet, discrepancy, housekeeping task references.
**Dimensions:** physical occupancy, cleaning condition, and OOO/OOS are orthogonal.
**Invariants:** condition transitions are guarded; inspection identity/time retained;
sleep/skip/person discrepancies are explicit; maintenance dependencies can block
readiness; mobile/offline updates conflict safely.

Order 201 consumes the existing `task` primitive without adding a housekeeping root
or state. One eligible task is tenant/property-bound, `kind='housekeeping'`,
`subject_type='space'`, and references one active physical space. The task status and
its room's `unit_condition` form one locked transition decision: start preserves the
condition, completion moves dirty/pickup to clean, and independent verification moves
clean to inspected. `unit_condition.updated_by/updated_at`, task `completed_at`, facts
and outbox rows retain attributable evidence. This slice does not model cadence,
task-sheet generation, credits, attendant allocation or occupancy.

Order 227 adds no new root or state. It closes only the absent-row ingress for one
active exact-property `space`: a server-authorized actor may explicitly initialize
`unit_condition` to `clean`, `dirty` or `pickup`. `inspected` is excluded because it
is verification evidence. The parent space is the serialization key, existing rows
are immutable through this ingress, and condition, actor, transaction time, fact and
outbox evidence are committed atomically. Absence is not a default condition and does
not imply readiness, occupancy, OOO/OOS, reservation or task truth.

Order 202 composes the existing `task_sheet`, `task`, `space`, `reservation_segment`,
`space_occupancy`, Party/staff-role and `vertical_profile` primitives; it adds no root,
table or state. One deterministic sheet is identified by tenant, property, local date
and selected active staff attendant. Its deterministic assigned housekeeping tasks
reference distinct active physical spaces selected from authoritative current
in-house occupancy and effective per-room cadence. Tenant profile configuration wins
over the global profile on the same key. V1 admits only recorded `daily` and exact
local-date `on_departure`; missing, ambiguous, weekly or custom semantics fail closed.

Sheet generation appends tasks plus attributable facts/events but does not alter the
source reservation, segment, occupancy or room condition. Order 201 remains the sole
owner of later assigned-to-verified task and dirty/pickup-to-inspected condition
transitions. Credits, balancing, reassignment, cancellation, automatic scheduling,
discrepancy and checkout remain outside this slice.

Order 203 adds no aggregate and no state machine. Its departure-readiness snapshot is
a read-only composition of the existing reservation, current in-house segment,
assigned sellable-to-physical-space map, sanctioned segment occupancy, account/folio
windows and canonical `folio_balance` view. The valid operational chain is one
`in_house` segment, one active physical space and one exclusive
`slot_kind='segment'` occupancy whose slot reference, space and period exactly equal
that segment.

At least one reservation folio window is required; each must already be `settled` or
`closed` with exact bigint zero balance. Reservation `in_house`/`due_out` is
departure-eligible state, but the snapshot is advisory evidence rather than checkout
authority. Physical departure, reservation/segment transition, occupancy release and
financial/account closure remain distinct future commands that must revalidate under
their own locks.

Order 204 adds no aggregate, table, state or event vocabulary. It is the governed
command that consumes the Order-203 predicate set under reservation, segment,
account and folio locks. The existing reservation transition
`in_house|due_out -> checked_out` and exactly one current segment transition
`in_house -> departed` occur atomically with the sanctioned release of that
segment's one matching exclusive occupancy.

The segment range preserves its lower bound and never extends its upper bound:
early departure uses the PostgreSQL transaction timestamp, while late execution
retains the already-recorded upper bound. Folio settlement/closure and canonical-zero
balance are preconditions, not effects; account, folio, journal, posting and payment
truth remain byte-stable. Room condition and housekeeping scheduling are intentionally
separate aggregates and receive no implicit checkout consequence.

Order 205 adds no aggregate, state or parking model. The Vehicle Register is a
read-only view of the existing `vehicle` primitive, ordered by registration and id.
Registration is recorded text rather than a normalized identifier. Nullable
reservation and Party references are descriptive associations only and must be
re-proven against the active tenant/property before disclosure. `entered_at` and
`exited_at` remain literal observations; their presence or absence does not create an
onsite state. Parking remains a separate ordinary `space`/occupancy concern under
D-41 and is not disclosed or inferred by this register.

Order 206 adds no aggregate, state or automation. The existing reservation board
projects only the one recorded arrival `travel_detail` row into a minimized immutable
value: mode, carrier, service number, scheduled instant, pickup-requested and whether
the optional pickup-task reference is coherent with the same tenant and exact
property. Task linkage is only an
association-presence statement; it conveys no status, assignment, queue position,
completion or transport outcome. Travel and task identities, notes and Party/contact
truth remain undisclosed, and the projection cannot reorder the reservation board.

Order 207 adds no aggregate, state or automation. The same board separately projects
the one recorded departure `travel_detail` row into an immutable value containing
only mode, carrier, service number and scheduled instant. Nullable values preserve
their validated literal storage. Departure pickup/drop-off meaning, pickup flags,
travel/task identities, notes, Party/contact, vehicle/parking and inferred transport
outcome remain undisclosed. Arrival and departure truth can coexist, but neither can
filter, reorder or change the board cursor.

Order 208 adds no aggregate, state or condition transition. It reads only active
condition-bearing physical `space` rows in one exact tenant/property, where the
same-tenant `unit_condition` association is the canonical physical-space condition
discriminator; `profile_key` remains cross-vertical configuration and is not redefined
as a room kind. The read is ordered by literal room code and id, optionally filtered by
the four recorded condition literals, and paged with a canonical filter-bound keyset
cursor. Its immutable projection contains only space id, code, floor, condition and
condition update instant. Updater, task/assignee, occupancy, reservation/guest,
OOO/OOS, readiness, source/reason and inferred status remain undisclosed, and repeated
reads create no task, fact, event or state effect.

### Asset/Work Order aggregate — target extension

Baseline `task`, `space`, relations, and OOO/OOS provide foundations, but there is no
asset registry. A future model should separate asset identity/history from work execution
and connect downtime to affected spaces. This requires a context/schema decision.

### Account and Folio aggregate — Financials

**Root:** `account`; folio belongs to account.
**Entities:** folio windows, routing policy references, AR allocations.
**Invariants:** reservation links to folio; it does not own it; every window balance is a
projection of postings; settlement/closure is guarded; corrections do not edit history.

Implemented foundation: a tenant-coherent reservation link can open exactly one primary
window on an open property/Party/currency guest account. The account is reused only on
that exact key. PostgreSQL composite foreign keys prevent cross-tenant ownership, and a
locked non-fiscal property series allocates the human folio reference in the same
transaction as the folio and minimized evidence. No balance or economic effect exists
until a later balanced-posting command creates immutable journal lines.

Implemented statement query: one tenant/property-scoped PostgreSQL snapshot projects
the account-owned folio's immutable guest-side lines, signed server balance and
full-ledger running balances. Pages use an opaque folio-bound keyset cursor and expose
only governed attributable revenue-code metadata needed by the approved untaxed charge
command. The query is not a second ledger and creates no fact or event; the browser
never recomputes money or sees counterparty accounts, routing, source, tax detail or PII.

Implemented governed window lifecycle: an open guest-account folio may become settled
only when the shared canonical financial locks are held and PostgreSQL proves its
`folio_balance` is exactly zero. A settled window may become closed only under the same
locks with a still-zero balance. The yellow-owner bounded capability accepts only those
two adjacent transitions; direct runtime folio updates, reopen, force and non-zero
settlement remain unavailable. Durable actor-bound idempotency, the state change, one
identifier/state-only fact and one outbox event share the tenant transaction. No
journal/posting history or account state changes, and folio closure is independent of
reservation checkout, payment/provider settlement, invoice/fiscal issue, tax and day
close.

### Journal aggregate — Financials

**Root:** `journal`.
**Entities:** `posting_line`.
**Value objects:** money, business date, journal kind, account/folio/tx-code references.
**Invariants:**

- one journal balances to zero in one currency at commit;
- journal/posting lines are insert-only;
- sealed days accept only approved adjustment/correction kinds;
- actor/property/business-date/correlation are attributable;
- retry/idempotency cannot duplicate economic effect;
- FX uses explicit journals.

Implemented charge foundation: debit is positive and credit negative. One untaxed
revenue charge creates exactly two immutable lines in one currency/date: the open guest
account and folio receive `+amount`, while the configured property revenue account
receives `-amount` without a folio. PostgreSQL binds line tenant, journal, date, currency,
account and folio ownership; the exact business-day row is locked against sealing.
`tx_code_route` is tenant/RLS scoped and read-only to the application. Quantity is
descriptive fixed-scale metadata and never changes the caller-supplied total.
The operator adapter authorizes statement read and charge write independently, then
delegates economic mutation only to this command. Its statement and charge workbench is
not evidence of tax, invoicing, payment, settlement, fiscalization or checkout.

### Payment aggregate — Financials

**Root:** logical payment operation; persisted state changes in `payment` with tokenized
`payment_instrument`.
**States:** auth → incremental auth* → capture | void; capture → refund*.
**Invariants:** PAN/CVV never enter Yellow; callbacks are idempotent; provider and local
state reconcile; every successful money state has the correct journal; partial amounts,
disputes, and FX remain explicit.

### Business Day aggregate — Financials

**Root:** property + business date.
**States:** open → sealed. Roll opens/advances current operation independently of sealing
previous days.
**Invariants:** property-local date; readiness exceptions visible; sealing deterministic
and idempotent; post-seal history is corrected only by new journals/documents.

### Tax Evaluation value service — Tax/Fiscal

Order 237 is a pure positive-charge calculation service, not an aggregate or state
machine. Its caller supplies one adopted jurisdiction content value and immutable
attributable lines containing exact positive `bigint` minor-unit bases, explicit
revenue groups, nights/person-nights and per-room-night components. The service owns
strict rule validation, exact basis-point/rational arithmetic, positive half-up
rounding, ordered compounding and deeply frozen result attribution. It owns no tenant,
property, date, currency conversion, guest category, assignment or price discovery.

`tax_exclusive` adds the evaluated component; `tax_inclusive` extracts it from the
configured gross. Line rounding occurs per attributable component. Document rounding
produces one rounded total per tax code and deliberately has no line-residual
allocation. Slab-percent is whole-band per room-night: ordered inclusive upper bounds
end in exactly one null band. Stay-average and progressive classification are outside
this model. Ordered per-night output preserves mixed-band evidence. Line-rounded
compounding consumes rounded earlier components; document-rounded compounding fails
closed until allocation semantics are separately authorized.

The service creates no entity and emits no event. Its aggregate India `GST_ROOM`
result is not a legal invoice. Rate-plan/display precedence, negative corrections,
person-category meaning, document allocation and CGST/SGST/IGST place-of-supply
decomposition must be decided by later assignment, posting and fiscal-document
contracts before any economic or legal state change.

### Tax Jurisdiction Resolution value service — Tax/Fiscal

Order 238 is a read-only value service, not an aggregate or state machine. Inside the
active tenant transaction, an exact property id and already-derived property-local
business date select zero or one containing `tax_assignment`. Lower bounds are
inclusive and upper bounds exclusive; zero is explicit `unassigned`, while overlap
is a conflict. The assigned key then requires exactly one active visible
`tax_jurisdiction` version from the established platform-global-plus-tenant extension
adapter. Missing or multiple active versions fail closed, with no tenant-over-global
preference.

The resolved value binds exact assignment bounds, extension id and owner, key,
version, exact database-derived effective-period UTC bounds (nullable when
unbounded), canonical copied content, SHA-256 content hash and deterministic evidence
references, and is deeply frozen. The bounds enter the jurisdiction reference;
resolution does not map a property-local date to an instant or decide containment in
the `tstzrange`. The service creates no entity, emits no event and changes no configuration or
financial/fiscal state. Its output authorizes only a later invocation of the pure tax
evaluator.

### Rate Quote Tax Preview value service — Rates + Tax/Fiscal

Order 239 is a read-only value composition, not an aggregate or state machine. The
existing quote input remains unchanged and carries no tenant, jurisdiction,
assignment or extension selection. The rate service resolves every ordered
property-local night through Order 238 and evaluates only when all nights bind the
same exact extension id, owner, key, version and content hash. Unassigned, partially
assigned or mixed-version stays retain explicit unavailable evidence and no partial
tax total.

The attributable value is restricted to one exact room-only quote of at most 366
nights with no package evidence/allocation, included or extra amount, applied
promotion or discount, and with pre-tax subtotal equal to room total. One
`room_revenue` line preserves ordered nightly `bigint` amounts, exact length of stay
and exact party person-nights; no stay average or person category is inferred. The
active-tenant, exact-property rate plan's currency and `tax_inclusive` truth must
agree with the resolved jurisdiction `price_display`; neither is precedence over the
other and disagreement fails closed.

The deeply frozen result retains per-night assignment evidence, exact extension
identity/version/content/hash evidence and the complete tax evaluation, all bound
into `quoteHash`; HTTP money remains canonical decimal strings. It creates no entity,
emits no event and authorizes no write, price mutation, booking commit, folio,
posting, journal, tax detail, document, provider or fiscal action.

Folio tax preview remains a separate deferred model. Existing folio charges do not
canonically retain revenue group, service night, person-night, quote lineage,
correction attribution and transfer attribution together, so those values may not be
reconstructed from USALI labels or descriptive quantity.

### Positive-tax correction — Financials / Tax-Fiscal

Order266 does not mutate the Tax Attribution Snapshot aggregate or its journal
binding. It appends one financial `adjustment` aggregate whose `reverses` identity
targets an exact governed Order262 charge. Its complete posting set is the exact
sequence-preserving sign inverse of the original, so every account effect nets to
zero without deleting, editing, reclassifying or re-routing historical truth.

The correction root carries database-derived version-2 full-reversal evidence that
references the immutable original journal/binding/attribution lineage and embeds the
exact original version-1 tax evidence. `journal_one_reversal` makes the original the
concurrency root for at most one reversal. The new journal, lines, fact and outbox
events are atomic and immutable. This is accounting correction evidence only; it is
not a refund, settlement, replacement invoice, fiscal credit note, India allocation
or tax-return amendment.

### Property Fiscal Registration — Tax/Fiscal

**Root:** `property_fiscal_registration`.

Order272 introduces one configuration root because a property's statutory supplier
identity is neither versioned jurisdiction policy content nor a person/guest role,
money movement, document or event behavior. Its tenant-leading identity binds one
tenant-owned `org_node.kind='property'`, exact `in-gstin` scheme and `INR`, and the
complete frozen jurisdiction extension id, nullable owner, key, positive version and
content hash. `UNIQUE NULLS NOT DISTINCT` makes one exact mapping structural rather
than a resolver preference.

The root stores only canonical supplier registration evidence: GSTIN, matching current state/UT
code, legal and optional trade name, address line, locality and pincode. It has no
lifecycle or current/effective selection rule. Runtime receives tenant-isolated
SELECT only; provisioning/maintenance is deliberately outside the application
contract. The Order272 value service composes this row with an existing frozen
Order256 eligibility result and returns recursively frozen, deterministic hashed
evidence without creating a fact, event or any financial/fiscal effect.

This root is supplier evidence only. Buyer registrations and customer identity stay
outside it. It does not own SEZ classification, place of supply, CGST/SGST/IGST
decomposition, tax calculation or residual allocation, journals/postings,
correction/credit-note semantics, documents/series/hash chains, IRP payloads,
providers, submissions, UI or HTTP behavior.

### Party Fiscal Registration — Tax/Fiscal

**Candidate root:** `party_fiscal_registration`.

Order276 specifies one typed statutory-registration child of the existing Party
primitive. The Natural-Solution Test rejects mutable Party profile, role, contact and
address data as exact statutory evidence and rejects an extension because registration
is Party-owned legal identity rather than configuration. Party remains the sole
person/organisation primitive; this root does not create a second customer or buyer
entity.

Its tenant-leading identity binds one exact registration UUID to one same-tenant Party
and the sole admitted scheme `in-gstin`. The row contains only canonical registered-
recipient candidate evidence: checksum-valid GSTIN, matching current state/UT code,
legal and optional trade name, address line 1, locality and exact six-digit nonzero
PIN. Tenant RLS and composite tenant/Party identity contain the row. Runtime receives
SELECT only; provisioning and maintenance are outside the application contract.

The Order276 candidate value service requires an exact caller-selected tenant, Party
and registration tuple and accepts only a Party whose status is `active`. Missing,
foreign, merged, anonymised, malformed or mismatched truth fails closed without
falling back to Party profile/role/address, account, reservation or folio data. A
successful read exposes only recursively frozen canonical registration evidence and a
deterministic evidence hash; it creates no fact, event or financial/fiscal effect.

This root records candidate evidence, not legal buyer authority. It does not select
the invoice or folio buyer, build `BuyerDtls`, determine B2C/export/SEZ/deemed-export
treatment, place of supply or supply type, decompose CGST/SGST/IGST, or own tax,
posting, correction, document, provider, submission, HTTP or UI behavior. Its schema
and resolver are independently Tier-3 approved under D-725 with no remaining finding.

### Folio-window Buyer Candidate Association — Tax/Fiscal

Order279 specifies a read-only value service rather than an aggregate or new entity.
The Natural-Solution Test keeps `folio`, `account`, `reservation`, Party and
`party_fiscal_registration` as the sole stored primitives: designation authoring,
lifecycle, supersession and approval policy do not yet exist and therefore must not be
invented as a table or mutable folio attribute.

The service starts from one explicitly selected tenant/property/folio and one
explicitly selected Party/registration pair. It equality-binds the folio to its exact
account and reservation, proves account property equality and account/reservation
currency coherence, then composes approved Order276 recipient evidence with approved
Order278 BuyerDtls bytes. Folio window/status, account role/status, reservation status
and currency are preserved as exact lineage evidence only; they are not eligibility,
settlement, issue or legal-designation policy.

The recursively frozen candidate retains fixed-order property/folio/account/
reservation/window/status/currency lineage, exact Party/registration/evidence lineage,
the exact BuyerDtls payload bytes/hash and one deterministic association hash. A
sibling window is a distinct candidate even for the same Party/registration because
its folio identity and window number are different bound evidence. No account Party,
reservation primary/booker Party, guest role, window name or folio number may infer or
substitute the explicit identities.

This service writes and locks nothing and owns no persisted or legal buyer
designation. It does not determine place of supply, supply type, B2C/export/SEZ/
deemed-export treatment, tax decomposition, posting/correction, document allocation/
issue/number/hash chain, provider/submission, API, HTTP or UI behavior. Fresh
independent Tier-3 execution approves exact Order279 under D-731 with no finding.

### Property Fiscal Location — Tax/Fiscal

**Root:** `property_fiscal_location`.

Order280 introduces one typed physical-property evidence root because supplier GST
registration state is not necessarily the location of the immovable hotel property.
The Natural-Solution Test rejects `property_fiscal_registration`, recipient
registration, `org_node` name/config/path, profiles, spaces, unit types and tax-code
labels as substitutes for this distinct legal fact.

The tenant-leading sole identity `(tenant_id, property_node)` binds one exact
same-tenant `org_node.kind='property'`. The row stores only canonical current Indian
property-location evidence: country `IN`, one current two-digit GST state/UT code,
address line 1, locality and an exact six-digit nonzero PIN. Tenant RLS contains the
row. Runtime receives SELECT only; provisioning and maintenance stay outside the
application contract.

The Order280 value service accepts only an exact tenant/property tuple, reads exactly
that typed row under transaction-local tenant context and returns a recursively
frozen fixed-shape value with a deterministic evidence hash. The hash binds tenant,
property and all location evidence while tenant identity stays outside the returned
value. Missing, foreign, malformed, noncanonical or incoherent truth fails closed
without fallback, locks, facts, events, idempotency evidence or any mutation.

This root is physical-property evidence only. It is a future place-of-supply input,
not a `Pos` or `SupTyp` decision. It does not own accommodation/service
classification, HSN/SAC, B2C/URP, export, SEZ or deemed-export treatment,
CGST/SGST/IGST decomposition or tax rates, reservation/folio/buyer association,
posting/correction, documents/series/number/hash chains, providers, submissions, API,
HTTP or UI behavior.

### India GST Item Classification — Tax/Fiscal

**Root:** `india_gst_item_classification`.

Order281 introduces one typed statutory assignment root because commercial revenue
group, tax code, USALI mapping, posting route, rate plan, profile, space and unit-type
truth are not statutory item identity. The Natural-Solution Test also rejects adding
classification to frozen jurisdiction evidence because that would change the prior
jurisdiction content and evidence hash. This root is therefore one narrow explicit
assignment, not a new product, room, revenue or tax-calculation primitive.

The tenant-leading identity binds one caller-selected classification UUID to one
same-tenant property and the complete frozen positive-tax jurisdiction lineage:
extension id, nullable owner tenant id, key, positive version string and content hash.
One tenant/property/frozen-jurisdiction/room-line assignment is structurally unique. The
stored classification is fixed to country `IN`, line `room`, revenue group
`room_revenue`, system `SAC` and service flag `Y`; its code must be exactly one of
`996311`, `996312`, `996313`, `996321`, `996322` or `996329`. It has no lifecycle,
precedence or inferred-current rule.

Tenant RLS contains the root and runtime receives SELECT only; provisioning and
maintenance stay outside the application contract. The Order281 service accepts only
an exact tenant/property/reservation/classification tuple, reuses exact frozen
positive-tax eligibility and equality-binds the selected row to its complete
jurisdiction identity. It returns only recursively frozen fixed-shape classification
evidence and a deterministic hash over fixed-order unexposed tenant plus every
returned property, jurisdiction and classification field. Missing, foreign, stale,
malformed or incoherent evidence fails closed without fallback, classification writes,
facts, events, idempotency evidence or mutation.

This root is accommodation service-classification evidence only. It is not an IRP
item, place-of-supply or supply-type decision and does not own `ItemList`, `Pos`,
`SupTyp`, B2C/URP, export, SEZ or deemed-export treatment, tax rates or
CGST/SGST/IGST decomposition, seller/buyer/folio-window composition,
posting/correction, documents/series/number/hash chains, providers, submissions, API,
HTTP or UI behavior.

### India Accommodation Place-of-Supply Candidate — Tax/Fiscal

Order282 adds a read-only composed value, not an aggregate, entity, stored root or
state machine. The Natural-Solution Test reuses four approved primitives: Order272
property supplier-registration evidence, Order279 explicit folio-window buyer
candidate evidence, Order280 physical property fiscal-location evidence and Order281
accommodation-classification evidence. No new table, configuration, lifecycle,
writer, fact or event exists for the candidate.

One exact seven-UUID selection names tenant, property, reservation, folio, recipient
Party, recipient registration and classification. Composition requires all roots to
agree on tenant, property and reservation/folio lineage as applicable, to preserve
one complete frozen jurisdiction identity, and to prove `IN`/`INR` lodging service
truth. The explicit Party/registration and folio association stay distinct from the
supplier registration; neither registration state owns the immovable property's
location. Absent, duplicate, stale, malformed, foreign or incoherent evidence fails
closed without fallback to guest, account, org, profile, address or display/config
truth.

The deeply frozen fixed-order candidate body has exactly the keys
`propertyNode,reservationId,folioId,jurisdiction,supplier,recipient,buyerAssociation,
classification,propertyLocation,legalRule,pos`. The nested jurisdiction is the full
frozen extension id/nullable owner/key/version/content-hash identity. Supplier,
recipient, buyer association, classification and property location retain only their
canonical identifiers and evidence/payload/association hashes: raw registration
states, SAC/service/line/group and location state are validated but not duplicated.
`legalRule` is `IGST_ACT_12_3_B`; `pos` comes only from the Order280 property state.

The result appends the fixed-order candidate-body JSON and a SHA-256 over
`JSON.stringify({tenantId,candidate:body})`; tenant is bound but remains outside the
candidate body, JSON and returned value. Replay over identical roots is byte-identical
and neither successful nor rejected composition changes caller or database bytes.
The composing boundary introduces no lock beyond locks inherited from the approved
source resolvers.

The candidate models only the section 12(3)(b) property-place rule. It does not own
or infer intra-state/inter-state status, CGST/SGST/IGST decomposition or rates,
`SupTyp`, `ItemList`, item grouping/ordinal/description/quantity/UQC/unit/gross/
assessable/tax/value fields, posting/correction, document allocation/series/issue/
number/hash chains, providers, submissions, API, HTTP or UI behavior.

### India Accommodation Registered-State Comparison — Tax/Fiscal

Order283 adds one pure composed value, not an aggregate, entity, stored root,
configuration or state machine. The Natural-Solution Test reuses the complete frozen
Order272 supplier-registration evidence and complete frozen Order282 accommodation
place-of-supply evidence. Their existing identifiers, statutory lineage and hashes
already provide every fact this narrow comparison requires, so no new table, column,
extension, service resolver, transaction, lifecycle, writer, fact or event is
introduced.

The exact input is `{tenantId,supplier,placeOfSupply}`. The builder validates both
approved source shapes recursively, independently recomputes the Order272 evidence
hash and Order282 candidate JSON/hash with the supplied tenant, and requires their
property and complete frozen jurisdiction identity to agree. It compares only the
canonical two-digit Order272 `supplier.stateCode` with the exact Order282
`placeOfSupply.pos`. Recipient, guest, account, organisation, profile, configuration
and address states neither participate nor act as fallback.

The deeply frozen fixed-order body has exactly
`propertyNode,reservationId,folioId,jurisdiction,supplier,recipient,buyerAssociation,
classification,placeOfSupply,comparisonRule,stateRelationship`. The source lineage
is minimized but retained exactly: supplier registration/hash/state; recipient Party,
registration and hash; buyer association/payload hashes; classification id/hash; and
place-of-supply candidate hash, legal rule and `pos`. The comparison rule is
`SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS`; the only relationship values are
`same_state_or_union_territory` and `different_state_or_union_territory`. The result
appends fixed-order body JSON and a SHA-256 over
`JSON.stringify({tenantId,candidate:body})`, binding the unexposed tenant. Identical
source bytes replay byte-identically; successful and rejected construction leave the
sources unchanged.

This value records only ordinary registered-state-versus-property-Pos equality. It
does not select the supplier establishment or legally decide location of supplier,
intra-State/inter-State supply or levy routing. In particular, SEZ supplies can be
inter-State despite matching state codes, and the approved sources contain no
bilateral SEZ status or exception-selection evidence. The value does not own SEZ/
non-SEZ, B2C/URP, export/deemed-export, `SupTyp`, `IgstOnIntra`, reverse charge,
CGST/SGST/UTGST/IGST route/rate/amount, rounding/residual, `ItemList` or other item/
value fields. It creates no tax, financial, fiscal-document, provider, submission,
API, HTTP, UI, local-runtime or promotion authority.

### India GST Supplier Service Location — Tax/Fiscal

Order284 adds one narrow typed assignment root because a property-bound GST
registration and physical property address are separate from the statutory location
of supplier of services. `india_gst_supplier_service_location` belongs to one tenant
and exact property fiscal registration/evidence hash. It records only explicit
lodging-accommodation supply from one registered place, its principal/additional
place kind and the fixed IGST section2(15)(a) basis. It is not an establishment,
registration or property aggregate and introduces no lifecycle, writer, event or
mutable configuration authority.

The read service composes the root with complete current approved Order272 evidence
for an explicit tenant/property/reservation. Registration id and evidence hash must
match exactly, so a changed registration, address, jurisdiction or upstream hash
makes the assignment stale rather than silently current. The returned registered-
place state/address/locality/PIN are projections of Order272 only; the assignment
cannot duplicate or repair them. The fixed result is recursively frozen and its
SHA-256 binds the unexposed tenant and complete ordered evidence.

This primitive is limited to section2(15)(a). Fixed-establishment, multi-establishment
most-directly-concerned selection and usual-residence rules remain separate future
evidence. GSTIN/address/property co-location, SellerDtls, org/profile/config and the
Order283 same/different relationship cannot infer or replace the assignment. It owns
no SEZ status, supply nature, levy, rate/amount, `SupTyp`, `IgstOnIntra`, item,
posting, fiscal document, provider/submission, API, HTTP, UI, local-runtime or
promotion identity.

### India GST Recipient SEZ Status — Tax/Fiscal

Order285 adds one narrow typed status root belonging to one exact Party fiscal GST
registration and its current approved Order276 evidence hash. It does not extend the
Party or registration aggregate and adds no lifecycle writer, fact or event. The
root records affirmative official active GST taxpayer-type evidence as of one date;
positive SEZ role additionally carries in-force official approval-form evidence.

The exact statuses are SEZ unit, SEZ developer and affirmatively proven regular/non-
SEZ. Unit evidence is Form G; developer evidence is Form B or co-developer Form C.
Absence, unknown type, inactive GST status, incomplete/expired approval or stale
Order276 hash is unresolved rather than non-SEZ. Multiple evidence dates remain
history selected by exact id; neither the database nor resolver picks a latest row.

The read service revalidates and rehashes complete Order276 truth, equality-binds the
requested status, returns a fixed recursively frozen value and hashes the complete
ordered evidence with the unexposed tenant. GSTIN/address, Party role/profile,
BuyerDtls, account/reservation/folio association, property/Pos or Order283 equality
cannot infer or replace the status. Supplier-side SEZ, authorized operations, zero
rating, supply nature, levy, IRP/item/document/provider/API/UI/local identity remain
separate future primitives.

### India GST Supplier SEZ Status — Tax/Fiscal

Order286 adds one narrow typed status root belonging to one exact property fiscal GST
registration and its current approved Order272 evidence hash. The resolver reaches
that registration only through complete approved Order284 supplier service-location
lineage. Status is not duplicated per principal or additional registered place; the
location identifies the supplier establishment while the status root remains owned
by the underlying registration. No lifecycle writer, fact or event is added.

The exact statuses are SEZ unit, SEZ developer and affirmatively proven regular/non-
SEZ. Unit evidence is Form G; developer evidence is Form B or co-developer Form C.
Absence, unknown type, inactive GST status, incomplete/expired approval, unsupported
Form F2 renewal or a stale Order272 hash is unresolved rather than non-SEZ. Multiple
evidence dates remain history selected by exact id; neither database nor resolver
picks a latest row or applies a snapshot to a later supply date.

The read service independently validates and rehashes complete frozen Order284 truth,
binds its Order272 registration id/hash to the requested row, returns a fixed
recursively frozen value and hashes the complete ordered evidence with the unexposed
tenant. GSTIN/address, property/org/profile/config, SellerDtls, Order283 equality or
recipient Order285 status cannot infer or replace supplier status. Bilateral supply
nature, authorized operations, zero rating, levy, IRP/item/document/provider/API/UI
and local identity remain separate future primitives.

### India SEZ Unit LoA First Renewal — Tax/Fiscal

Order288 adds one narrow tenant-leading read root for the first issued Form-F2
renewal of one approved Order286 supplier SEZ-unit Form-G status. It neither extends
the registration/status aggregate nor adds a lifecycle writer, fact or event. The
root stores the original Form-G citation, the issued Form-F2 citation, exact
Development Commissioner status evidence and one finite canonical renewal validity.

The only supported relation is direct first-renewal continuity: the renewal lower
bound equals the upstream Form-G exclusive upper bound. The original reference and
evidence hash equal Order286; stored issue chronology is Form-G citation, then Form
F2, then or on the explicit status date; and that date lies inside the renewal `[)`
range. The issued five-year or shorter range is accepted exactly without calculating
or imposing duration. Gap, overlap, later-chain, Form-F1, developer, regular, missing
or stale evidence is unresolved.

The read service fully revalidates and rehashes exact frozen Order286 evidence,
equality-binds the requested tenant/status/root/date, and returns fixed recursively
frozen minimized lineage plus original LoA, renewal, exact-continuity relation, legal
rule and tenant-bound SHA-256. The Form-F2 document hash binds its cited original
issue date; Order286 does not expose that date, so no independent date comparison is
claimed. This root owns no supply-nature, authorized-operations endorsement, BLUT,
zero rating/refund/payment route, levy, IRP/item/document/provider/API/UI or runtime
identity.

### India Accommodation Supply Nature — Tax/Fiscal

Order287 adds one pure composed value, not an aggregate, entity, stored root,
configuration or state machine. The Natural-Solution Test reuses the complete frozen
Order283 registered-state comparison, Order284 supplier service location and
Orders285-286 affirmative recipient/supplier SEZ-status evidence. Their existing
identifiers and tenant-bound hashes provide all facts required by this narrow legal
precedence step, so no table, column, extension, resolver transaction, lifecycle,
writer, fact or event is introduced.

The exact input carries one explicit canonical property-local `supplyDate` and the
complete four approved roots. Each upstream shape, fixed-order JSON and hash is
independently revalidated. Property/reservation/folio/jurisdiction/Pos, supplier
registration and location, and recipient Party/registration lineage must agree at
every overlap exposed by the approved roots.
Both affirmative status evidence dates must equal the explicit supply date. There is
no prior/latest/nearest selection, server-clock use, inferred date or recipient-state,
address, GSTIN, name, profile or configuration fallback. The date is an explicit
applicability coordinate; this value does not determine statutory time of supply.

The statutory precedence is closed and deterministic. Any supply to or by an
affirmatively proven SEZ unit/developer is inter-State under IGST section 7(5)(b),
including an otherwise same-State/UT relationship. Direction is retained as to-SEZ,
by-SEZ or both. Only affirmative regular/regular evidence reaches the ordinary
comparison: same State/UT is intra-State under section 8(2), while different
State/UT is inter-State under section 7(3). The fixed result preserves minimized but
complete approved lineage, exact supply nature/basis/direction/legal-rule evidence,
fixed-order candidate JSON and a tenant-bound SHA-256, and is recursively frozen and
byte-identical on replay.

This value owns only the bilateral accommodation intra/inter-State evidence. It does
not own levy, exemption, reverse charge, CGST/SGST/UTGST/IGST decomposition, rate,
amount, rounding, `SupTyp`, `IgstOnIntra`, item/value, posting, correction, fiscal
document, provider/submission, API, HTTP, UI or runtime identity. Form F2 renewal
continuity remains a future supplier-status primitive. Authorized-operations proof,
including specified-officer endorsement, and any zero-rating/refund/payment-mode
decision remain separate future primitives; SEZ status and inter-State character do
not imply either.

### Positive Tax Attribution Snapshot value service — Tax/Fiscal

Order 240 is a pure immutable value service, not an aggregate, entity or state
machine. Version 1 has exactly one positive `rate_quote` origin. It converts one exact
calculated Order-239 room preview into JSON-safe lineage binding the quote SHA-256,
currency, stable line id and `room_revenue` group, input amount, nights,
person-nights, ordered room-night amounts, ordered business-date assignment evidence,
exact jurisdiction extension identity/version/content hash, evaluator country,
display and rounding modes, exact totals, ordered tax totals and ordered line
components.

All money and quantities in the value are canonical non-negative decimal strings;
there is no runtime `bigint`, float, exponent form, signed zero, unsafe magnitude or
non-finite representation. Creation requires exact whole-value reconciliation:
ordered room-night amounts equal the input amount, evaluator input is that same
amount, base plus tax equals grand total and every tax total equals its components.
Ordered nights, assignments and components remain unique and coherent. The
deterministic `snapshotHash` covers the complete canonical value except the hash field
itself, so quote identity, jurisdiction identity/content and every attribution amount
share one tamper-evident boundary.

Creation and exact parsing accept hostile input only by full validation. Unknown
fields, getters/accessors, cycles, malformed UUID/hash/currency/date/reference or
decimal values, duplicates, incorrect ordering, mismatched totals and unsupported
signs fail closed. Neither operation mutates its input; both return the same
recursively frozen canonical truth.

The value service owns no persistence or economic transition. It creates no database
row, fact or event and authorizes no reservation/hold/commit, folio, posting, journal,
tax detail, correction/reversal, transfer, document, numbering/hash chain, invoice,
CGST/SGST/IGST allocation, IRP, provider, submission or fiscal-final state.

### Tax Attribution Snapshot aggregate — Tax/Fiscal

**Root:** `tax_attribution_snapshot`.

Order 244 persists one exact Order-240 positive `rate_quote` snapshot as a distinct
append-only tenant root. PostgreSQL owns the root identity and constrains its tenant,
contextual property, recording actor, schema version, origin kind, quote hash,
snapshot hash and currency alongside the complete canonical JSON value. Same-tenant
same-hash recording converges to one root rather than creating competing evidence.

**Command:** `recordPositiveSnapshot(snapshot, idempotencyKey)` re-parses the hostile
value, derives all duplicated identity from it, proves the exact property and actor
inside the active tenant transaction, and records root, fact, minimized outbox event
and idempotent receipt atomically. **Query:** tenant-scoped read by root id re-parses
stored JSON and rejects any disagreement with constrained identity before returning
deeply frozen truth.

This aggregate records evidence, not economic or legal state. Its property is audit
context only and is not quote-to-property authority. It has no transition, update,
delete, correction or supersession path, and it owns no hold, reservation, folio,
journal, posting, tax detail, document, series, submission or provider effect. A
later authoritative re-quote and booking command must bind the evidence before any
consumer may infer acceptance or money movement.

### Quoted Tax Hold Binding aggregate — Tax/Fiscal

**Root:** `tax_attribution_hold_binding`.

Order248 creates one immutable tenant/property association between an existing cart
hold and an existing `tax_attribution_snapshot`. Its duplicated quote and snapshot
hashes must agree with the attribution root, and its sellable/stay identity must agree
with the active cart hold at creation. Runtime receives no raw table DML; a bounded
owner capability inserts only after those exact references and active-tenant context
are proven.

**Command:** `placeQuotedTaxHold(quote, ttl, idempotencyKey)` takes the release
publication lock, authoritatively re-quotes, derives the canonical snapshot and calls
the existing hold and attribution owners before binding them atomically. The root has
no update or delete transition. Hold expiry/release is retained independently and
does not erase the evidence association. The aggregate grants no reservation,
posting, document, tax return or submission authority.

### Document aggregate — Tax/Fiscal

**Root:** `document` under `document_series`.
**Entities:** fiscal submission(s), hash chain, rendering/storage reference.
**States:** draft → issued → cleared | rejected; jurisdiction-governed void/correction.
**Invariants:** gapless series allocation, immutable issued document, previous-hash chain,
provider idempotency, exact jurisdiction version, and audit.

### Channel Connection aggregate — Distribution

**Root:** `channel`.
**Entities:** maps, inbound messages, push cursor, raw provider references, target error
queue/reconciliation state.
**Invariants:** canonical Yellow model is separate from provider models; inbound identity
is idempotent; mapping is property/provider/version scoped; canonical commands apply
bookings; failures never mutate canonical truth partially; replay is observable.

### Reporting Projection — Reporting

`stats_daily` and future read models are rebuildable from authoritative state/events.
Each metric requires a definition/version, tenant/property/date scope, completeness
watermark, and reconciliation proof. Reports never become a second transaction system.

### Owner and Management Agreement aggregate — target, research required

Potential roots: Owner, UnitOwnership, ManagementAgreement, OwnerStatement,
PayoutInstruction.
Non-negotiable boundary: guest folios and owner accounting are separate ledgers/claims.
Agreement and payout rules are effective-dated, consented/approved, and survive
reservation cancellation as explicit adjustments. No schema is authorized by this model.

### Market Observation and Revenue Decision aggregates — target

**Observation:** source, subject, observed time, received time, value, currency,
availability semantics, licence/permission, freshness, confidence.
**Decision:** evidence set, model/rule version, recommendation, constraints, expected
outcome, approval/execution, actual outcome.
External absence must distinguish sold out, unavailable, rate limited, and unknown.

### Agent aggregate — target

**Entities:** agent definition, capability grant, autonomy policy, tool budget, task,
recommendation, approval, execution, outcome/evaluation.
**Invariants:** agent identity is auditable; tools invoke domain commands; policy and
normal authorization both apply; context is minimized; retries are idempotent; provider
failure cannot block core operation; consequential output cites evidence and confidence.

## Relationship map

```text
Tenant
 └─ OrgNode (group/brand/region/property/outlet)
     ├─ Users/Roles scoped to organization/property
     ├─ Spaces ──< SellableUnit membership
     │    ├─ Occupancy claims <── Holds / ReservationSegments / OwnerStay target
     │    ├─ UnitCondition / OOO-OOS
     │    └─ Assets target ──< WorkOrders
     ├─ RatePlans ──< RatePrices / Policies / Packages
     ├─ Reservations ──< Segments ──> Occupancy
     │    ├─ ReservationGuests ──> Party
     │    ├─ Group/Block
     │    └─ links ──> Folios
     ├─ Accounts ──< Folios ──< PostingLines >── Journals
     │    ├─ Payments
     │    ├─ AR
     │    └─ Documents/FiscalSubmissions
     ├─ Channels/Maps/Inbound/PushCursors
     ├─ Tasks/Messages/Approvals/Extensions
     └─ Reporting projections

Every committed cross-context change ──> FactLog + OutboxEvent
Automation / Integration / AI ──> authorized Command ──> same aggregates
```

## State machines

### Canonical now

- Reservation: `STATE-MACHINES.md` `1.
- Folio: open → settled → closed.
- Business day: open → sealed.
- Task: documented lifecycle, but application implementation is absent.
- Block: configured statuses with `deducts` semantics.
- Hold: active → consumed | expired | released.
- Payment: authorization/capture/refund lifecycle.
- Document: draft/issued/cleared/rejected with jurisdictional correction.
- Approval: pending → approved | rejected | expired.

### Proposed but not authorized

Owner agreements, work orders/assets, market observations/recommendations, agent tasks,
conversation delivery, and integration error queues need explicit state-machine decisions
before schema or code.

## Command model

A command envelope should converge on:

```ts
interface CommandEnvelope<T> {
  tenantId: TenantId;          // derived from verified identity
  propertyNode?: OrgNodeId;
  actor: ActorRef;             // human, service, or agent
  correlationId: CorrelationId;
  idempotencyKey?: IdempotencyKey;
  expectedVersion?: bigint;
  reason?: string;
  input: T;
}
```

The exact type is illustrative, not an implementation order.

A command handler:

1. verifies identity/tenant/property/scope/policy;
2. establishes one transaction-local tenant context;
3. loads and locks/version-checks aggregate state;
4. validates deterministic rules;
5. performs authoritative writes;
6. appends audit fact and every relevant outbox event in the same transaction;
7. commits;
8. lets adapters perform retryable external effects after commit;
9. returns an outcome with correlation and recovery guidance.

AI and automation do not get a `Tx` or repository directly.

## Command catalogue

### Existing documented commands

Use `docs/CONTRACTS.md` names for availability, reservations, financials, inventory,
rates, stay/housekeeping, profiles, distribution, compliance, and kernel capabilities.

### Existing executable commands/services

- tenant-scoped transaction handling;
- extension type registration and instance creation/list;
- approval request/decision;
- fact recording;
- outbox publish/consume/acknowledge/prune;
- org hierarchy queries;
- migration and seed operations.

### Candidate future commands

Names in the journey map are planning vocabulary only. Before implementation, each must
be reconciled with `CONTRACTS.md`, assigned to one owner, and receive an order with
authorization, idempotency, fact, event, and negative proofs.

## Event model

Existing catalogued events in `docs/EVENTS.md` remain authoritative. A future event must:

- be caused by a committed domain change;
- have one owning producer;
- contain facts/deltas, not entity snapshots;
- use tenant/property/business-date and actor/correlation/causation;
- be idempotent by event ID;
- declare version compatibility;
- identify consumers and replay/rebuild behavior;
- be added by an approved event order before code.

Candidate events in this document are visibly marked target and are not authorized.

## Domain invariants

The Ten Invariants are inherited without restatement or dilution. Additional product
invariants for future orders:

1. A quote is not a hold, and a search result is not a promise.
2. Physical space, room type booked, and room type charged remain distinct.
3. Guest identity, reservation guest occurrence, and payer/account are distinct.
4. Source, booking channel, marketing attribution, communication channel, payment
   source, and market segment are distinct.
5. Physical departure and financial account closure may differ only through an explicit
   governed path.
6. Housekeeping condition, physical occupancy, and OOO/OOS are orthogonal.
7. Canonical inventory/rate/reservation state is independent of provider representation.
8. External retries cannot duplicate local business effect.
9. Configuration and model/rule versions used for consequential decisions remain
   reconstructible.
10. Owner accounting is not guest-folio accounting.
11. AI output is never authoritative state; only accepted commands create state.
12. A material approval is not an execution authorization forever; current state is
    revalidated.
13. A capability is not complete without authorization, failure, audit/event, tests, and
    an appropriate operational surface.
14. Legal/compliance behavior is jurisdiction- and effective-date-specific and cannot be
    inferred from property address alone.

## Open modeling decisions

These need evidence or founder choice before their first order:

1. Separate persisted Stay aggregate versus reservation-segment operational projection.
2. Owner/asset bounded-context placement and accounting depth.
3. Quote persistence and exact hold guarantee (inventory only versus price/policy).
4. Identity merge reversibility and match-evidence thresholds.
5. Property/department attribute-based permission representation.
6. Offline command eligibility and conflict/compensation policy.
7. Configuration lifecycle/effective dating beyond current extension rows.
8. Work-order and asset state machines.
9. Recommendation/observation/agent aggregate schemas.
10. Initial jurisdiction/provider scope.

## Model review checklist

Before any schema change:

- Does an existing aggregate/context already own the rule?
- Is this identity, mutable head, append-only history, or rebuildable projection?
- What is the tenant/property ownership path?
- What state machine and concurrency race exist?
- What cannot be compensated?
- Which command is the sole mutation path?
- Which audit fact and existing/new event are required?
- What data is PII, payment, statutory, financial, or AI-sensitive?
- Which indexes follow measured queries?
- Can configuration express the variation without weakening the model?
- Is the proposed model proven by the next runnable vertical slice?

If those answers are missing, the next artifact is a question/ADR, not a migration.

### Payment operation identity (Order 192)

`payment_operation` is the immutable tenant/property/folio collection identity. It
binds the guest account, tokenized instrument, provider/method, currency, governed
payment code/clearing route, actor and request hashes. `payment` is its append-only
attempt/result history; `provider_event_receipt` is immutable late-provider evidence.
Neither receipt nor durable evidence stores the opaque token or raw provider payload.
The one-capture and no-overpayment policy is part of the aggregate, not adapter choice.

### Hosted deposit identity (Order 193)

`hosted_payment_request` is the tenant/property/folio-bound, expiring generation that
references one deposit-purpose `payment_operation`. It stores a bearer hash and
idempotency/request hashes, never the raw bearer. `deposit_application` is an
insert-only child of the captured operation and its folio; each row names the exact
immutable application journal. Capture belongs to payment history and deposit
liability, while application belongs to the folio ledger, so neither artifact is
silently inferred from the other or from browser state.

### Cashier custody identity (Order 197)

`cash_drawer` is the property/currency identity and
`cash_drawer_denomination` is its governed positive-unit configuration.
`cashier_session` is the mutable open/closed custody head for one drawer, actor and
business date. `cashier_count` plus `cashier_count_line` are insert-only observations;
the database derives their exact bigint total and retains every recount. Closing names
one immutable count and records the expected, counted and over/short evidence. A
non-zero discrepancy also names one distinct-decider approval. None of these identities
is a payment, journal, provider settlement or business-day seal.

### Direct-billing receivable identity (Order 198)

The existing Party owns a `company` or `agent` role; that same Party owns one exact
property/currency `account(role='company')`. Receivable exposure is the immutable
posting sum on that account, not a second balance table. One `journal(kind='transfer')`
links the full positive guest-folio balance to the receivable account, and optional
`approval_request_id` records the one-use authority for an over-limit posting. This is
money movement, not an AR invoice, allocation, aging record, statement or external-GL
identity.

### Arrival pickup work identity (Orders 213 and 228)

The arrival `travel_detail` row owns pickup intent, schedule and its optional exact
task link. The linked canonical `task(kind='guest_request',department='transport')`
owns dispatch lifecycle and assignment; neither row duplicates the other's truth.
Order213 creates and links that task from current intent, while Order228 advances only
the linked task through assignment, work and completion. A done task records only
completed work state: it does not by itself prove a guest boarded, a vehicle arrived,
parking or occupancy changed, check-in occurred, or money became chargeable.

### Arrival room-cleaning work identity (Order 229)

Order 229 adds no root, table or state vocabulary. It composes the existing due-in
reservation and current booked segment, sellable-unit-to-active-space mapping,
canonical `unit_condition`, `task`, active Party plus `staff` role, `fact_log`, outbox
and idempotency primitives. The reservation owns arrival status, its segment owns the
recorded arrival instant and sellable assignment, `space` plus `unit_condition` own
the exact physical room and its canonical dirty/pickup truth, and `task` owns cleaning
work and the selected staff assignee.

The task is the existing work primitive, not a new arrival-cleaning aggregate. Its
minimized stored payload preserves only the `arrival_room_cleaning` source,
reservation id and observed room condition; canonical condition remains outside the
task. One exact room is the concurrency key. An existing assigned or in-progress
housekeeping/space task is the current actionable work identity; open, done, verified,
cancelled and unrelated tasks remain distinct history and are never adopted or
mutated. Creating or returning the task does not prove cleaning progress, readiness,
occupancy or check-in and creates no financial, key, travel, vehicle, parking or
statutory identity.

### Due-in room-assignment identity (Order 231)

Order 231 adds no aggregate, table, event or permission. It composes the existing
due-in reservation, its one latest booked `reservation_segment`, unit type and period,
PostgreSQL-authoritative availability, the sellable-unit-to-one-physical-room mapping,
the occupancy choke point, fact/outbox and idempotency primitives. The segment remains
the assignment owner: its nullable `sellable_unit_id` changes once from null to the
deliberately selected server-admitted unit while `space_occupancy` remains the
authoritative claim history for the exact period.

Candidate room condition is only current nullable evidence owned by
`unit_condition`; assignment neither creates nor changes it and never translates it
into readiness. The command is not room move: it does not close, trim, split or create
a segment and cannot edit an existing assignment. It is not check-in: reservation and
segment statuses remain `due_in` and `booked` until the separate governed check-in
command re-reads every blocker. No task, folio, identity, price, financial,
business-day, statutory, vehicle, parking or queue identity is created or changed.

### Property-local due-in roll identity (Order 232)

Order 232 adds no aggregate, table, event, operator command or segment state. It
composes the existing reservation root, its latest current `booked` segment, stored
property timezone, fact/outbox and idempotency primitives. The arrival boundary is the
transaction-stable PostgreSQL calendar date in that timezone; `business_day` rows,
browser/caller dates and process clocks do not own reservation chronology.

Only the reservation root changes from `reserved` to `due_in`. The locked segment is
identity and arrival evidence and remains byte-equivalent `booked`. Bounded discovery
reveals only due tenant/property scope, while the tenant transaction re-proves the
complete shape. Replay, contention and rollback preserve a single atomic transition
and evidence chain; future, missed-past, foreign, incoherent and non-reserved truth
remain unchanged. The roll creates no occupancy, assignment, condition, task, folio,
identity, financial, statutory, business-day or check-in meaning.

### Property-local due-out roll identity (Order 233)

Order 233 adds no aggregate, table, event, operator command or segment state. It
composes the existing reservation root, latest current `in_house` segment, stored
property timezone and existing evidence primitives. Only the parent changes from
`in_house` to `due_out`; the segment and occupancy remain byte-equivalent current
truth until the separate governed checkout command acts.

Bounded runtime discovery reveals only tenant/property scope, and the tenant
transaction re-proves the complete shape using PostgreSQL's transaction-stable local
calendar date. Replay, contention and rollback preserve a single transition/evidence
chain. The roll creates no checkout, occupancy release, condition, task, folio,
financial, identity, statutory or business-day meaning.

### Room discrepancy identity (Order 235)

Order 235 adds no table, event or parallel occupancy model. It composes the existing
active physical `space`, one exclusive sellable mapping, reservation parent, latest
current segment, `space_occupancy` claim, `discrepancy`, `fact_log`, outbox and
idempotency primitives. PostgreSQL remains the system-presence authority; the
operator supplies only a deliberate observation.

One unresolved discrepancy belongs to one room. Sleep records observed occupied
against system vacant; skip records observed vacant against system occupied; person
records unequal observed and expected persons while both are occupied. Canonical
reported/system tokens preserve that difference without copying reservation,
segment, occupancy or guest identity into the discrepancy read model. Matching truth
has no discrepancy identity. Resolution, carry, queues, messages, room condition,
tasks and financial/day/statutory meaning remain separate primitives and workflows.

### Vehicle parking assignment identity (Order 236)

Order 236 adds no table, event or parking aggregate. A parking slot remains an active
capacity-one exact-property `space` with `profile_key='parking'`. One onsite vehicle,
its exact linked reservation and latest current `in_house` segment compose with the
existing `space_occupancy`, fact, outbox and idempotency primitives.

The vehicle stores only the current parking-space reference; the exclusive occupancy
claim remains authoritative for collision and bounded period truth. The segment owns
the stay bound, PostgreSQL owns the transaction-stable start, and the browser selects
only a returned parking-space identity. Canonical segment checkout deletes the claim
and clears the current pointer; replacement/manual release, entry/exit, unrelated
vehicles, history and automatic allocation remain separate future workflows. Parking
does not change reservation, segment, room, condition, task, folio, financial,
business-day or statutory identity.

### India GST supplier registration-status snapshot (Order 289)

This tenant-leading read root belongs to one exact approved Order272 supplier
registration id/evidence hash and is reached only through complete approved Order284
service-location lineage. Its identity is one explicit evidence date. It records only
affirmative active GST Common Portal status, the exact regular/SEZ-unit/SEZ-developer
taxpayer type, portal-source evidence hash and legal-rule label. Forced RLS and
SELECT-only runtime authority preserve tenant isolation and immutability.

The snapshot is deliberately separate from Order286 historical Form-G/B/C approval
and Order288 Form-F2 continuity because GST registration and SEZ approval can change
independently. Its date is not a caller-selected statutory supply date. A later
composer may consume it only after equality-binding independently approved service-
supply/time-of-supply evidence. Absence, date mismatch, inactive/suspended/cancelled
or unsupported truth remains unresolved.

### India GST accommodation service-provision-date snapshot (Order 290)

This exact 15-column tenant-leading read root belongs to one complete immutable
Order252 reservation/first-segment lineage tuple: property, lineage id, hold binding,
Order240 attribution, reservation, first segment, origin quote hash, canonical snapshot
hash and currency. One finite externally evidenced `service_provision_date` completes
its unique tenant/lineage/date identity. The only admitted provenance is
`governed_service_provision_record`, one lowercase SHA-256 evidence digest and legal
literal `CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY`.

The root does not duplicate reservation or attribution authority. Resolution must
reconstruct the entire Order252 tuple, independently parse the canonical Order240
attribution and require its exact `rate_quote`/`room`/`room_revenue` identity and
quote/snapshot/currency coherence before selecting the explicit root id/date. Forced
RLS, the tenant-leading composite foreign key and SELECT-only `app_role` authority
make it immutable and tenant isolated. There is no application/runtime writer,
ingestion command, source-attestation policy, state transition or event yet;
deployment fixtures represent only externally governed evidence.

The stored date is deliberately independent from Order287 rule-applicability
`supplyDate`, Order240 room-night `businessDate`, Order252 planned period and all
arrival, departure, check-in, occupancy, checkout, journal and posting dates. None is
a fallback, derivation, equality check or substitute, and no clock or latest value may
participate. This root is only a future CGST section 13(2)(b) input. It creates no
time-of-supply result, invoice/payment/tax authority, item, posting, document,
submission, API, UI or local-runtime meaning.

### India GST accommodation payment-receipt-date snapshot (Order 291)

Order 291 adds one narrow externally evidenced payment-date input root:
`india_gst_accommodation_payment_receipt_snapshot(tenant_id,id,
service_provision_snapshot_id,currency,amount_minor,coverage_scope,
supplier_books_entry_date,supplier_bank_credit_date,payment_receipt_date,
payment_receipt_source,payment_receipt_evidence_sha256,legal_rule)`. This exact
twelve-column tenant-leading root belongs to one approved Order290 service-provision
snapshot and its complete Order290→Order252→Order240 property, reservation,
first-segment, hold-binding, attribution, quote-hash, snapshot-hash and currency
lineage. It is not a parallel payment or reservation authority.

Only full canonical Order240 `rate_quote` / `room` / `room_revenue` attribution is
admissible. Positive `amount_minor` must equal its grand total, currency must agree,
and `coverage_scope` is exactly `full_attribution`. Both statutory operands are
retained: supplier-books entry date and supplier-bank-credit date. The stored
`payment_receipt_date` is exactly their `LEAST`, including equal dates. Exact source
is `governed_supplier_payment_receipt_record`, with lowercase SHA-256 evidence and
legal literal `CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY`.

The six-key resolver requires exact tenant, property, reservation, service root,
payment root and receipt date; it revalidates all lineage, attribution, dates,
amount/currency, source, digest and legal rule before returning a fixed-order,
recursively frozen minimized result and tenant-bound evidence hash. Missing,
duplicate, stale, mixed, partial or malformed evidence fails closed. Forced RLS and
SELECT-only `app_role` authority apply; no writer, ingestion, bank/provider lookup or
attestation policy exists. This root is only future section 13 input evidence: it
cannot infer from payment, operation, provider-receipt, journal, posting, folio,
reservation, operational or clock dates, and grants no payment, invoice, voucher,
tax, item, posting, journal, document, submission, API, UI or local authority.

### India GST accommodation invoice-issue-date snapshot (Order 292)

This exact tenant-leading twelve-column root belongs to one approved Order290
service-provision snapshot and the complete Order290→Order252→Order240 property,
reservation, first-segment and canonical room-revenue lineage. It stores external
invoice series, serial and finite issue date as evidence only, plus positive full
attribution amount and matching currency. The exact source is
`governed_supplier_tax_invoice_record`, evidence is lowercase SHA-256, and legal
rule is `CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY`; coverage is exactly
`full_attribution`.

The eight-key resolver revalidates every lineage id/hash and reparses
`rate_quote`/`room`/`room_revenue` before equality-selecting the root. Results are
fixed-order, recursively frozen and tenant-bound without exposing tenant identity;
missing, duplicate, malformed, stale or mixed evidence fails closed. Forced RLS and
SELECT-only `app_role` authority apply, with no writer, ingestion or document
authority. This is only future Rule47/section13 input: it does not issue/render an
invoice or decide validity, numbering, regime, deadline, timeliness, late status or
time of supply, and no operational or financial timestamp is a substitute.

### India GST accommodation invoice timeliness (Order 293)

Order293 adds no entity or table. Its read-only composer uses one equality-bound
tenant-scoped query over approved Order290 service-provision and Order292 invoice-
issue evidence plus explicit ordinary Rule47 policy. The nine-key input includes
`ordinaryRegimeSource` and `ordinaryRegimeEvidenceSha256`; source is
`governed_rule47_ordinary_regime_record`,
legal rule `CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT`; output regime is
fixed `ordinary_rule47_30_day`. It computes the
date-only `serviceProvisionDate + 30 calendar days`; day 30 is timely and day 31
late. Arithmetic is explicit proleptic-Gregorian YYYY date-only arithmetic with
low-year handling and overflow fail-closed. It returns frozen evidence including
both dates, deadline, policy, invoice series/serial, `invoiceIssueEvidenceSha256`,
`serviceProvisionEvidenceSha256`, complete attribution and
`ordinaryRegimeEvidenceSha256` in a tenant-bound evidence hash. Exceptions,
ambiguity, stale or mixed
lineage fail closed; no regime inference, invoice issuance/validity/numbering,
Rule47 selection, section13 result, tax, document, API, UI or local authority exists.

### India GST registration at time of supply (Order 295)

Order295 is a composed evidence read, not a new entity or validity interval. It
revalidates the immutable supplier registration, service-location and exact-date
active-status roots from Order289 together with the complete ordinary
accommodation time-of-supply chain from Order294. The status snapshot is effective
for this result only when its `statusAsOf` equals the explicit time-of-supply date;
no nearest/latest status or historical interval is inferred. The result is the
single affirmative state `active_at_time_of_supply`, with complete predecessor
identity/evidence and a deterministic recursively frozen tenant-bound hash.
# Order294 time-of-supply evidence

Ordinary accommodation evidence selects section 13(2)(a) when invoice issue is within
the inclusive Rule 47 day-30 boundary, otherwise section 13(2)(b). The selected date is
the earlier of invoice/payment for (a), or service/payment for (b). All three candidate
dates remain explicit inputs; no clock, timezone conversion, fallback or inference is
permitted.

### India GST recipient registration at time of supply (Order 296)

Order296 introduces no entity or inferred registration interval. It composes the
immutable Order285 recipient registration/status snapshot with the complete Order294
ordinary accommodation time-of-supply chain only when their explicit dates are equal.
The result is one affirmative evidence state,
`active_recipient_registration_at_time_of_supply`, with complete predecessor hashes
and identity but without tenant, GSTIN or address disclosure. Recipient buyer status,
place of supply, supply nature, levy and document semantics remain separate decisions.

### India GST supply nature and registrations at time of supply (Order 297)

Order297 adds no entity, table or new statutory decision. It binds complete frozen
Order287 supply-nature evidence to the already approved Order295 supplier and Order296
recipient active-registration evidence at one explicit transaction and date. The
composition result is the minimized affirmative state
`supply_nature_and_registrations_bound_at_time_of_supply`; it hides tenant identity
and retains no GSTIN/address payload. Buyer designation, place of supply, levy,
rates, tax, documents and IRP submission remain separate boundaries.
The public evidence projection carries separate supplier and recipient
time-of-supply hashes, `supplierTimeOfSupplyEvidenceHash` and
`recipientTimeOfSupplyEvidenceHash`, because their approved predecessor hash
algorithms differ.

### India GST section 14 payment-proviso boundary (Order 302)

Order302 adds no entity, table or migration. Its pure classifier accepts supplier-books
entry, supplier-bank-credit and an explicitly asserted rate-change date as canonical
civil-date evidence. Credit on/before the assertion, including equality, preserves
the ordinary earlier-of-books/bank date; later credit yields only
`working_day_calendar_required`, without a statutory receipt date or guessed working-day
count. Frozen fixed-order evidence is hash-bound and malformed, surplus, missing or
unsupported input fails closed. This is not governed rate-change or section14
applicability authority and does not implement calendar inference, old/new pairing, the
six-case matrix, rates, tax, posting, documents, API or UI behavior.

### India GST accommodation effective rates (Order 298)

Order298 changes no entity or schema. The existing effective-dated
`in-gst-lodging` extension carries the ordinary accommodation `GST_ROOM` slab:
transaction-value based and document-rounded, 12% through and including INR 7,500
(750000 minor INR), then 18% above it in a null upper band. No nil or 5%
accommodation launch band remains. The fixture and wording follow CBIC Notification
20/2019-Central Tax (Rate), effective 1 October 2019, Notification 04/2022-Central
Tax (Rate), effective 18 July 2022, and the current CBIC services-rate table.
`GST_FNB` remains a separate restaurant example. This content feeds the existing
evaluator only and does not infer effective dates or create section 14, levy
decomposition, tax posting, document, or IRP authority.

### Notification 15/2025 accommodation rate correction (Order 303)

Order298 remains historical predecessor evidence. Order303 changes no entity or
schema; it corrects the current explicit 2026/default `in-gst-lodging` content under
Notification 15/2025-Central Tax (Rate), effective 22 September 2025. The
transaction-value band through and including 750000 minor INR is 5% without ITC,
followed by an unbounded 18% band with ITC. Notification 04/2022's removal of the
below-INR-1,000 exemption remains effective, so no nil band returns. The evaluator,
effective-dated assignment architecture, `room_revenue` scope and unrelated
`GST_FNB` example are unchanged.

### Property-local business-day instant evidence (Order 300)

Order300 adds no entity, schema or inferred legal state. For Order238's already-derived
business date, the exact active same-tenant property owns the IANA timezone and
PostgreSQL derives the half-open UTC envelope from local midnight to the next local
calendar midnight in one transaction. The frozen resolved and unassigned projections
retain the timezone and canonical six-digit `businessDayFromInstant` /
`businessDayToInstant`; resolved references retain those fields beside the selected
extension's Order299 effective bounds. A local calendar day is deliberately not modeled
as 24 hours: daylight-saving transitions can produce 23- or 25-hour envelopes and
awkward offsets remain database truth. This is temporal evidence, not an extension-
applicability or legal conclusion. Containment, overlap, start-instant, split-day,
section-14 and every other rule choosing which extension applies remain forbidden and
require a later authorized policy. Order 301 adds only whole-property-day containment:
`[effectiveFrom,effectiveTo)` must contain `[businessDayFromInstant,businessDayToInstant)`.
Null edges are unbounded and equal edges pass; partial, overlap-only, start-only,
disjoint, or malformed/non-increasing intervals fail closed. The India 2026 lower
instant is `2025-12-31T18:30:00Z` (Kolkata midnight); unassigned values skip extension
reads. No fixed-duration or host/JavaScript clock is used. Section 14, working-day
rules, rate changes, and old/new extension pairing are out of scope.
