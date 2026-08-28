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
version, canonical copied content, SHA-256 content hash and deterministic evidence
references, and is deeply frozen. The extension adapter does not expose
`extension.effective`; resolution therefore neither interprets nor bypasses that
field. The service creates no entity, emits no event and changes no configuration or
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
