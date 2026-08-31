# CONTRACTS.md — API conventions + the interfaces that must not drift

## 1. Conventions (every endpoint)
Base `/api/v1`. Auth: bearer (staff JWT w/ tenant+scopes | api_client). Server derives
`tenant_id` from the token — never from the body. JSON: money `{amount_minor,currency}`,
instants ISO-8601 with offset, stay periods `{from,to}` half-open, ids uuid.
**Idempotency-Key header required on every mutating POST**; the kernel stores
tenant+operation+key-hash → canonical request-hash+exact successful JSON response for
24 h in the command transaction. Exact retries replay; changed requests conflict.
Errors: `{type,title,status,detail,errors?[],correlation_id}` with stable `type`
slugs (`availability/no_fit`, `finance/journal_unbalanced`, `auth/scope_missing`,
`conflict/occupancy`, …). Pagination: cursor `?after=<opaque>&limit≤200`. Filtering:
whitelisted params only. Every response carries `X-Correlation-Id`.

`app_role` is not a credential or external integration contract. It is a `NOLOGIN`,
passwordless, membership-free capability role entered only after verified identity
has established transaction-local `app.tenant_id` on the trusted deployment
connection. Customer/staff login, BI, reporting and integrations must use application
commands or a separately reviewed direct-database principal design. This boundary
does not make a custom GUC immutable against arbitrary SQL already executing inside
the trusted transaction; raw SQL exposure, runtime deployment authority, broad DML
grants and occupancy-function tenant binding remain separate security risks.

### Runtime mutation catalogue

The post-Order-127 runtime contract is positive, not default-open: migration 0016
grants only exact table/column mutations mapped to current production SQL. There
is no mutation privilege on a future table or view, and no generic global or
tenantless write path. `yellow_deploy` remains the deploy/migration/schema/seed
principal; seed creates and verifies canonical global tenant/property rows through
that boundary, while the runtime role performs only the exact read-only
visibility/idempotency probe.

Outbox publication is `runtime_mark_outbox_published(uuid[])`, not direct runtime
`UPDATE`; occupancy, due-hold discovery, consumer cursor and extension listing/
compatibility operations likewise remain signature-specific functions. `document`
has no runtime mutation authority, and `rate_price` exposes only the sanctioned
`superseded_by` update alongside its insert path. Insert-only fact, journal,
posting-line and outbox history has no update/delete contract.

Financial account/folio serialization is exposed only through
`lock_financial_rows(uuid, uuid[], uuid)`. The function is not a write contract:
it returns no row data, accepts one or two distinct accounts plus an optional
folio linked to that set, orders account locks canonically, and remains executable
only by `app_role` inside a tenant-bound runtime transaction. Direct account or
folio `UPDATE` and direct row locking remain outside runtime authority.

The one bounded folio-state mutation is
`transition_folio_status(uuid,uuid,uuid,text)`. It is yellow-owner-owned and callable
only by `app_role` from the exact `yellow_runtime` tenant transaction. The action is
only `settle` (`open -> settled`) or `close` (`settled -> closed`); the capability
relocks the canonical guest account/folio, proves exact property ownership and a
canonical `folio_balance` of zero, then performs one guarded status update. It exposes
no general column/table selector, journal/posting mutation, non-zero override, force or
reopen authority. Direct `folio UPDATE`, PUBLIC execution and execution by the runtime
login remain denied.

Platform extension-type registration uses the separately authenticated
`yellow_extension_registrar` only through
`register_extension_type(uuid,text,jsonb,uuid,uuid,uuid)`. The function fixes the
audit operation, derives the UUIDv5 subject, writes the type and first fact atomically,
returns false for an exact replay, and rejects divergent schema. It grants no generic
registrar transaction or direct table-write contract; runtime and `app_role` retain
only instance/read authority.

Residual protected transitions are not generalized by this catalogue: approval
decisions, extension publication, hold state changes, inventory-policy/projection
replacement, operational-block lifecycle, reservation/segment/guest lifecycle,
folio numbering, financial posting, and future task/fiscal/statutory/document
commands require later bounded capabilities. Extension publication/retirement remains
separate from the now-bounded type-registration command.

## 2. THE availability contract (the interface everything hangs off)

`POST /api/v1/properties/{node}/availability:search`
```json
{ "stay": {"from":"2026-09-01T15:00:00+04:00","to":"2026-09-04T11:00:00+04:00"},
  "party": {"adults":2,"children":[{"age":6}]},
  "unit_types": ["DLX"]?, "rate_plans": ["BAR"]?,
  "attributes": {"gender_policy":"female"}?,        // hot-column predicates only
  "channel": "direct", "currency": "AED"?,
  "selected_promotion_codes": []?,
  "commercial": {"company_party_id": "uuid", "market_group_code": "CORP",
    "market_code": "BUSINESS", "source_party_id": "uuid", "source_code": "DIRECT",
    "channel_code": "direct", "segment_code": "TRANSIENT", "agent_party_id": "uuid",
    "campaign_code": "SUMMER"}? }
```
→ `{options,issues,summary}`. Every published pair remains visible as one deterministic option:
`{option_ref,state,reason,bookable,promise:false,commit_arbitration_required:true,sellable_unit,
unit_type,rate_plan,release,stay,party,per_night:[{date,amount_minor}],total,taxes[],
tax_assignment_state,policies{cancellation,deposit,guarantee,no_show},package,
selected_promotion_codes,applied_promotion_codes,refund_treatment,restrictions_applied[],
operational_blocks_applied[],available_count,evidence}`. Only `state=bookable` carries nightly
money and a pre-tax total. Blocked/unpriced/conflicted published pairs retain physical count and
causes with null total and no offered nightly price. Missing publication/pricing evidence is
reported through bounded stable issues; more than 1,000 exact sellable/rate pairs is rejected,
never truncated.

This transitional authenticated surface accepts exact offset instants because property stay-date
and check-in/out conversion policy is not yet implemented. Returned night dates are derived in the
property's IANA timezone. Live tenant-scoped PostgreSQL occupancy, restrictions and OOO/OOS are the
sellability authority. The disposable availability projection may contribute only attributable
occupancy-responsive **pricing** input; Valkey is not read here. `option_ref` is evidence correlation,
not a stored or signed capacity token. **Search is never a promise**: hold/direct commit re-runs the
PostgreSQL choke and may return `409 conflict/occupancy`.

Until the inherited operator diagnostics are migrated, the disjoint legacy authenticated body
`{from,to,partySize,ratePlanId?,channelCode?}` returns the existing raw truth-availability options.
It creates no alternate sellability or commit authority.

`POST /availability:hold` {option_ref | unit_type+stay, ttl_s≤900} → `{hold_id,expires_at}`
(writes occupancy via choke; this IS the arbitration).

Transitional authenticated operator surface for preparing degraded operation:
`GET|POST /api/v1/properties/{node}/offline-leases` and
`POST /api/v1/properties/{node}/offline-leases/{id}/release`. Placement accepts one exact
currently bookable sellable id, UTC `[from,to)`, stable device id, optional non-guest device
label, and an explicit integer `leaseHours` from 1–168. PostgreSQL derives expiry and the
existing hold/occupancy lifecycle arbitrates. This reserves capacity only: offline reservation
creation, lease consumption, device authentication during sync, and conflict resolution remain
future reservation/PWA contracts.

`POST /reservations:commit` {hold_id? | direct option, guest{party|inline}, payment{...},
idempotency} → 201 reservation | 409 `conflict/occupancy` (someone won the race) |
Positional (bed) claims: on exclusion violation the server retries the next free
position, max 3 attempts, THEN returns 409 — losers of a bed race don't fail while
other beds remain free. Exclusive claims never retry (the space is simply taken). |
422 policy/payment. Direct commit without hold attempts the choke write inside the txn.

The internal commit command first asks inventory for a frozen, read-only direct-claim or
locked cart-hold preparation. It inserts the exact reservation and segment parents in the
same uncommitted transaction, then inventory revalidates and acquires through the existing
occupancy choke. Acquisition must match every prepared inventory identity, period and claim
count. Any conflict, stale preparation, mismatch or later audit/event failure rolls the
provisional parents and idempotency claim back; no provisional reservation is externally
visible or durable.

Database choke points use signature-specific `SECURITY DEFINER` authority. Their
fixed search path is exactly `pg_catalog, public, pg_temp`, all Yellow relations
and helper calls are schema-qualified, and `PUBLIC` has no execute privilege.
The application role can only record/release occupancy. Business-day sealing,
outbox pruning, legacy hold expiry, and the day-open assertion are owner-only.
Owner-only sealing is a temporary least-privilege containment boundary, not an
application contract or completed continuous day-close product. A future close path
must introduce an authorized, audited domain command with server-derived actor
evidence before receiving narrowly scoped execution authority. Negative outbox
retention fails with SQLSTATE `22023`. This containment does not replace
tenant-authority validation or RLS.

## 3. Module surfaces (names are the contract; bodies follow §1 shapes)

**reservations**: create/commit · get · modify (diff-based) · cancel · reinstate ·
check_in {segment,space?,keys?} · check_out {settlements[]} · move {to_space} ·
extend/shorten · group: create/status/allotment/rooming_list(bulk)
**financials**: postCharge {folio,tx_code,amount,qty} · transfer {lines[],to_folio|account} ·
adjust {reverses_line,reason} · folio: open_window/get/statement/settle/close ·
routeRules→Automation CRUD · deposits: request/apply ·
cashier: open/close · day: readiness/seal · ar: invoice(from folio)/allocate/statement
**inventory**: spaces/unit_types/sellable_units CRUD · restrictions batch ·
ooo/oos open+close · authority get/set · projection rebuild (admin)
**rates**: plans CRUD · prices batch-insert (insert-only; supersede) · packages · policies
**hk/stay**: condition set · tasks CRUD/assign/complete/verify · sheets generate ·
discrepancies · queue · messages send/thread
**profiles**: parties search(trgm)/create/merge/anonymise · consent · instruments(tokenize via PSP webhook)

Reservation operator reads use `reservations.lifecycle:read` plus the caller's granted
property scope. `GET /api/v1/properties/{property}/reservation-board` returns at most
100 operational rows (default 50), ordered by `created_at DESC, id DESC`, and accepts
only `status`, paired ISO-instant `from`/`to` stay overlap (maximum 366 days), canonical
opaque `after`, and `limit`. OFFSET, guest/contact/search query parameters and contact,
identity, note, history, payment, tax or inferred-total row fields are not part of the
contract. Each row carries `arrivalTravel: null | {mode,carrier,serviceNo,scheduledAt,
pickupRequested,pickupTaskLinked}` from only the recorded `direction='arrival'` travel
row. Nullable mode/carrier/service/schedule values remain literal validated storage;
`pickupTaskLinked` means only that the recorded task reference resolves in the same
tenant and exact property. It exposes no travel/task id, note, Party/contact, task
state or inferred pickup outcome. Each row separately carries
`departureTravel: null | {mode,carrier,serviceNo,scheduledAt}` from only the recorded
`direction='departure'` row. Its nullable values remain literal validated storage; it
exposes no pickup/drop-off meaning, pickup flag, travel/task id, note, Party/contact,
task state, vehicle/parking truth or inferred transport outcome. A hostile arrival
task association fails the complete board read closed. Neither travel association
alters the existing `(created_at,id)` order, filter, cursor, limit, permission or
property boundary. `GET
/api/v1/properties/{property}/reservations/{reservation UUID}` accepts no
query parameters and returns the approved reservation aggregate plus server-derived
`canModify`, `canCancel`, and `canReinstate` actions. Missing, foreign-tenant and
foreign-property UUID details share one generic reservation not-found response. The
existing exact `GET .../reservations?confirmationNo=...` lifecycle lookup is unchanged.

Order 212 travel capture is `PUT
/api/v1/properties/{property}/reservations/{reservation}/travel/{arrival|departure}`
with `reservations.lifecycle:write`, the exact property grant, a mandatory printable
visible-ASCII `Idempotency-Key`, and body exactly `{expected,travel}`. `expected` is
`null` for create or the exact current tuple for replacement; `travel` is always the
exact tuple `{mode,carrier,serviceNo,scheduledAt,pickupRequested}`. Mode is nullable or
`flight|train|bus|car|ferry|other`; schedule is nullable or a canonical UTC instant;
carrier and service number are nullable trimmed nonblank Unicode strings bounded to
120 and 64 code points. At least one desired value must be recorded, departure cannot
request pickup, and there is no delete command.

The command derives tenant, property, reservation, direction, actor and audit envelope,
locks the exact reservation in `reserved|due_in|in_house|due_out`, and performs one
normalized tuple compare-and-set. Stale evidence is a bounded conflict. A changed
command writes only the travel row plus one minimized `reservation.modified` fact and
same-transaction outbox event; an exact no-op writes neither evidence row, and exact
replay is stable. Notes and pickup-task ids are neither accepted nor returned. A
changed command fails closed when the travel row is already linked to pickup work;
it never creates, detaches or edits a task and has no vehicle, parking, occupancy,
financial, statutory or board-read effect.

Order 213 pickup automation is a specialized durable consumer, not a generic
automation-engine claim and not an operator command. On `reservation.modified` it
re-reads current database truth and acts only for an exact `reserved|due_in`
reservation whose arrival row still has `pickup_requested=true`, a recorded
`scheduled_at`, and no linked task. It atomically creates one existing
`kind='guest_request'`, `status='open'`, `subject_type='reservation'` task for the
exact property, with department `transport`, due time equal to the recorded arrival,
no assignee, default priority and payload exactly `{requestType:'arrival_pickup'}`;
the same capability links that task to the arrival row. Every ineligible or already
linked current state is a consumed no-op. Task/link and one minimized `task.created`
fact/outbox pair commit with the durable consumer marker. This create-only contract
cannot edit, cancel, assign, transition, detach or delete pickup work.

Order 200 active check-in contract: `GET
/api/v1/properties/{property}/reservations/{reservation}/check-in/readiness` requires
`stay-operations.checkin:read` and the exact property grant. It returns a no-store, server-owned
snapshot `{reservationId,status,segmentId,assignedSpaceId,primaryFolioId,roomCondition,
identityGate{required,satisfied,adapterKey},dirtyRoomOverrideRequired,
dirtyRoomOverrideAuthorized,blockers[],canCheckIn}`. Stable blockers name wrong state,
missing/ambiguous active segment or physical-room mapping, absent condition, unready
room, missing open primary folio, unavailable configured adapter, and missing recorded
identity evidence. The response contains no Party, document, contact, legal-field or
financial data.

`POST /api/v1/properties/{property}/reservations/{reservation}/check-in` requires
`stay-operations.checkin:commit`, the exact property grant, a visible-ASCII `Idempotency-Key`, and
body exactly `{}` or `{reason}`. Tenant, actor, property, readiness and dirty-room
authority are server-derived. A dirty/pickup room additionally requires the distinct
same-property `stay-operations.checkin:dirty-room-override` grant and a trimmed attributable
reason; a ready room rejects an override reason. Success atomically changes only the
exact due-in reservation and its one active booked segment to `in_house`, then writes
one minimized fact and `reservation.checked_in` outbox event with durable actor-bound
replay. It does not create or mutate accounts, folios, occupancy claims, keys, money,
business days, statutory submissions, tax/fiscal documents or checkout state.

Identity readiness is selected only by `org_node.config.statutory_adapter_key`. The
key must resolve to exactly one effective active tenant-owned `statutory_adapter` with
a non-empty valid `required_identity_fields` declaration. When selected, every Party
attached through `reservation_guest` (plus the primary Party) must have at least one
recorded `identity_document`; field semantics, nationality rules, validation and
submission remain adapter-owned Phase 8 work. No country code is embedded in check-in
logic.

Implemented domain slice: `PartyProfileService.search` performs tenant-bound, bounded
active-Party lookup by UUID, display name, or canonical contact and returns masked
contact hints. `PartyProfileService.create` normalizes Party roles/contacts, requires
exact server-recomputed duplicate acknowledgement, and atomically records non-PII
fact/event/idempotency evidence.

Implemented operator adapter: `POST /api/v1/properties/{property}/parties:search`
accepts exactly `{query, limit?}` in the body so identity search terms do not enter URLs;
`POST /api/v1/properties/{property}/parties` accepts the bounded canonical create shape
and header-only idempotency key. The routes require distinct `crm.parties:read/write`
scopes plus an exact grant for the selected property, while tenant and actor come only
from the authenticated transaction. Duplicate review is `409
profiles/duplicate_review_required` with masked candidates; exact acknowledgement is
recomputed by the domain. The operator workbench deliberately selects one returned
server Party id before the existing booking journey. Merge/anonymisation, addresses,
identity documents, consent/preferences and profile editing remain planned.
**distribution**: channels connect · maps CRUD · inbound replay {id} · push status/cursors
**compliance**: documents issue/get/render · fiscal submit/status · statutory list_due/submit ·
erasure request/execute
**kernel**: extensions CRUD+activate · automations CRUD+test(dry_run) · approvals decide

Implemented financial foundation: `FolioService.openPrimary(tx, input)` accepts only
`tenantId`, `reservationId`, `idempotencyKey`, and the audit envelope. It locks and
derives the eligible reservation's property, primary Party, and currency; reuses the
exact open guest account keyed by tenant/property/Party/currency; and creates reservation
window 1 with a locked non-fiscal `document_series(kind='folio')` reference. Account,
folio, counter increment, minimized `folio.opened` fact/outbox event, and durable
idempotency are one transaction. An exact existing open window is returned unchanged.
This slice does not post money or implement extra windows, settlement, payments,
tax/fiscal behavior, cashiering, day close, or AR.

The operator exposes that existing command only as
`POST /api/v1/properties/{property}/reservations/{reservationId}/primary-folio` under
the distinct property scope `financials.folios:open`. The request body is exactly `{}`
and the existing visible-ASCII `Idempotency-Key` header is mandatory. Tenant, actor,
property and `folio.opened` audit authority are server-derived. A changed result is
`201`; an existing/replayed result is `200`. The safe response contains only folio id,
reservation id, human folio reference, window `1`, and server `changed`/`replayed`
truth; account, Party and other PII never cross this adapter. Reservation commit does
not call this endpoint or create a financial artifact automatically.

Implemented posting slice: `ChargeService.postCharge(tx, input)` accepts an open folio,
governed revenue tx code, canonical positive int64 decimal-string total, optional
fixed-scale quantity, idempotency key and audit envelope. It server-derives the exact
property, currency, local calendar business date and read-only `tx_code_route`, then
atomically posts one debit-positive guest/folio line and equal credit-negative revenue
line. Journal, immutable lines, minimized `journal.posted` fact/outbox and idempotency
share one transaction; the business-day latch serializes against sealing. This amount is
explicitly untaxed and quantity is descriptive, never multiplied. Tax allocation,
scheduled/nightly charges, route authoring, transfers, payments,
settlement and fiscal behavior remain planned.

Implemented immutable correction slice: `ChargeCorrectionService.reverseCharge(tx,
input)` accepts only server-derived tenant/property/actor authority, an exact open folio,
an exact original journal UUID, a trimmed visible 1–500 character reason, durable
idempotency key and audit envelope. The original must be the canonical two-line untaxed
`ChargeService` journal for that folio. The command deterministically locks financial
rows, arbitrates the tenant/original pair, locks both the original and current property
business-day rows, then inserts one current-date `adjustment` header with
`reverses=original.id` and exact sign-negated immutable line copies. A tenant-leading
partial unique index allows at most one correction. Original bytes never change;
idempotency, fact and `journal.posted` outbox evidence settle in the same transaction.

`POST /api/v1/properties/{property}/folios/{folioId}/adjustments` requires the exact
property grant `financials.adjustments:write`, mandatory visible-ASCII
`Idempotency-Key`, and body exactly `{reversesJournalId,reason}`. If either the original
or current business day is sealed, the verified identity must additionally have the
same property's `financials.adjustments:post-seal`; body and headers cannot assert that
authority. This is direct authorization, not a two-person approval workflow. The
statement exposes distinct `reversesJournalId`/`reversedByJournalId` lineage and
server-derived `correctionEligible`/`correctionReason` per row. Partial correction,
transfer/routing, additional windows, tax, payment, settlement, fiscal documents and
checkout remain outside this slice.

Order 188 multi-window contract: `FolioService.openAdditional(tx,input)` accepts an
exact source folio, bounded unique window name, idempotency key and server audit
envelope. It serializes the same reservation/account family, derives the next window
number and non-fiscal folio reference, and creates at most 20 open presentation windows
over the same guest account, reservation, property and currency. The existing
`financials.folios:open` property grant authorizes this command.

`FolioTransferService.preview/transfer` accepts one source folio, one existing sibling
or one new-window name, 1–50 opaque server group ids, a visible bounded reason,
generation and preview revision. It never accepts amount, account, date, currency,
journal kind or authority. Preview returns exact server-derived before/after window
balances and an unchanged stay total. Commit requires property grant
`financials.transfers:write`, durable idempotency and a fresh preview, then invokes the
bounded owner capability once. Each whole group appends one balanced `transfer` journal
with typed root lineage and equal/opposite guest-account folio lines; original charge
and correction bytes never change. A corrected original/contra pair is indivisible.
Transfer/correction races have one coherent winner. The safe statement projection adds
only sibling-window display metadata and server-owned group metadata; it exposes no
account, Party or PII and the browser performs no money math. These windows organize
later document inputs only: company debtors, AR, tax/fiscal issue, legal invoice buyer,
numbering, printing, payment and settlement remain separate contracts.

Order 196 governed folio-state contract: `FolioSettlementService.settle/close` owns
its tenant transaction and durable actor-bound idempotency. After strict input and
server audit-envelope validation it discovers the property-owned open guest account,
calls the shared canonical financial lock, re-reads the locked folio/account and
`folio_balance`, and invokes `transition_folio_status` once. Settle accepts only an
exact-zero `open` window; close accepts only an exact-zero `settled` window. The
transition, one `folio.settled` or `folio.closed` fact, its outbox event and the stored
idempotent response commit or roll back together. A replay returns the original
result; changed input under the same operation/key conflicts. No journal or posting
line is created, updated or deleted, and the guest account remains open.

`POST /api/v1/properties/{property}/folios/{folioId}/status` is no-store and accepts
exactly `{action:"settle"|"close",idempotencyKey}`. The authenticated operator must
hold the selected property's exact `financials.folios:settle` or
`financials.folios:close` grant. Tenant, actor, property, prior state, balance and
authority are server-derived; the browser cannot assert them. Success is `200` with
server folio/account/reservation/window identities, previous/current status, exact
zero balance and replay truth. This state assertion is not payment/provider
settlement, cashier close, account/reservation closure, checkout, invoice/document
issue, fiscalization, taxation or business-day close.

Implemented operator statement slice: `FolioStatementService.get(tx, input)` resolves
one tenant/property folio by UUID or strict human reference and returns one PostgreSQL
snapshot containing safe folio metadata, exact signed decimal-string server balance and
line count, full-ledger running balances, newest-first immutable keyset pages, governed
revenue-code options and explanatory charge availability. Its strict versioned cursor is
bound to the property, folio and full ordering tuple. It exposes no counterparty line,
account/route id, source, tax detail or Party/contact data and writes no evidence.
`GET /api/v1/properties/{property}/folios/{reference}/statement` and `POST
/api/v1/properties/{property}/folios/{folioId}/charges` require separate
`financials.folios:read` and `financials.charges:write` permissions plus an exact
property grant. POST accepts only a governed code, exact positive int64 string and
optional quantity, takes idempotency from the header, and delegates to
`ChargeService.postCharge`. Statement visibility and an untaxed charge do not imply tax
calculation, invoice/document issue, payment, settlement, fiscalization or checkout.

## 4. Internal context interfaces (in-process, typed)
Each context exports ONLY: `queries` (pure reads), `commands` (Tx-taking, return Result),
`events` it emits. Anything else is private. The MCP server (v3 §10) is generated from
these same command/query surfaces — no privileged path.

## 5. Payment provider port
`PaymentProvider`: createToken(hostedSession) · authorize {instrument,amount,capture:'auto'|'manual',
lodging{checkin,checkout,folio_ref}} · incrementalAuth · capture · refund · void ·
webhook(verify,normalize→payment rows). Implement: `upi` (zero-MDR), `card:<psp>`.

## 6. Automation condition/action AST
condition: `{all:[...]}|{any:[...]}|{not:...}|{path,"op":eq|neq|gt|gte|lt|lte|in|contains,"value"}`
paths address event payload + subject snapshot. action: `{type, ...typed fields}` per
EXTENSIONS.md §automation-actions. Engine executes inside a NEW journal-owning txn.

## 7. FiscalDocumentProvider port (five mandate patterns — v2 §6.1)
prepare(document)→jurisdiction payload (UBL/PINT/IRP-JSON) · submit(payload)→
{mode, authority_ref?, status} · poll(ref) · qr(document) · chain(document,prev_hash).
Implement: `sa-zatca` (clearance, XAdES, PIH chain, TLV QR) · `in-irp` (IRN+signed QR) ·
`ae-asp:<provider>` (PINT AE generate + hand-off; ASP does transmission — UAE law).

### Pure rules-driven tax evaluator

Order 237 adds one in-process positive-charge evaluator for a caller-supplied
`tax_jurisdiction` content value and immutable attributable lines. It performs no
extension/assignment read and accepts no caller-selected rate outside that content.
Each line supplies exact identity, revenue group, positive signed-safe `bigint`
amount, non-negative integer nights and person-nights and, for room revenue, exact
positive per-night components. It derives no property, date, guest category,
occupancy, currency, price, discount or jurisdiction.

The evaluator validates explicit `tax_inclusive|tax_exclusive` price display,
`line|document` rounding and the four adopted modes. Rates must be finite,
non-negative and exactly convertible to integer basis points. Percent, fixed/night,
fixed/person-night and whole-band slab calculations use rational/intermediate
`bigint` arithmetic bounded to signed-safe minor units. `applies_to` matches only the
line's explicit revenue group. A slab chooses the first ordered inclusive
`upto_minor` band for each room-night component and requires exactly one final null
band; averaging a stay or applying progressive/marginal bands is invalid.

Rounding is exact positive half-up. Line rounding rounds every attributable
component; room-night rule evaluation therefore retains ordered per-night components
instead of collapsing mixed rates. Document rounding sums exact rational components
and rounds once per tax code without allocating residual minor units back to lines. `tax_exclusive` adds tax
to the supplied base; `tax_inclusive` extracts the included component without
increasing the supplied gross. `compound_on` may reference only earlier unique tax
codes, and missing, duplicate, forward, self or cyclic dependencies reject the whole
evaluation. Line-rounded compounding consumes the already-rounded attributable
component. Document-rounded compounding is rejected until a document allocation
policy exists; it may not use an invisible per-line residual allocation.

The deeply frozen result retains jurisdiction identity, display and rounding modes,
exact input/base/tax/grand totals and ordered per-code attribution. It writes no row,
fact, outbox event, journal, posting, folio, document or fiscal submission. Precedence
with `rate_plan.tax_inclusive`, negative corrections, person-category derivation,
document residual allocation and India CGST/SGST/IGST place-of-supply decomposition
remain unresolved. Aggregate `GST_ROOM` output is calculation evidence only, never a
legally final invoice or authority to post or issue a fiscal document.
Input lines, room-night components, tax definitions, application groups, dependency
lists, slab bands and rational representation complexity are explicitly bounded so a
valid value cannot become an unbounded arithmetic-work request.

### Effective tax-jurisdiction resolver

Order 238 adds one internal read-only resolver before calculation. Its caller supplies
only an exact property UUID and an already-derived property-local `YYYY-MM-DD`
business date inside a tenant transaction. PostgreSQL tenant truth and an active
same-tenant property are authoritative. The resolver selects assignments whose
`daterange` contains that date with exact `[)` semantics: zero returns explicit
`unassigned`, while more than one fails closed. Tenant id, jurisdiction key and
extension identity are never caller selected.

An assigned key is resolved only through `ExtensionRegistry.listVisible()` using the
database-derived tenant. Exactly one visible active `tax_jurisdiction` row with that
key is required across the existing platform-global-plus-tenant result; zero or
multiple active versions fail closed, and no tenant-over-global preference is
invented. After selecting that exact row, the resolver uses the narrow runtime-only
`runtime_visible_extension_effective_period(tenant,id)` projection. It preserves the
database `tstzrange` bounds as canonical UTC instants (or null for an unbounded end),
rechecks extension id and owner, and fails closed on malformed or changed identity.
The bounds are evidence only: this contract does not convert the property-local date
to an instant or decide containment by the extension period.

Order 300 extends that evidence contract without deciding applicability. In the same
tenant transaction and snapshot, the active property read supplies its database-owned
IANA timezone and PostgreSQL derives the UTC instants for local midnight on the
already-derived business date and local midnight on the next local calendar date.
Resolved and unassigned results both bind `propertyTimezone`,
`businessDayFromInstant` and `businessDayToInstant` as canonical six-digit UTC strings;
resolved evidence references bind the same envelope beside the selected extension's
Order-299 bounds. The interval is a local-calendar day, not a fixed 24 hours: DST may
make it 23 or 25 hours, and non-whole-hour offsets are preserved exactly. Callers may
not provide the timezone or either instant, and JavaScript or the host clock does not
derive them. These property-day and extension-period bounds are evidence only:
containment, overlap, start-instant, split-day, section-14, or any other extension-
applicability/legal rule remains explicitly forbidden until a later bounded policy is
authorized. Order 301 applies one narrow containment predicate: canonical half-open
UTC `[effectiveFrom,effectiveTo)` must contain the complete property-day
`[businessDayFromInstant,businessDayToInstant)`. Missing edges are unbounded; equality
passes. Partial, overlap-only, start-only, disjoint, or malformed/non-increasing
intervals fail closed. Unassigned results skip the extension read. The India 2026
fixture lower bound is `2025-12-31T18:30:00Z` (Kolkata civil midnight). No clock,
JavaScript conversion, implicit timezone, or fixed 24-hour arithmetic participates.
Section 14, working-day rules, rate changes, and old/new extension pairing remain
excluded.

A resolved value deeply freezes the exact assignment bounds and extension
id/owner/key/version/effective UTC bounds, a recursively canonical copied content
value, its SHA-256 hash and deterministic evidence references. Either bound changes
the jurisdiction evidence reference. It is input authority for the pure evaluator
only. Resolution performs no calculation or write and authorizes no quote, posting,
journal, document, number/hash chain, provider action, fiscal submission, fact or
event.

### Attributable rate-quote tax preview

Order 239 composes the existing rate quote with Orders 238 and 237 without changing
the quote request or accepting caller-selected tax authority. `RateQuoteService`
requires an injected Order-238 resolver and resolves every ordered property-local
night. Zero or partial assignment, or mixed extension id, owner, key, version or
content hash across those nights, yields explicit `preview_unavailable` evidence and
no partial tax total; nights are never averaged, split across versions or rounded as
an invented document.

Calculation is limited to an exact, priced, unblocked and conflict-free room-only
quote of at most 366 nights. Package evidence or allocation, included or extra
amounts, an applied promotion or discount, or a pre-tax subtotal unequal to the room
total yields `unsupported_attribution`. The evaluator receives one `room_revenue`
line containing the ordered nightly `bigint` amounts, exact length of stay and exact
`(adults + children) * length-of-stay` person-nights. It derives neither person
categories nor an average nightly slab basis.

The service reads the exact active-tenant, exact-property rate plan currency and
`tax_inclusive` value. That value must agree with the resolved jurisdiction's
`price_display`; neither source overrides the other, and disagreement fails the quote
closed. The quote result retains per-night assignment evidence, exact extension
id/version/content/hash evidence and the complete Order-237 evaluation. This frozen
evidence enters `quoteHash`, and `bigint` money crosses HTTP only as canonical decimal
strings. The preview performs no write, price mutation, booking commit, posting,
journal, tax-detail, document, provider or fiscal action and adds no endpoint.

Folio tax preview is explicitly deferred. Current folio truth does not canonically
attribute revenue group, service night, person-night, originating quote, correction or
transfer for every positive charge. It must not be reconstructed from a descriptive
quantity or a USALI label.

### Canonical positive tax-attribution snapshot

Order 240 adds one pure version-1 transport value for an already-calculated Order-239
room-tax preview. Its sole origin is `rate_quote`; it does not resolve, calculate or
change a quote. Creation binds the exact quote SHA-256, currency, stable revenue-line
id and `room_revenue` group, input amount, nights, person-nights, ordered room-night
amounts, ordered business-date assignment evidence, exact jurisdiction extension
identity/version/content hash, evaluator country/display/rounding modes, exact
input/base/tax/grand totals, ordered tax totals and their ordered line components.
This is complete positive-origin lineage, not a folio reconstruction.

Every stored money and quantity is a canonical non-negative decimal string. Runtime
`bigint`, JavaScript-number or float money, exponent notation, signs, leading zeroes
other than the single value `0`, negative zero, unsafe magnitude and non-finite values
are not snapshot values. Creation reconciles the whole value before hashing:
room-night amounts sum exactly to the attributed input amount, evaluator input equals
that same amount, base plus tax equals grand total, and every tax total equals its
ordered components. Night dates, assignment references, tax identities and component
lineage must be ordered, unique and mutually coherent.

`snapshotHash` is SHA-256 over the complete canonical snapshot excluding only
`snapshotHash` itself. Parsing is an exact hostile boundary, not permissive JSON
normalization: unknown fields, accessors, cycles, malformed UUIDs, hashes, currency,
dates, references or decimals, duplicate or out-of-order nights, mismatched lineage or
totals and unsupported signs fail closed. Builder and parser do not mutate their
inputs and return one recursively frozen value; a successful parse reproduces the
same canonical bytes and hash-bound meaning.

The snapshot is evidence only. Order 240 adds no persistence, fact, event, HTTP or UI
surface and grants no booking, folio, journal, posting, `tax_detail`, correction,
reversal, transfer, tax-payable allocation, invoice, CGST/SGST/IGST split, document,
numbering, IRP, provider, submission or fiscal-finality authority.

### Canonical tax-attribution persistence

Order 244 gives the exact Order-240 value one append-only PostgreSQL owner. The
internal record command first re-parses the complete value through the hostile
Order-240 boundary; callers cannot supply duplicated identity columns separately or
replace canonical snapshot JSON after validation. One active-tenant exact property
and active actor are resolved inside the transaction before the database owner
capability stores schema version, `rate_quote` origin, quote hash, snapshot hash,
currency and the complete canonical snapshot together.

The snapshot hash is the tenant convergence key. Recording the same exact snapshot
again returns the existing immutable root; an idempotent command replay returns the
same frozen receipt, while reuse of its command key with different request meaning
fails closed. Creation writes one `tax.attribution_recorded` fact and one minimized
outbox event in the same transaction. The event contains only attribution, property,
origin, quote-hash, snapshot-hash and currency identity; it never carries the full
snapshot, guest/Party data or financial lines.

Read is tenant scoped and returns only a value that still parses and agrees exactly
with every duplicated identity field. The table and fact are insert-only; the app
role has no raw table mutation and may invoke only the bounded owner-mediated
capability under its exact runtime-role and transaction-local tenant checks.
Persistence proves only that exact positive quote-tax evidence was durably recorded
for contextual property and actor attribution. It does not prove that the quote
belongs to that property, was accepted, protected by a hold, committed to a
reservation, posted, invoiced, submitted or fiscally finalized. Those links require
separate authoritative commands.

### Authoritative quoted-tax cart-hold binding

Order248 adds that first authoritative link without accepting a reservation. The
internal command accepts only the complete strict quote input, the canonical
600-second cart-hold TTL, command idempotency and the actor-bound audit envelope. It takes the
same tenant/rate-plan advisory lock used by release publication before resolving a
fresh quote. The result must match the active tenant, exact property and sellable,
remain live-bookable, have composition state `quoted`, and carry a calculated tax
preview. A caller cannot provide or override quote hash, price, snapshot or tax.

The command derives the canonical Order240 value from the fresh nightly quote and
calculated tax evidence, then uses the existing hold and Order244 persistence owners.
One append-only binding records the resulting hold, attribution, quote and snapshot
identities; one minimized `tax.attribution_bound` fact/outbox pair and the idempotent
receipt share the same transaction. Expiry or release changes only the existing hold
state and never deletes binding evidence. Neither the receipt nor event is a price
promise, hold consumption, reservation, posting, invoice or fiscal authorization.

### Canonical positive tax posting plan

Order251 adds `derivePositiveTaxPostingPlan(snapshot: unknown)` as a pure value
boundary over the Order240 snapshot. It always re-parses the complete hostile input
through `parsePositiveTaxAttributionSnapshot`; a caller cannot bypass canonical
snapshot validation by supplying an object that merely has the expected TypeScript
shape. The function does not mutate its input and returns one recursively frozen
`PositiveTaxPostingPlanV1`.

The version-1 result has exactly these public fields: `schemaVersion`, `quoteHash`,
`snapshotHash`, `currency`, `state`, `blockers`, `revenueLine`, `taxLineage`,
`lines` and `balanceMinor`. It carries `schemaVersion=1`, the exact quote hash,
snapshot hash and currency, and copied positive-origin revenue and ordered tax
lineage from the reparsed snapshot. It neither re-resolves jurisdiction nor
recalculates, averages, allocates or changes any amount. Its state is exactly
`route_ready` or `policy_blocked`. Blockers are deduplicated in canonical order:
document rounding adds `document_tax_allocation_required`; country `IN` or a tax code
matching `/^GST(?:_|$)/` adds
`india_place_of_supply_decomposition_required`. Both blockers may be present.
`route_ready` means only line-rounded, non-India evidence with no aggregate GST code;
it is not financial, legal or fiscal authorization.

The account-agnostic line topology is fixed and ordered under Yellow's
debit-positive, credit-negative convention:

1. one guest-receivable debit for positive `grandTotalMinor`;
2. one room-revenue credit for negative `baseTotalMinor`;
3. one tax-payable credit for each non-zero `taxMinor`, negative and in the
   snapshot's canonical tax order.

Zero tax is valid and emits no tax-payable line, while its exact zero entry remains in
`taxLineage`; positive tax entries emit the ordered credit lines above. Every line
amount is a canonical signed-int64 decimal string, all arithmetic and sign inversion
use `bigint`, and the exact line sum is exposed as `balanceMinor="0"`. `revenueLine`
copies the stable revenue-line identity/group and `taxLineage` copies every ordered
tax-code/component entry needed by a later governed router; the plan invents no
residual, component split or account identity.

This plan has zero execution authority. It accepts no `Tx`, performs no SQL or other
I/O, selects no account, tx code, route, folio, property business date or posting
kind, and writes no journal, `posting_line`, `tax_detail`, fact, outbox event,
idempotency result, document, series, hash chain, submission or provider request. It
does not consume or extend a hold, bind a reservation or folio, authorize a charge,
resolve document-rounding residuals, or derive CGST/SGST/IGST or place of supply.
Those blockers require later explicit policy and a separately authorized,
transactional financial command; no consumer may treat this pure plan as evidence
that posting or fiscal issue occurred.

### Governed positive-tax journal posting

Order262 adds the internal financials-owned
`PositiveTaxPostingService.post(tx,{tenantId,propertyNode,reservationId,
idempotencyKey,envelope})`. The caller supplies identity, idempotency and an audit
envelope only. Orders251/256/259 derive and recheck the immutable lineage, primary
open folio and guest account, exact signed-int64 amounts, configured transaction
codes and explicit revenue/tax accounts. A `policy_blocked` result preserves the
exact ordered `document_tax_allocation_required` and/or
`india_place_of_supply_decomposition_required` blockers and writes no journal,
line, binding, fact, outbox or idempotency row.

A route-ready result writes exactly one balanced `charge` journal: sequence 1 is the
positive grand-total guest debit on the primary folio, sequence 2 is the negative
base room-revenue credit, and later sequences are negative canonical nonzero-tax
credits in tax order. Quantity is `1.000`; zero tax remains in lineage without a
zero posting. The application inserts only the journal header and complete null-tax
credit-line set. The fixed-search-path owner capability revalidates the locked
lineage, snapshot, folio, journal and exact semantic routes, proves sequence 1 is
absent, then inserts that root line once with the exact minimized version-1
`tax_detail` and appends one immutable `tax_attribution_journal_binding`.
`posting_line` remains insert-only; the app receives no direct `tax_detail` insert or
update and no binding-table mutation authority.

All distinct guest, revenue and tax accounts are locked in global UUID order with
the primary folio before the existing locking resolver and property business-day
recheck. The journal, every line, binding, durable idempotency receipt and exactly one
`journal.posted` plus one `tax.attribution_posted` fact/outbox pair commit atomically;
replay adds no domain row, and one immutable lineage converges to one journal across
different keys. This command does not implement document-rounding allocation, India
GST/place-of-supply decomposition, negative tax, correction or reversal, fiscal
documents/numbering/hash chains, IRP/provider submission, payment, settlement,
transfer, HTTP, UI or local promotion.

### Governed positive-tax journal correction

Order266 adds the internal financials-owned
`PositiveTaxCorrectionService.reverse(tx,{tenantId,propertyNode,
reversesJournalId,reason,postSealAuthorized,idempotencyKey,envelope})`. It accepts no
money, tax, account, folio, route, business-date or posting-line input. PostgreSQL
must prove the target is one exact Order262 positive-tax journal with its immutable
posting binding, attribution, reservation/segment/primary-folio lineage, frozen
configured routes and complete balanced posting set.

After globally ordered account/folio and original-identity locks, the command rechecks
all authority and data, locks the original and current financial business days, and
creates one current property-local `adjustment` journal with `reverses=original.id`.
Every original posting is copied in exact sequence with its amount sign-negated;
accounts, folio, transaction codes, descriptions, quantities and currency are not
re-routed or recalculated. The original journal, lines, attribution, binding and route
evidence never change. Existing `journal_one_reversal` permits at most one contra
journal and makes concurrent attempts converge.

Only the reversal root receives database-derived version-2 tax evidence with
`effect="full_reversal"`, exact original/reversal journal and posting-binding lineage,
quote/snapshot identity and the exact original version-1 root evidence. The caller
cannot provide or modify that JSON. Before seal, verified
`financials.adjustments:write` authority is sufficient; when either relevant day is
sealed, the same property's verified `financials.adjustments:post-seal` authority is
also required. A body or header cannot manufacture that authority. Header, complete
contra lines, root evidence, durable receipt and exactly one `journal.posted` plus one
`tax.attribution_reversed` fact/outbox pair commit atomically. Partial correction,
replacement/refund/payment/transfer, India or negative-tax handling, document/IRP and
local promotion remain outside this contract.

### Exact India GST supplier-registration evidence

Order272 adds the internal read-only
`IndiaGstSupplierRegistrationService.discover|resolve(tx,
{tenantId,propertyNode,reservationId})`. Both operations first obtain the existing
Order256 positive-tax eligibility; `discover` preserves its non-locking semantics and
`resolve` preserves its bounded financial lock/re-read semantics. The caller supplies
only tenant, property and reservation identity. Country, currency and the complete
jurisdiction extension id, nullable owner, key, version and content hash come only
from the already-frozen attribution snapshot.

Resolution requires exact `IN`/`INR` truth and one SELECT-only
`property_fiscal_registration` row for scheme `in-gstin` bound to that complete
frozen identity and an exact tenant-owned property. It returns only a recursively
frozen supplier-evidence value containing registration and property ids,
scheme/currency, frozen jurisdiction identity, canonical checksum-valid GSTIN and
matching current two-digit GST state/UT code, legal name, nullable trade name, address line, locality, six-digit
pincode and a deterministic SHA-256 over the canonical supplier-registration
evidence. Replaying identical stored and eligibility truth returns byte-identical
evidence.

Missing, duplicate, cross-tenant, cross-property, non-India, non-INR, malformed,
checksum-invalid, stale or mismatched evidence fails closed. There is no lookup by
current/effective extension, display name, GST-like code, property config, Party or
guest data. This resolver writes no registration, journal, posting, document,
outbox, fiscal submission or idempotency state. It does not determine buyer GST
identity, SEZ status, place of supply, CGST/SGST/IGST decomposition, rounding or
allocation, posting/correction/credit notes, invoice numbering/hash chains, IRP
payloads, provider calls or submission authority.

### Pure India IRP 1.1 seller-details projection

Order275 admits one pure `buildIndiaIrpSellerDetails(source: unknown)` boundary over
the exact approved Order272 `IndiaGstSupplierRegistrationResult`. The input must be
one exact plain, accessor-free result with scheme `in-gstin`, currency `INR`, complete
frozen jurisdiction identity and canonical evidence hash. It projects only this
notified payload shape, in fixed key order:

```json
{"SellerDtls":{"Gstin":"...","LglNm":"...","TrdNm":"...","Addr1":"...","Loc":"...","Pin":560001,"Stcd":".."}}
```

`TrdNm` is omitted only when the exact source trade name is null. GSTIN is exactly 15
characters; legal and trade names are at most 100 characters; address line 1 is at
most 100; locality is at most 50; PIN is an exact six-digit nonzero numeric string
before numeric projection; and state is an exact current GST state/UT code. Missing,
surplus, accessor-backed, checksum-invalid, stale, mismatched or over-limit evidence
fails closed. The builder never trims, truncates, splits, coerces or synthesizes legal
identity.

The frozen wrapper identifies format `irp_json_1_1`, retains the exact
`registrationId` and `evidenceHash` outside the transmitted JSON, and exposes
deterministic `payloadJson` plus its SHA-256 `payloadHash`. Replay is byte-identical;
the source is unchanged; wrapper, lineage, payload and seller details are recursively
frozen. This contract grants no buyer/recipient, SEZ, place-of-supply, supply-type,
tax decomposition, item/value/document, numbering/hash-chain, submission, provider,
database, transaction, API, HTTP or UI authority. The exact pure boundary and its
executable proof are independently Tier-3 approved under D-719 with no finding.

### Exact India GST registered-recipient candidate evidence

Order276 specifies the internal read-only
`IndiaGstRecipientRegistrationService.discover|resolve(tx,
{tenantId,recipientPartyId,registrationId})`. The input must be one exact plain tuple;
the registration UUID is caller-selected rather than inferred from a reservation,
folio, account, Party role or mutable customer profile. Both operations must set and
retain the transaction-local tenant context and select only that exact registration
and its exact Party inside the same tenant.

Resolution requires one active Party and one exact `party_fiscal_registration` row
whose scheme is `in-gstin`. The registration must carry a canonical checksum-valid
15-character GSTIN, its matching current two-digit GST state/UT code, legal name,
nullable trade name, address line 1, locality and an exact six-digit nonzero PIN.
Legal and trade names are bounded at 100 characters, address line 1 at 100 and
locality at 50. The returned recursively frozen candidate contains only the
registration and Party ids, scheme, statutory identity/address fields and a
deterministic SHA-256 `evidenceHash`. Replay over identical stored truth must be
byte-identical.

Missing, foreign, inactive, merged, anonymised, malformed, checksum-invalid or
state/PIN/text-mismatched evidence must fail closed without heuristic fallback or a
write. `party.display_name`, `party.legal_name`, `party.attrs`, contact/address rows,
roles, accounts, reservations and folios may neither substitute for nor enrich the
selected statutory registration.

This value is registered-recipient **candidate evidence only**. It does not designate
the legal invoice buyer or invoice/folio window, build IRP `BuyerDtls`, select B2C
`URP`, export, SEZ or deemed-export treatment, decide `Pos` or `SupTyp`, or authorize
CGST/SGST/IGST decomposition, item/value/tax calculation, allocation, posting,
correction, documents, numbering/hash chains, submission, provider, API, HTTP or UI
behavior. Order276 and its corrected canonical setup descendant are independently
Tier-3 approved under D-725 with no remaining finding.

### Pure India IRP 1.1 buyer-details candidate projection

Order278 specifies one pure `buildIndiaIrpBuyerDetails(source: unknown)` boundary
over the exact approved Order276 `IndiaGstRecipientRegistrationResult`. The input
must be one exact deeply frozen plain, accessor-free result with canonical Party and
registration UUIDs, scheme `in-gstin`, complete statutory identity/address evidence
and canonical evidence hash. It projects only this candidate payload shape, in fixed
key order:

```json
{"BuyerDtls":{"Gstin":"...","LglNm":"...","TrdNm":"...","Addr1":"...","Loc":"...","Pin":560001,"Stcd":".."}}
```

`TrdNm` is omitted only when the exact source trade name is null. GSTIN is exactly 15
characters with a valid checksum and its state prefix must equal `Stcd`; legal and
trade names are at most 100 characters; address line 1 is at most 100; locality is at
most 50; PIN is an exact six-digit nonzero numeric string before numeric projection;
and state is an exact current GST state/UT code. Missing, surplus, accessor-backed,
proxy, malformed, checksum-invalid, mismatched or over-limit evidence fails closed.
The builder never trims, truncates, splits, coerces, normalizes or synthesizes legal
evidence.

The recursively frozen wrapper identifies format `irp_json_1_1`, retains an exact
three-field lineage `{partyId,registrationId,evidenceHash}` outside the transmitted
JSON, and exposes fixed-order deterministic `payloadJson` plus its SHA-256
`payloadHash`. The lineage never enters `payload`, `BuyerDtls` or `payloadJson`.
Replay over identical evidence is byte-identical, the source stays unchanged, and
wrapper, lineage, payload and buyer details are recursively frozen.

This is a payload candidate only. It neither designates the legal invoice or folio-
window buyer nor includes or decides `Pos`, `SupTyp`, B2C `URP`, export, SEZ, deemed-
export, seller, item, value, tax or document fields. It grants no CGST/SGST/IGST,
calculation, allocation, posting, correction, document issue/number/hash-chain,
submission, provider, transaction, SQL, database, API, HTTP or UI authority. Fresh
independent Tier-3 execution approves exact Order278 under D-728 with no finding.

### Exact India GST folio-window buyer candidate association

Order279 specifies one read-only
`IndiaGstFolioBuyerCandidateService.resolve(tx, input)` boundary. Its input
is the exact plain accessor-free five-key object
`{tenantId,propertyNode,folioId,recipientPartyId,registrationId}` with canonical UUIDs
and no surplus truth. One tenant-scoped query must return exactly one folio anchor and
equality-bind the tenant, explicit property and folio together with the folio's exact
account and reservation. Account property must equal the explicit property and the
account and reservation currencies must agree.

The stored folio window number and status, account role and status, reservation status
and common currency are lineage evidence only. No status, role or currency value makes
the candidate a legal buyer or authorizes issue, settlement or any other transition.
The resolver neither reads nor requires a relationship to the account Party,
reservation primary or booker Party, guest role, folio name or folio number. Party and
registration are always the exact explicitly selected Order276 identities.

After resolving exact approved Order276 recipient evidence, the service applies the
approved Order278 builder without changing either value. Its recursively frozen result
has fixed-order property, folio, account, reservation, window/status/currency lineage;
the exact Party, registration and evidence-hash lineage; exact BuyerDtls payload bytes
and payload hash; and one deterministic SHA-256 `associationHash` over that complete
fixed-order evidence. Identical reads are byte-identical. Two sibling windows remain
distinct candidates even when they use the same Party and registration because each
window's exact folio identity and window number are bound into its evidence and hash.

Missing, duplicate, foreign, malformed or incoherent folio/account/reservation or
Party/registration truth fails closed. This read persists and locks nothing, emits no
fact/event, and creates no idempotency evidence. It is a candidate association only:
it does not designate a legal invoice buyer, decide `Pos`, `SupTyp`, B2C `URP`, export,
SEZ, deemed export or CGST/SGST/IGST, or authorize tax, posting, correction, document,
numbering/hash-chain, submission, provider, API, HTTP or UI behavior. Fresh independent
Tier-3 execution approves exact Order279 under D-731 with no finding.

### Exact India property fiscal-location evidence

Order280 specifies the internal SELECT-only
`IndiaGstPropertyLocationService.resolve(tx, {tenantId,propertyNode})` boundary. Its
input must be one exact plain accessor-free, proxy-free and symbol-free object with
only two canonical UUIDs. The service requires the caller-established transaction-local
tenant context and reads exactly one `property_fiscal_location` row equality-bound to
that tenant and property. The same-tenant property reference must resolve to one
`org_node.kind='property'`; neither the node's name, config or path nor any profile,
space or unit-type data may substitute for the typed row.

Resolution requires country `IN`, one current two-digit GST state/UT code, canonical
address line 1 and locality, and an exact six-digit nonzero PIN. It returns only the
recursively frozen fixed-shape value
`{propertyNode,countryCode,stateCode,addressLine1,locality,pin,evidenceHash}`.
`evidenceHash` is deterministic SHA-256 over fixed-order tenant, property and complete
location evidence; tenant identity is hash-bound but remains outside the returned
value. Replay over identical stored truth is byte-identical.

Missing, duplicate, foreign, malformed, noncanonical or incoherent truth fails
closed. There is no fallback to supplier or recipient GSTIN state,
`property_fiscal_registration`, `party_fiscal_registration`, tax-code coincidence or
mutable display/configuration data. The boundary locks and writes nothing, emits no
fact or event and creates no idempotency evidence. It is a future place-of-supply
prerequisite only: it does not emit or decide IRP `Pos` or `SupTyp`, classify
accommodation or service supply, select HSN/SAC, choose B2C/URP, export, SEZ or
deemed-export treatment, derive CGST/SGST/IGST or tax rates, associate a reservation,
folio or buyer, or authorize posting, correction, document allocation/issue/number/
hash-chain, submission, provider, API, HTTP or UI behavior.

### Exact India GST accommodation-classification evidence

Order281 specifies the internal SELECT-only
`IndiaGstAccommodationClassificationService.resolve(tx,
{tenantId,propertyNode,reservationId,classificationId})` boundary. Its input must be
one exact plain, accessor-free, proxy-free and symbol-free object containing only four
canonical UUIDs. The caller-established transaction-local tenant context must equal
the supplied tenant. Before reading classification truth, the service reuses the exact
frozen positive-tax eligibility for the supplied tenant, property and reservation.

Resolution then reads exactly the explicitly selected
`india_gst_item_classification` row and equality-binds it to the same tenant and
property and to the eligibility result's complete frozen jurisdiction identity:
extension id, nullable owner tenant id, key, version string and content hash. The row
must carry country `IN`, line `room`, revenue group `room_revenue`, classification
system `SAC`, service flag `Y` and exactly one of the six admitted accommodation codes
`996311`, `996312`, `996313`, `996321`, `996322` or `996329`.

The recursively frozen fixed-shape result is
`{classificationId,propertyNode,jurisdiction:{extensionId,ownerTenantId,key,version,
contentHash},lineId:"room",revenueGroup:"room_revenue",classificationSystem:"SAC",
classificationCode,isServiceCode:"Y",evidenceHash}`. `evidenceHash` is deterministic
SHA-256 over fixed-order unexposed tenant plus every returned evidence field, including
the complete nested jurisdiction. Identical eligibility and stored truth replay
byte-identically.

Absent, duplicate, foreign, malformed, stale or jurisdiction-incoherent evidence
fails closed. Goods flag, HSN system, arbitrary/non-accommodation code and any
mismatched tenant, property, reservation, classification, line or jurisdiction fail
closed as well. There is no inference or fallback from `GST_ROOM`, `room_revenue`,
USALI, transaction codes, semantic posting routes, rate plans, profiles, spaces, unit
types or property display/configuration truth. Successful and failed classification
reads write no classification, eligibility, tax-lineage, fact, outbox, journal,
posting, document, fiscal-submission or idempotency state.

This evidence is a future item prerequisite only. It does not build IRP `ItemList`,
decide `Pos` or `SupTyp`, choose B2C/URP, export, SEZ or deemed-export treatment,
derive a tax rate or CGST/SGST/IGST decomposition, compose seller, buyer or folio-
window truth, or authorize posting, correction, document allocation/issue/number/
hash-chain, submission, provider, API, HTTP or UI behavior.

### Exact India accommodation place-of-supply candidate

Order282 specifies the read-only
`IndiaGstAccommodationPlaceOfSupplyService.resolve(tx, input)` boundary. `input` is
exactly the plain, accessor-free, proxy-free and symbol-free seven-UUID object
`{tenantId,propertyNode,reservationId,folioId,recipientPartyId,
recipientRegistrationId,classificationId}`; null, arrays, non-plain prototypes,
missing or surplus keys and noncanonical UUIDs fail before composition. The
caller-established transaction-local tenant context remains authoritative.

The service composes, without rewriting, four exact approved roots: Order272 supplier
registration for the tenant/property/reservation; Order279 explicit folio-window buyer
candidate for the tenant/property/folio and exact recipient Party/registration;
Order280 physical property fiscal location for the same tenant/property; and Order281
accommodation classification for the same tenant/property/reservation and exact
classification id. Supplier and classification must carry identical complete frozen
jurisdiction extension id, nullable owner, key, version and content hash. Buyer folio
property and reservation must equal the selected property and reservation, every
currency must be `INR`, the location and both statutory roots must be Indian, and the
classification must remain exact `room`/`room_revenue`/`SAC`/`Y` accommodation
evidence. No source result is normalized, repaired or mutated.

The fixed-order candidate body contains exactly
`{propertyNode,reservationId,folioId,jurisdiction,supplier,recipient,
buyerAssociation,classification,propertyLocation,legalRule,pos}`. `jurisdiction`
retains the full frozen `{extensionId,ownerTenantId,key,version,contentHash}` identity;
`supplier` is exactly `{registrationId,evidenceHash}`; `recipient` is exactly
`{partyId,registrationId,evidenceHash}`; `buyerAssociation` is exactly
`{associationHash,payloadHash}`; `classification` is exactly
`{classificationId,evidenceHash}`; and `propertyLocation` is exactly
`{propertyNode,evidenceHash}`. `legalRule` is `IGST_ACT_12_3_B` and `pos` is the exact
physical-property state. Raw supplier/recipient states, SAC/service/line/group and raw
location state are validated source truth but are not duplicated into those evidence
subobjects.

The result appends `candidateJson`, the exact fixed-order `JSON.stringify` of that
candidate body, and `candidateHash`, the SHA-256 of fixed-order
`JSON.stringify({tenantId,candidate:body})`. Tenant identity is therefore hash-bound
but remains outside the body, JSON and returned result. Identical inputs and source
bytes replay byte-identically; the result and every nested object are frozen.

IGST Act section 12(3)(b) is the only admitted legal rule: hotel accommodation is
located at the immovable property. Supplier GSTIN state and recipient GSTIN state are
retained only in their source evidence and never substitute for, compare with or
change `pos`. Missing, duplicate, stale, foreign, malformed, mixed-tenant/property/
reservation/folio/Party/registration/classification/jurisdiction or hash-incoherent
truth fails closed. There is no fallback to org/profile/address/account/guest/rate/
tax-code/display configuration.

Successful replay and every rejection leave source roots, facts, outbox, idempotency,
journals, postings, documents and submissions byte/count unchanged. Order282 adds no
advisory or row lock beyond any lock already acquired by the approved governed source
resolvers. This is evidence only: it does not decide intra-state versus inter-state,
derive CGST/SGST/IGST or any rate/component/allocation, emit `SupTyp`, build `ItemList`
or any item description/quantity/UQC/unit/gross/assessable/tax/value field, or
authorize posting, correction, document allocation/issue/number/hash chain,
provider/submission, API, HTTP or UI behavior.

### Exact India accommodation registered-state comparison

Order283 specifies the pure in-process
`buildIndiaGstAccommodationRegisteredStateComparison(input)` value boundary. Its
input is exactly the plain, accessor-free, proxy-free and symbol-free three-key object
`{tenantId,supplier,placeOfSupply}`. `tenantId` is one canonical UUID; `supplier` is
the complete exact recursively frozen approved Order272 result and `placeOfSupply`
is the complete exact recursively frozen approved Order282 result. Null, arrays,
non-plain prototypes, missing or surplus keys, unfrozen evidence and malformed nested
shapes fail before comparison.

The builder independently revalidates every fixed-order source field and recomputes
the Order272 supplier evidence hash and the Order282 `candidateJson`/`candidateHash`
from the complete source values, including the unexposed tenant. Supplier property,
complete frozen jurisdiction, registration id and evidence hash must remain coherent
with the place-of-supply property and lineage. Property, reservation and folio come
only from the approved place-of-supply candidate. No source value is normalized,
repaired, supplemented or mutated.

The fixed-order comparison body contains exactly
`{propertyNode,reservationId,folioId,jurisdiction,supplier,recipient,
buyerAssociation,classification,placeOfSupply,comparisonRule,stateRelationship}`.
`jurisdiction` is the complete frozen
`{extensionId,ownerTenantId,key,version,contentHash}` identity. `supplier` is exactly
`{registrationId,evidenceHash,stateCode}`; `recipient` is exactly
`{partyId,registrationId,evidenceHash}`; `buyerAssociation` is exactly
`{associationHash,payloadHash}`; `classification` is exactly
`{classificationId,evidenceHash}`; and `placeOfSupply` is exactly
`{candidateHash,legalRule,pos}`. `comparisonRule` is
`SUPPLIER_REGISTERED_STATE_VS_ACCOMMODATION_POS`. `stateRelationship` is exactly
`same_state_or_union_territory` when the canonical two-digit supplier `stateCode`
equals `placeOfSupply.pos`, otherwise exactly
`different_state_or_union_territory`.

The result appends `candidateJson`, the exact fixed-order `JSON.stringify` of that
body, and `candidateHash`, the SHA-256 of fixed-order
`JSON.stringify({tenantId,candidate:body})`. Tenant identity is hash-bound but remains
outside the body, JSON and result. The result and every nested object are recursively
frozen; identical source bytes replay byte-identically. Successful and rejected calls
leave caller bytes unchanged and perform no transaction, SQL, read, lock, write,
fact, event, journal, posting, document, submission or idempotency effect.

The relationship is comparison evidence only. It is not an intra-State or inter-State
conclusion: the registered state is not a supplier-establishment/location selection,
and IGST Act sections 7(5)(b) and 8(2), together with the SEZ rule, can override an
ordinary same-code comparison. Recipient state is retained only through approved
lineage and never participates in the comparison. Order283 does not infer SEZ or
non-SEZ status, B2C/URP, export or deemed-export treatment, `SupTyp`, `IgstOnIntra`,
reverse charge, CGST/SGST/UTGST/IGST route/rate/amount, rounding or residuals. It does
not build `ItemList` or any item/value field and grants no posting, correction,
document allocation/issue/number/hash-chain, provider/submission, API, HTTP, UI,
local-runtime or promotion authority.

### Exact India GST supplier service-location evidence

Order284 specifies `IndiaGstSupplierServiceLocationService.resolve(tx,input)` with
the exact plain, accessor-free, proxy-free and symbol-free four-key input
`{tenantId,propertyNode,reservationId,supplierServiceLocationId}`. All four values are
canonical UUIDs. The service first obtains complete exact current Order272 supplier
evidence for that tenant/property/reservation, revalidates its fixed shape and hash,
then selects exactly the requested coherent `india_gst_supplier_service_location`
assignment under transaction-local tenant context.

The assignment is current only when its `supplier_registration_id` and
`supplier_evidence_hash` equal the just-resolved Order272 identity. It carries only
the fixed lodging-accommodation scope, explicit `principal_place_of_business` or
`additional_place_of_business` kind,
`supply_made_from_registered_place_of_business` basis and `IGST_ACT_2_15_A` rule.
It never selects latest/effective truth by time. Missing, duplicate, foreign, stale,
malformed or incoherent evidence fails closed.

The recursively frozen fixed-order result is exactly
`{supplierServiceLocationId,propertyNode,jurisdiction,supplier,serviceScope,
registeredPlace,locationBasis,legalRule,evidenceHash}`. `supplier` is exact
`{registrationId,evidenceHash}`. `registeredPlace` is exact
`{kind,stateCode,addressLine,locality,postalCode}`; every location byte comes from
revalidated Order272 rather than the assignment. The final hash is SHA-256 over
fixed-order `JSON.stringify({tenantId,...complete result body except evidenceHash})`,
binding but not returning the tenant. Replay is byte-identical and every success or
rejection leaves all source and effect rows unchanged.

This result proves only the explicit IGST section2(15)(a) registered-place premise.
It does not support section2(15)(b) fixed establishment, (c) most-directly-concerned
multi-establishment selection or (d) usual residence. It does not infer location
from GSTIN/address, property co-location, org/profile/config, SellerDtls or Order283
equality. It grants no SEZ/non-SEZ, supply-nature, levy, `SupTyp`, `IgstOnIntra`,
rate/amount, item, posting, document, submission, API, HTTP, UI, local-runtime or
promotion authority.

### Exact India GST recipient SEZ-status evidence

Order285 specifies `IndiaGstRecipientSezStatusService.resolve(tx,input)` with exact
plain accessor-free, proxy-free and symbol-free
`{tenantId,recipientPartyId,recipientRegistrationId,recipientSezStatusId}` canonical
UUID input. It first resolves complete exact current Order276 recipient evidence,
independently revalidates its fixed shape/GSTIN/hash, then equality-selects the
requested tenant/registration/hash-bound `india_gst_recipient_sez_status` row.

The status row records an explicit `statusAsOf`, active GST registration status,
official GST source and exactly regular, SEZ-unit or SEZ-developer taxpayer type.
Regular is affirmative official non-SEZ evidence and requires no approval tuple.
SEZ unit requires complete in-force Form G evidence; SEZ developer requires complete
in-force Form B or C evidence. Positive approval validity is finite `[)` and contains
the status-as-of date. Missing, unsupported, stale, suspended/cancelled, expired,
foreign, malformed or incoherent truth fails closed; absence never becomes non-SEZ.

The recursively frozen result is exactly
`{recipientSezStatusId,recipient,statusAsOf,gstRegistration,sezStatus,approval,
legalRule,evidenceHash}`. Approval is null for affirmative regular evidence or exact
`{form,reference,validity:{fromInclusive,toExclusive},status,evidenceSha256}` for
positive SEZ evidence. The final hash covers fixed-order
`JSON.stringify({tenantId,...complete body except evidenceHash})`; tenant is bound
but unexposed. `statusAsOf` is evidence time only, not a latest-row or future supply-
date decision.

This contract grants no supplier-side SEZ status, authorized-operations endorsement,
zero rating/refund/payment mode, supply nature, levy, `SupTyp`, `IgstOnIntra`, item,
posting, document, submission, API, HTTP, UI, local-runtime or promotion authority.

### Exact India GST supplier SEZ-status evidence

Order286 specifies `IndiaGstSupplierSezStatusService.resolve(tx,input)` with exact
plain accessor-free, proxy-free and symbol-free
`{tenantId,propertyNode,reservationId,supplierServiceLocationId,
supplierSezStatusId}` canonical UUID input. It first resolves complete exact current
Order284 supplier service-location evidence, independently revalidates and rehashes
its complete frozen shape and underlying Order272 registration id/hash, then
equality-selects the requested tenant/registration/hash-bound
`india_gst_supplier_sez_status` row.

The status row records an explicit `statusAsOf`, active GST registration status,
official GST source and exactly regular, SEZ-unit or SEZ-developer taxpayer type.
Regular is affirmative official non-SEZ evidence and requires no approval tuple.
SEZ unit requires complete in-force Form G evidence; SEZ developer requires complete
in-force Form B or C evidence. Positive approval validity is finite canonical `[)`,
contains the status-as-of date and carries a positive canonical reference. Missing,
unsupported, stale, suspended/cancelled, expired, foreign, malformed or incoherent
truth fails closed; absence never becomes non-SEZ. Form F2 renewal is unsupported.

The recursively frozen result is exactly
`{supplierSezStatusId,propertyNode,supplierServiceLocation:{id,evidenceHash},
supplier:{registrationId,evidenceHash},statusAsOf,gstRegistration,sezStatus,
approval,legalRule,evidenceHash}`. Official status and approval hashes are exposed as
`evidenceSha256`; lineage and the final result use `evidenceHash`. Approval is null
for affirmative regular evidence or exact
`{form,reference,validity:{fromInclusive,toExclusive},status,evidenceSha256}` for
positive SEZ evidence. The final hash covers fixed-order
`JSON.stringify({tenantId,...complete body except evidenceHash})`; tenant is bound
but unexposed. `statusAsOf` is evidence time only, never latest-row inference or a
future supply-date applicability decision.

This contract grants no recipient-status inference, bilateral supply-nature result,
Form-F2 renewal, authorized-operations endorsement, zero rating/refund/payment mode,
levy, `SupTyp`, `IgstOnIntra`, item, posting, document, submission, API, HTTP, UI,
local-runtime or promotion authority.

### Exact India SEZ-unit first LoA-renewal continuity evidence

Order288 specifies `IndiaSezUnitLoaRenewalService.resolve(tx,input)` with the exact
plain accessor-free, proxy-free and symbol-free input
`{tenantId,propertyNode,reservationId,supplierServiceLocationId,
supplierSezStatusId,supplierLoaRenewalId,statusAsOf}`. It first resolves complete
exact Order286 evidence, independently revalidates its fixed frozen shape and
tenant-bound hash, and requires an active `sez_unit` with an in-force Form G. It then
equality-selects only the requested tenant, renewal id, supplier-status id and exact
renewal status date from `india_sez_unit_loa_renewal`.

The selected row is exactly the first directly contiguous Form-F2 renewal:
`lower(renewal_validity) = upper(original Form-G validity)`. Its original Form-G
reference and evidence hash equal Order286, the original issue date cannot follow
the Form-F2 issue date, the Form-F2 issue date cannot follow `statusAsOf`, and the
finite non-empty canonical `[fromInclusive,toExclusive)` renewal validity contains
that date. The resolver accepts the five-year or shorter period exactly recorded; it
does not infer, measure or require a duration. Gaps, overlaps, upper-boundary dates,
later renewal chains, non-Form-G/developer/regular status and stale or malformed
evidence fail closed.

The recursively frozen result is exactly
`{supplierLoaRenewalId,supplierSezStatusId,propertyNode,
supplierServiceLocation:{id,evidenceHash},supplier:{registrationId,evidenceHash},
statusAsOf,originalLoa,renewal,continuity,legalRule,evidenceHash}`. `originalLoa` is
the exact Form-G reference, cited issue date, Order286 validity/status and evidence
hash. `renewal` is the exact Form-F2 file number, issue date, validity, status date,
`in_force` status, `development_commissioner_record` source and both status/document
hashes. `continuity` is exactly `{from:'sez_rules_form_g',
to:'sez_rules_form_f2',exactlyContiguous:true}` and the legal rule is
`SEZ_RULES_19_6_AND_19_6A_3_FORM_F2_CONTINUITY`. The final hash covers fixed-order
`JSON.stringify({tenantId,...complete body except evidenceHash})`; tenant is bound
but unexposed.

This read-only contract grants no Form-F1 authority, Form-F2 authoring, later-renewal
selection, authorized-operations or specified-officer truth, BLUT, zero rating,
refund/payment route, supply-nature change, levy, rate/amount, `SupTyp`,
`IgstOnIntra`, invoice/item/document/submission, posting, API, HTTP, UI, runtime or
promotion authority.

### Exact India accommodation supply-nature evidence

Order287 specifies the pure in-process
`buildIndiaGstAccommodationSupplyNature(input)` value boundary. Its input is exactly
the plain, accessor-free, proxy-free and symbol-free six-key object
`{tenantId,supplyDate,registeredStateComparison,supplierServiceLocation,
recipientSezStatus,supplierSezStatus}`. `tenantId` is one canonical UUID;
`supplyDate` is one canonical `YYYY-MM-DD` property-local applicability date; and
the remaining values are the complete exact recursively frozen approved Orders283,
284, 285 and 286 results. Null, arrays, non-plain prototypes, missing or surplus
keys, unfrozen evidence and malformed nested shapes fail closed.

The builder independently revalidates every fixed-order upstream field and
recomputes every Order283 candidate JSON/hash and Order284-286 evidence hash with
the supplied, unexposed tenant. Property, reservation, folio, complete jurisdiction,
place-of-supply `pos`, supplier registration and service-location, and recipient
Party/registration lineage must agree at every point where the four roots overlap.
Carried hashes are not trusted. No value is normalized, repaired, supplemented,
mutated or replaced by a
GSTIN, address, name, profile, configuration or recipient-state fallback.

Both exact SEZ-status `statusAsOf` dates must equal `supplyDate`. An earlier, latest
or nearest snapshot is never selected; a status date earlier or later than the
supply date, or malformed, impossible or stale evidence, fails closed. The boundary
neither reads a server clock
nor determines the statutory time of supply: it only requires exact equality to the
explicit date supplied to this evidence composition.

Precedence is exhaustive. If both affirmative statuses are regular/non-SEZ, the
Order283 relationship alone applies: `same_state_or_union_territory` yields
`intra_state` under `IGST_ACT_8_2`, while
`different_state_or_union_territory` yields `inter_state` under
`IGST_ACT_7_3`; the determination basis is
`ordinary_registered_state_comparison` and direction is `none`. Any SEZ-unit or
SEZ-developer status on the recipient makes the direction `to_sez`; any such
supplier status makes it `by_sez`; and a positive SEZ status on both sides makes it
`to_and_by_sez`. Each SEZ direction yields `inter_state` under the overriding
`IGST_ACT_7_5_B` with `sez_override` basis, regardless of the ordinary
same/different-state relationship. Only affirmative regular/regular evidence may
reach the ordinary section 7(3)/8(2) branch.

The recursively frozen fixed-order candidate body has exactly the keys
`propertyNode,reservationId,folioId,supplyDate,jurisdiction,supplier,recipient,
buyerAssociation,classification,placeOfSupply,registeredStateComparison,
supplyNature,determinationBasis,sezDirection,legalRule`. `supplier` is exactly
`{registrationId,evidenceHash,stateCode,serviceLocation,status}` where
`serviceLocation` is `{id,evidenceHash,kind,stateCode}` and `status` is
`{id,evidenceHash,statusAsOf,taxpayerType,sezStatus}`. `recipient` is exactly
`{partyId,registrationId,evidenceHash,status}` with the same exact status shape.
`buyerAssociation` is `{associationHash,payloadHash}`; `classification` is
`{classificationId,evidenceHash}`; `placeOfSupply` is
`{candidateHash,legalRule,pos}`; and `registeredStateComparison` is
`{candidateHash,comparisonRule,stateRelationship}`. Upstream approval details are
fully revalidated but minimized behind their status `evidenceHash`, which already
binds them; they are not duplicated into the candidate.

The result appends `candidateJson`, the exact fixed-order candidate-body JSON, and
`candidateHash`, the SHA-256 of fixed-order
`JSON.stringify({tenantId,candidate:body})`. Tenant identity is hash-bound but
unexposed. Identical inputs replay byte-identically; successful and rejected calls
leave every caller byte unchanged and perform no transaction, SQL, read, lock,
write, fact, event, journal, posting, tax-detail, document, submission or
idempotency effect.

This contract determines only the narrow intra-State/inter-State character of the
approved accommodation evidence. It grants no levy, exemption, reverse-charge,
CGST/SGST/UTGST/IGST decomposition, rate, amount, rounding, residual, `SupTyp`,
`IgstOnIntra`, `ItemList`, posting, correction, fiscal-document, provider,
submission, API, HTTP, UI, local-runtime or promotion authority. Form F2 renewal
continuity is a separate future supplier-status evidence problem. Specified-officer
endorsement for authorized operations and any resulting zero-rating/refund/payment-
mode decision are separate future evidence and decision boundaries; neither may be
inferred from SEZ status or this supply-nature result.

## 8. Pure rate-model evaluator

Order 067's in-process evaluator is a draft/simulation primitive, not a database or HTTP contract.
It accepts one strict model spec and one context derived from canonical UTC instants plus an IANA
property timezone. Money exists only as signed-range `bigint` minor units. Percentage adjustments
use integer basis points and exact half-up minor-unit rounding; floats and JavaScript-number money
are invalid.

Supported direct evaluators are simple fixed, calendar, BAR ladder, derived, room matrix,
occupancy/LOS and contract/negotiated. Expert composition applies explicit stages 1–8. Each stage
selects at most one rule by target binding, condition count and explicit priority; an equal top
tuple returns a conflict. Floors and ceilings guard the final exact amount. A closed calendar cell
means only that this model returns no price—it does not close inventory or override restrictions.

Occupancy-responsive pricing consumes a bounded basis-point metric with an evidence reference. It
never reads, creates or releases occupancy. Matrix and contract evaluation consume the frozen
Order 066 targeting result and never recalculate its physical/commercial precedence. Package/policy,
approval/publication and governed RMS/API binding are bound by the contracts below.

## 9. Pure rate quote composition

Order 068 composes one authenticated Order 067 result with hotel-selectable guest bounds, a
versioned package, explicitly selected promotions, refund treatment, policy references and channel
eligibility. It is an in-process draft/simulation primitive: no database read, publication,
reservation, distribution write, tax calculation, allowance posting or refund execution occurs.

Package and promotion money is exact signed-range `bigint` minor units in one currency. Package
elements support per-stay, per-night, per-person and per-person-night rhythms. Included allocation
is disclosed separately and cannot exceed the room amount; extra package value is added. Promotions
are discounts only, run in explicit stages 1–8 and require one unique highest-priority selected
promotion per stage. Equal winners produce a conflict; totals never become negative.

Availability, CTA/CTD, stay/advance restrictions, OOO/OOS blocks and mandatory policy evidence are
separate runtime-owned inputs and separate output fields. Zero capacity or any blocker makes the
result blocked regardless of hotel pricing configuration. Non-direct channels require attributable
mapping evidence. Order 068 checks that evidence is frozen, typed and internally consistent; the
tenant-scoped database origin of each reference remains the responsibility of Order 070's quote
binder. Tax is deliberately absent from the pre-tax result. Approval, publication and versioned
undo remain Order 069.

## 10. Atomic rate release publication

Order 069 makes one `rate_plan_release` extension version the complete unit of rate review and
activation. A draft binds exact immutable model and target draft versions plus the canonical
evaluator and composition ASTs. Minor-unit bigints are stored only as canonical
`{"$minor":"<signed-decimal>"}` tags and are decoded, normalized and re-encoded before use; storage
tampering fails closed.

Simulation accepts 1–500 uniquely keyed cells and derives targeting, property-local evaluation and
composition on the server. It returns sorted cell evidence, state counts, bounded work, a content
hash and a preview hash. Caller-computed target or price results are not accepted. Conflict-free
simulation may enter the existing four-eyes approval flow; publication re-simulates and requires the
latest unchanged draft plus an exact approved subject/version/content/preview binding.

Publication retires at most one prior active release, activates exactly one release, records facts
and emits the existing `extension.activated` event in the same transaction. Undo copies a historical
active/retired snapshot into a new draft and repeats simulation, approval and publication; history
is never mutated. RMS/API binding, HTTP routes, tax calculation and reservation quote binding remain
separate later contracts.

The release schema reserves a required nullable `rms_binding` so the immutable extension type does
not need a divergent schema after deployment. The strict object names only adapter key/version, a
recommendation-age ceiling and local-evaluator outage fallback. Order 070 permits a non-null value
only for the matching RMS/API model and evaluator with explicit floor and ceiling guards.

## 11. Universal stay quote and governed recommendation port

Order 070 binds one active immutable release to live tenant-scoped PostgreSQL evidence. The internal
quote query accepts only property, active plan, exact sellable, UTC stay instants, guest mix,
selected promotions, Order 066 commercial identity and channel. Tenant, transaction time, target
winner, availability, restrictions, occupancy signal, policy records, channel mappings, tax
assignments, reference prices and RMS evidence are server-derived and cannot be supplied by callers.

Every property-local night is evaluated once. Fixed/calendar, BAR/parent, matrix, occupancy/LOS,
contract and expert rules use the published target and evaluator versions. BAR and parent bases name
an exact published release id/version in the same property and currency; retired versions remain
readable for reproducibility, while drafts, cycles and chains deeper than 16 fail closed. The room
nights are summed with exact bigint arithmetic before package rhythms and selected promotions are
applied once to the complete stay.

`availability_projection` contributes an attributable occupancy signal only; canonical physical
availability, restriction and OOO/OOS evaluation still decides bookability. Quote evidence retains
the full projection row signal for every night. Policy ids, the exact pair of non-direct channel
mappings and a configured/partial/none tax-assignment result for every night stay visible. The
result remains pre-tax: an assignment is evidence of configuration, never an invented calculation.

RMS/API-managed releases name one exact registered adapter key/version, maximum evidence age and
local-evaluator outage fallback. A response must repeat the complete quote scope and provide exact
bigint money plus its observation and evidence identity. Missing, unavailable, thrown or stale
recommendations visibly fall back to the governed local evaluator. Malformed, future or mismatched
responses fail. Accepted recommendations replace only the base; hotel-authored rules, manual
`replace` rules, floor and ceiling still run afterward.

Hotels choose one catalogue model—simple fixed, calendar, BAR ladder, derived, room matrix,
occupancy/LOS, contract, package, RMS/API or bounded expert composition—and author it in Guided,
Expert or AI-assisted mode. Those modes are different editors over the same typed draft, preview,
four-eyes publication and immutable version history. Hotels can configure commercial targeting,
date/DOW/booking-window/LOS/occupancy rules, guest/package/promotion/policy/distribution choices and
explicit priorities. They cannot disable tenant isolation, authoritative availability/restrictions,
exact money, audit/publication history, tax/fiscal evidence boundaries or statutory safeguards.

## 12. Guided and Expert operator authoring

Order 071 exposes the universal five-step flow in the authenticated operator workbench: select an
existing rate-plan identity, choose one server-catalogued pricing model, define commercial
eligibility, define physical/time/policy composition, then review one canonical command. Guided and
Expert are presentation labels only. Both cross the same strict compiler, which accepts HTTP money
only as canonical decimal strings and converts it to exact `bigint` before the existing model,
target, evaluator and composition normalizers run.

One idempotent tenant transaction creates the model, target and release drafts together. The
browser cannot supply actor, tenant, property, audit envelope, calculated result, conflict or hash.
It can request an explicit hypothetical preview cell set; the server derives targeting, price,
composition, conflicts and hashes. Publication remains four-eyes and re-simulates the exact approved
cells. Undo creates a new draft version. A separate live-quote action resolves the active release
against current tenant-scoped availability, restriction, policy, tax-assignment and channel evidence.

Preview cells also cannot supply `policyEvidence`. The authenticated operator boundary derives the
stable cancellation, deposit, guarantee and no-show evidence from the exact selected immutable
release before simulation, approval request and publication. Current unsaved editor policy choices
affect only a newly saved release; they cannot change or prevent preview of an existing draft.
Caller-supplied empty, matching or mismatched policy evidence is invalid.

The authenticated rate-builder read response also attaches one `authoringCommand` to every immutable
release. The server reconstructs it only by joining the release's exact stored model id/version and
target id/version in the same tenant, property and rate plan, then re-runs the ordinary strict authoring
compiler. Missing, duplicate or mismatched references fail closed. Bigint values cross HTTP as canonical
decimal strings, and the command contains no actor, tenant/property authority, audit envelope, approval,
result or hash authority.

The workbench may display that command or deep-copy it into Expert mode as an unsaved starting point.
This is not an edit, undo, selection, approval or publication action. A changed copy becomes durable only
through the existing explicit Save immutable draft endpoint, after which preview, four-eyes approval and
publication run unchanged. “Use draft” still selects an existing draft for server preview; “Create undo
draft” still creates an exact new historical version from an active/retired release.

CTA/CTD, closed-to-sale and minimum/maximum stay or advance rules remain hotel-configurable through
the Restrictions workspace rather than being duplicated in a rate release. They are authoritative
inputs to the live quote and cannot be disabled by either authoring mode. AI-assisted authoring is
reserved for Order 072 and must compile through this same boundary; it is not a second mutation path.

## 13. Secure AI-assisted rate intent

Order 072 adds `POST /api/v1/properties/:property/rate-builder/:ratePlanId/intents:interpret` as a
read-scoped, proposal-only boundary. The request contains exactly an intent string and the current
typed authoring command. Server context supplies tenant, property and actor authority; the adapter
never receives tokens, approval state or database mutation capabilities. The response has one of
`ready`, `needs_clarification` or `rejected`, plus bounded plain-text changes, assumptions,
questions, warnings, rejections and guardrails. A ready response may include one command proposal
that has already passed the same canonical compiler as Guided and Expert authoring.

The included adapter is deterministic and makes no network call. It supports exact minor-unit
prices, supported model guidance, commercial codes, guest bounds, refund treatment and channel
distribution. Ambiguous money, complex model requirements and restriction-owned rules return
questions instead of guesses. Prompt overrides, secrets, executable instructions, compliance
bypasses and automatic apply/save/approve/publish requests are rejected before adapter invocation.

The browser renders every adapter string with text nodes. Interpreting never applies the proposal;
applying never saves it. An operator must separately Apply, Save draft, Preview, obtain independent
Approval and Publish. Any future external model implements the same untrusted proposal port and
inherits these server-owned validations and separate operator actions.

## 14. Applicability-rule authoring and preview evidence

Order 073 exposes the existing Order-066 rule array in Guided mode instead of reducing it to one
visual target. One immutable target draft contains 1–200 stable include/exclude rules. Each rule
names an explicit 0–1000 priority, one physical snapshot (property, class with exact room-type
membership, room type or sellable room), and any combination of the existing company, market group,
market, source party, source, channel, segment, agent and campaign dimensions. A class is local
release content, not a global mutable taxonomy.

The browser only compiles these choices into the strict authoring command. The server remains the
sole authority for specificity (`sellable > room type > class > property`), commercial-dimension
count, priority, equal-rank conflicts and include/exclude results. One operator-selected rule may
provide a hypothetical preview context; it does not select the winner. Non-direct preview contexts
fail before submission until governed channel-mapping evidence is available—the browser never
invents that evidence.

The existing 1–500-cell simulation response is rendered cell by cell with the server-returned
target state, winning/matched/conflicting keys, result state and exact pre-tax minor-unit subtotal.
Aggregate hashes and bounded work remain server-derived. Preview is not publication: save, preview,
independent approval and publish are separate actions, and undo still creates a new immutable
version. Restrictions, availability, tax and compliance evidence remain outside hotel-authored rate
rules and cannot be disabled from this workbench.

## 15. Two-operator rate-publication approval inbox

Order 077 exposes the existing `rate_plan_release` approval decision through two authenticated
property routes:

- `GET /api/v1/properties/{property}/rate-builder/{ratePlanId}/approvals?limit={1..100}&after={cursor}`
- `POST /api/v1/properties/{property}/rate-builder/{ratePlanId}/approvals/{approvalId}/decision`

Both require `rates.configuration:write` and an exact property grant. The list is newest-first,
bounded and cursor-paginated. It returns only the approval id, exact release id/version and state,
requester/decider display identities, timestamps, and server-derived `canDecide` / `canPublish`
flags. Tenant ids, payload hashes and audit envelopes never cross this browser contract.

The decision body is exactly `{ "decision": "approved" | "rejected" }` and uses the durable
idempotency boundary. A pending request may be decided once, only by a different active operator.
The existing `ApprovalService.decide` transition, `approval.decided` event and fact-log audit remain
the only write path; Order 077 adds no approval state or event. Self-decision, terminal re-decision,
wrong-plan, wrong-property and foreign-tenant lookup fail closed.

An approval decision is not publication. Only the operator who recorded an approval receives
`canPublish`, and only while its exact release is still the latest draft. The workbench additionally
requires that operator to run a fresh server preview in the current in-memory session. Publication
then revalidates the existing hashes, cells, release state and deciding actor atomically. Rejection
is terminal and can never publish.

## 16. Token-only payment operation boundary

`PaymentService` owns authorization, incremental authorization, one capture, void,
partial refunds and late reconciliation. Callers provide tenant-scoped resource ids,
canonical positive int64 minor units, an idempotency key and the audit envelope; the
service derives property, guest folio/account, provider, method, currency, governed
payment code and clearing account. Only an active opaque card-network or UPI token is
passed to the `PaymentProvider` port. Tokens never appear in command results, facts,
events, errors or receipts.

Each command commits a prepared attempt, calls the provider outside PostgreSQL, then
atomically appends its result, fact and outbox evidence. Authorization, increment and
void are journal-free. One successful capture is capped by both authorization and the
locked positive folio balance; capture closes unused authority. Refunds are bounded by
the captured remainder and carry explicit capture-payment and capture-journal lineage.
Provider receipts store normalized fields and a content hash only; same receipt/hash
replays, changed content conflicts, and receipt plus late result commit together.

## 17. Hosted deposit-payment boundary

`HostedDepositService.create` binds a deposit-purpose payment operation to one tenant,
property, folio window, tokenized instrument, positive amount/currency, creator and
24-hour expiry. Durable actor-bound idempotency returns the original request metadata
without reissuing its bearer. Regeneration revokes the prior active generation. Only a
SHA-256 bearer hash is stored; the 256-bit raw bearer is returned once and is excluded
from provider handoffs, receipts, facts, events, caches and browser storage.

The separately originated synthetic provider receives only a signed, short-lived
correlation, amount, currency, return URL and expiry. `POST /provider/callback` verifies
the bounded exact raw bytes, version, path, timestamp, event id and HMAC before parsing,
then delegates exclusively to the payment receipt/reconciliation contract. Browser
return values are never payment truth.

Deposit capture debits clearing and credits deposit liability without touching the
folio. `HostedDepositService.apply` separately locks the capture, applications, folio,
accounts and business day; it caps the immutable liability-debit/guest-folio-credit
journal by both unapplied capture and positive folio balance. Staff read, create and
apply routes require distinct `financials.payments:read`,
`financials.payments:write` and `financials.deposits:apply` scopes plus the exact
property grants. This contract does not refund deposits, settle or close a folio.

## 18. Governed cashier-custody boundary

`CashierService` is the only application boundary for opening, recounting and closing
a property cash drawer. Callers submit only a governed drawer id and non-negative
quantities for the drawer's configured bigint denomination units. PostgreSQL derives
the property, open business date, currency, actor custody and every exact int64 total;
caller totals, dates, currencies, accounts and users are rejected authority.

At most one session may be open for a drawer and for a tenant user. Counts and count
lines are immutable. Ordinary close remains blind until a count has been submitted:
expected cash is the opening count plus typed cash effects (opening only while Yellow
has no cash-posting command). Zero closes directly. A non-zero over/short requires a
reason and one exact approved, different-user, one-use `cashier_over_short` request
bound to the session, count and server-derived totals. Supervisor abandoned close
also requires a distinct closer, fresh closer-owned count and reason.

Open, count and close append minimized facts and `cashier.opened`,
`cashier.counted`, `cashier.closed` outbox events in the same transaction. This
contract never posts cash, balances a discrepancy, mutates a journal, settles a
provider or seals a business day.

## 19. Governed direct-billing receivable boundary

`ReceivableService` previews and transfers only the exact locked positive balance of
one open guest folio window. The target is one open party-owned `company` account in
the same tenant, property and currency whose Party has the `company` or `agent` role.
The service derives amount, currency, account status, party role, current exposure,
credit limit and projected exposure; callers provide identifiers, idempotency and an
audit envelope only.

`credit_limit_minor = NULL` denies direct billing. A within-limit transfer creates one
balanced immutable transfer journal. An over-limit transfer additionally consumes one
approved, different-user, one-use request bound to exact party/account/folio/amount,
exposure before, limit and projected exposure. Every command revalidates those facts
under deterministic financial locks before posting.

The result leaves the guest folio at exact zero and increases receivable exposure by
the same amount. It does not settle the folio automatically and creates no AR invoice,
allocation, aging, statement, provider settlement, checkout, document, tax or fiscal
artifact. Generic `ar_control` is never a direct-billing target.

## 20. Governed housekeeping task lifecycle

Order 201 exposes a bounded property housekeeping board over existing
`kind='housekeeping'`, `subject_type='space'` tasks and active physical rooms. Read
requires `housekeeping.tasks:read`; start and complete require
`housekeeping.tasks:work`; verification requires the distinct
`housekeeping.tasks:inspect` grant. The server derives tenant, property, actor,
current status, room condition and the one allowed action. No Party PII is returned.

The only executable transitions are `assigned -> in_progress`,
`in_progress -> done` and `done -> verified`. Every command binds the exact task
status, room condition and room-condition `updated_at` returned by the board. A stale
or foreign target conflicts without mutation. Start preserves room condition;
complete accepts only dirty/pickup and atomically makes it clean; verify accepts only
clean and atomically makes it inspected. Task/condition changes, minimized facts and
outbox events commit together under actor-bound durable idempotency.

This boundary does not create, assign, cancel, reopen or delete tasks. It creates no
task sheet, cadence, credits, occupancy, reservation, discrepancy, queue, key,
financial, business-day or statutory effect. Direct runtime DML over `task` and
`unit_condition` remains denied; the application may use only the bounded governed
transition capability.

## 21. Governed housekeeping task-sheet generation v1

Order 202 adds bounded preview, current-sheet read and one deliberate generation
command. `housekeeping.sheets:read` permits property-scoped preview/list reads;
`housekeeping.sheets:generate` permits generation. The server derives tenant,
property, actor, active physical rooms, current reservation segment and sanctioned
occupancy truth, effective vertical-profile cadence and exact task identities. Browser
input is only a property-local `sheetDate`, one selected active staff Party id and an
idempotency key.

The v1 cadence contract is deliberately narrow. `daily` includes a distinct active
physical room only when an authoritative in-house segment occupies the property-local
date. `on_departure` additionally requires the occupied segment's exclusive upper
instant to fall on that date. Tenant configuration overrides the global profile on the
same key; missing, ambiguous, mixed, `weekly` or `custom` cadence fails the whole
request without artifacts. No weekday, anchor or custom language is inferred.

One successful command creates one deterministic `task_sheet` for the exact
tenant/property/date/attendant and one assigned `kind='housekeeping'`,
`subject_type='space'` task per distinct eligible room. Tasks carry only server-owned
sheet/date/cadence provenance and `department='Housekeeping'`; credits are absent.
Same-key replay returns the same result, changed reuse conflicts, and concurrent
contenders converge without silently reassigning an existing sheet. Task creation,
matching facts and `task.created` outbox events commit atomically.

Generation does not transition tasks or room condition and does not create, update or
delete reservations, segments, occupancy, folios, journals, business days, keys,
statutory or fiscal records. Direct runtime DML over `task_sheet` and `task` remains
denied; only the owner-mediated bounded capability may generate them.

## 22. Governed departure-readiness read boundary

`CheckoutReadinessService.read` accepts only lowercase tenant, property and
reservation UUIDs. It executes one tenant transaction and one PostgreSQL snapshot
query, returning the stored reservation state, exactly one current `in_house`
segment when present, its one active physical room, the exact exclusive
`slot_kind='segment'` occupancy whose slot reference, space and period match that
segment, and every reservation folio window ordered by `window_no,id`.

Window balances are canonical bigint decimal strings from
`COALESCE(folio_balance.balance_minor,0)`. Readiness requires reservation state
`in_house` or `due_out`, one segment/room/occupancy chain, at least one window, and
every window `settled` or `closed` at exact zero. Open-zero is intentionally blocked;
only the existing settlement command may transition it. Blockers are emitted once in
the fixed Order-203 order, and `ready=true` means only that no blocker was present in
this advisory snapshot.

The result is deeply frozen and contains no Party, contact, identity-document or note
data. Malformed input fails validation; foreign or mismatched tenant/property/target
authority is concealed as not found. The read performs no checkout, transition,
occupancy release, account/folio/ledger change, fact, event or idempotency write. A
future checkout command must lock and revalidate every predicate.

## 23. Governed checkout command boundary

`CheckoutService.checkout` accepts only tenant, property and reservation UUIDs, an
8–200 visible-ASCII idempotency key, and an exact server-built
`reservation.checked_out` audit envelope. Room, segment, folio, balances, readiness
and time are never caller authority. Its one tenant transaction verifies the active
actor; locks the reservation and all segments; locks the single canonical guest
account and every reservation folio through `lock_financial_rows` in deterministic
order; and re-evaluates the exact Order-203 blockers from PostgreSQL truth.

Only `in_house` or `due_out` reservations with exactly one current `in_house`
segment may proceed. `ReservationOccupancyService.releaseForSegment` is the only
occupancy mutation. The segment becomes `departed`, its upper bound becomes the
server transaction timestamp only when that timestamp is earlier than the recorded
upper bound, and the reservation becomes `checked_out`. Checkout before the segment
lower bound fails closed. The command never lengthens a stay.

Release, both guarded transitions, idempotency, the minimized
`reservation.checked_out` fact and matching outbox event commit or roll back as one
effect. Exact replay returns the prior frozen result; changed reuse conflicts.
Checkout does not settle or close folios/accounts, post or reverse money, mutate a
business day, mark a room dirty, or create housekeeping work. Those remain separate
governed commands.

## 24. Governed vehicle-register read boundary

`VehicleRegisterService.list` accepts one lowercase tenant UUID, one lowercase
property UUID, and only optional `registration`, `cursor` and `limit` read controls.
`registration` is compared as literal, case-sensitive text: it is never trimmed,
normalized or interpreted as a wildcard. Limit is 1–100. The opaque canonical cursor
represents the last `(reg_no,id)` pair and the query uses matching PostgreSQL keyset
ordering; OFFSET is not admitted.

One tenant transaction returns only vehicle id, registration, nullable make, model,
colour, driver name, reservation id, Party id and the literally recorded entry/exit
timestamps. Notes and parking-space truth are excluded. A linked reservation must be
same-tenant and exact-property; a linked Party must be same-tenant. Any association
that cannot be re-proven fails the whole response closed without exposing the foreign
identifier.

The result is deeply frozen and deterministic for unchanged PostgreSQL truth. The
read does not infer onsite state, parking assignment, occupancy, access/security
decisions or lifecycle. It performs no vehicle, reservation, Party, parking,
occupancy, task, fact, outbox or idempotency write.

## 25. Governed room-condition visibility boundary

`HousekeepingTaskService.listConditions` accepts one lowercase tenant UUID, one
lowercase property UUID, and only optional `condition`, `cursor` and `limit` read
controls. `condition` is one exact `clean`, `dirty`, `pickup` or `inspected` literal;
limit defaults to 50 and is capped at 100. The opaque canonical cursor is bound to
that exact filter and represents the last `(space.code COLLATE "C",space.id)` pair,
so changing or omitting the filter cannot reuse its authority.

One tenant transaction reads only active physical rooms in the exact property joined
to their canonical `unit_condition` row. The deeply frozen response is exactly
`{rooms:[{spaceId,code,floor,condition,updatedAt}],nextCursor}`. UUIDs, condition
literals and canonical timestamps are validated before disclosure; malformed stored
truth fails the whole read closed. Updater identity, tasks and assignees, occupancy,
reservations and guests, OOO/OOS state, readiness, sources, reasons and inferred room
status are excluded.

`GET /api/v1/properties/{property}/housekeeping/conditions` requires the existing
`housekeeping.tasks:read` scope and exact property grant, rejects duplicate or extra
query keys, and is `Cache-Control: no-store`. There is no companion write route. The
read cannot mutate condition, task, space, occupancy, reservation, fact, outbox or
idempotency truth.

## 26. Reservation-scoped arrival pickup-task detail

`ReservationDetailService.pickupTaskDetail` accepts one lowercase tenant UUID, exact
property UUID, reservation UUID and task UUID. In one tenant-bound transaction it
proves the property reservation, its current arrival travel row and that row's exact
pickup-task link. The linked row must also be a same-tenant, exact-property
`guest_request` task whose subject is that reservation, department is `transport`,
priority is `3`, due instant equals the arrival schedule, and payload is exactly
`{"requestType":"arrival_pickup"}`. A missing, foreign, stale or unlinked identity is
not found; a currently linked row with any other stored shape conflicts without a
partial result.

The deeply frozen result is exactly `taskId`, `reservationId`, `confirmationNo`, one
canonical task status, `dueAt`, `priority`, `createdAt` and nullable `completedAt`.
Payload, assignee, Party/contact data, notes, vehicle/driver/dispatch data, tenant and
property identifiers are not returned. The read performs no task, travel,
reservation, fact, outbox or idempotency write.

`GET /api/v1/properties/{property}/reservations/{reservation}/arrival-pickup-task/{task}`
requires the existing `reservations.lifecycle:read` scope and exact property grant,
accepts no query and is `Cache-Control: no-store`. It is a reservation-scoped detail
read, not generic task-list or task-lifecycle authority.

## 27. Governed vehicle-register exact-detail boundary

`VehicleRegisterService.get` accepts only one lowercase tenant UUID, property UUID
and vehicle UUID. In one transaction-local tenant-bound read it proves the exact
property and vehicle, then re-proves a nullable linked reservation against the same
tenant and exact property and a nullable linked Party against the same tenant. Missing,
foreign-tenant and wrong-property identities are indistinguishable not-found results;
a selected row whose stored association or canonical field shape is inconsistent fails
the complete read as a conflict without disclosing a foreign identifier.

The deeply frozen result is exactly the existing Order-205 row: `vehicleId`, literal
`registration`, nullable `make`, `model`, `colour`, `driverName`, `reservationId`,
`partyId`, `enteredAt` and `exitedAt`. Notes, parking-space truth, tenant/property
identity, Party/reservation content, contacts, occupancy, inferred onsite/security
meaning and action flags are excluded. Repeated unchanged reads are byte-equivalent
and perform no vehicle, reservation, Party, parking, occupancy, task, fact, outbox or
idempotency write.

`GET /api/v1/properties/{property}/vehicles/{vehicle}` requires the existing
`stay-operations.vehicles:read` scope and exact property grant, accepts no query and
is `Cache-Control: no-store`. It adds no vehicle create/edit, entry/exit, parking,
occupancy or generic lifecycle authority.

## 28. Governed housekeeping-task exact-detail boundary

`HousekeepingTaskService.get` accepts only one lowercase tenant UUID, property UUID
and task UUID. One transaction-local tenant read admits only the existing board's
`kind='housekeeping'`, `subject_type='space'`, `assigned|in_progress|done` task joined
to one active physical room in the exact property and that room's canonical
`unit_condition` row. Missing, foreign, wrong-property/kind/subject/status,
inactive-room and missing-condition identities are indistinguishable not-found
results. Malformed selected values fail the complete read as a conflict without
partial disclosure.

The deeply frozen service result is exactly `taskId`, `taskStatus`, `spaceId`,
`spaceCode`, nullable `floor`, `roomCondition`, `roomUpdatedAt`, Boolean `assigned`,
nullable `dueAt`, integer `priority` and nullable `completedAt`. Payload, notes,
credits, sheet/assignee/Party/contact/updater identity, reservation, guest, occupancy,
discrepancy, readiness, workload, SLA, urgency and room-availability inference are
excluded. Repeated unchanged reads are byte-equivalent and perform no task, room,
condition, occupancy, fact, outbox or idempotency write.

`GET /api/v1/properties/{property}/housekeeping/tasks/{task}` requires the existing
`housekeeping.tasks:read` scope and exact property grant, accepts no query and is
`Cache-Control: no-store`. It is an exact read-only detail, not generic task authority;
existing board transitions remain separate and unchanged.

## 29. Governed initial room-condition ingress

`HousekeepingTaskService.getInitialConditionCandidate` admits only one active
physical room in the exact tenant and property when no `unit_condition` row exists.
Its deeply frozen read result is exactly `{spaceId,code,floor,roomCondition:null}`;
existing conditions, foreign or inactive rooms and malformed stored truth fail
closed without partial disclosure. The read performs no condition, task, fact,
outbox or idempotency write.

`GET /api/v1/properties/{property}/housekeeping/conditions/{space}/candidate`
requires `housekeeping.tasks:read` and its exact property grant, accepts no query and
is `Cache-Control: no-store`. Its minimized candidate adds
`allowedInitialConditions:["clean","dirty","pickup"]` only when the caller also
holds `housekeeping.conditions:initialize` for that exact property; otherwise that
array is empty. The candidate never infers a condition.

`POST /api/v1/properties/{property}/housekeeping/conditions/{space}/initialize`
requires the exact initialize scope and property grant, no query, a valid
`Idempotency-Key`, and only
`{expectedRoomCondition:null,roomCondition:"clean"|"dirty"|"pickup"}`. `inspected`
is deliberately excluded. The owner-mediated capability inserts only while the row
is absent; an existing row conflicts and is never changed. The atomic domain command
records the canonical `unit.condition_changed` fact and outbox event, and exact
replays return the same canonical receipt with `Idempotency-Replayed: true`.
Responses are `Cache-Control: no-store`, expose only
`{replayed,roomCondition,spaceId,updatedAt}`, and carry the request correlation ID.
There are no PUT, PATCH or DELETE variants and direct runtime DML on
`unit_condition` remains denied.

## 30. Governed arrival pickup-task dispatch

`ArrivalPickupTaskDispatchService.transition` accepts one exact tenant, property,
reservation and currently linked task identity, an actor-bound command envelope and
idempotency key, one literal `assign|start|complete`, expected task status and expected
nullable assignee Party identity. Assign alone accepts a staff Party id. The server
re-proves the current arrival link and complete Order213 task shape before the
owner-mediated capability may apply exactly `open -> assigned`,
`assigned -> in_progress` or `in_progress -> done`. Assignment requires an active
same-tenant Party with role `staff`; completion alone records `completed_at`.

The compare-and-set transition, one minimized `task.status_changed` fact and matching
outbox event commit in the same tenant transaction. Exact replay returns the original
receipt without another effect; changed key reuse, stale expected evidence,
non-adjacent state, reassignment, hostile task shape and foreign identity fail closed.
The deeply frozen receipt is limited to `taskId`, `reservationId`, `taskStatus`,
nullable `assigneePartyId`, nullable `completedAt`, nullable `eligibleAction` and
`replayed`.

`POST /api/v1/properties/{property}/reservations/{reservation}/arrival-pickup-task/{task}/{action}`
accepts no query, requires a valid `Idempotency-Key`, exact property grant and
`stay-operations.pickup-tasks:dispatch` for assign or
`stay-operations.pickup-tasks:work` for start/complete. Bodies contain only the
expected task/assignee evidence and, for assign, `staffPartyId`. Responses are
`Cache-Control: no-store`, carry correlation and replay headers and expose only the
minimized receipt. No generic task route, reassignment, cancellation, travel edit or
transport-detail authority is introduced.

## 31. Governed arrival room-cleaning task creation

`ArrivalRoomCleaningTaskService.candidate` accepts one exact lowercase tenant,
property and reservation UUID. Its transaction-local read returns a candidate only
for one `due_in` reservation with exactly one current booked segment, one mapped active
physical room in the exact property and a canonical `dirty|pickup` condition. More
than one actionable `assigned|in_progress` housekeeping/space task for that room is
incoherent and conceals the complete candidate. The deeply frozen candidate is
exactly `reservationId`, `spaceId`, `spaceCode`, `roomCondition`, `dueAt` and nullable
`existingTaskId`; it performs no write and makes no readiness, occupancy or cleaning
completion inference.

`GET /api/v1/properties/{property}/reservations/{reservation}/arrival-room-cleaning-task/candidate`
accepts no query and requires `housekeeping.arrival-tasks:read` plus its exact property
grant. Its no-store response is exactly `{candidate,canCreate}`. `canCreate` is true
only when no actionable task exists and the caller also holds
`housekeeping.arrival-tasks:create` for that property. Missing scope is forbidden;
foreign, ungranted or incoherent identities share the concealed not-found boundary.

`ArrivalRoomCleaningTaskService.create` accepts the same bounded identity, one active
same-tenant staff Party as `attendantPartyId`, an actor-bound audit envelope and an
idempotency key. The owner-mediated capability locks and re-proves the active actor,
due-in reservation, unique current booked segment, unique active mapped room,
`dirty|pickup` condition, selected staff Party and exact-room actionable-task count.
It returns the one existing assigned/in-progress task without mutation, or inserts at
most one task with `kind='housekeeping'`, `subject_type='space'`,
`status='assigned'`, `department='Housekeeping'`, priority 1 and due time equal to the
segment's recorded lower-bound arrival instant. Its stored payload is limited to
`source='arrival_room_cleaning'`, canonical reservation id and room condition.

`POST /api/v1/properties/{property}/reservations/{reservation}/arrival-room-cleaning-task`
accepts no query, requires `housekeeping.arrival-tasks:create` plus its exact property
grant, a valid `Idempotency-Key`, and only `{attendantPartyId}`. A new task returns 201;
an existing actionable task returns 200. The minimized receipt contains only
`taskId`, `reservationId`, `spaceId`, `roomCondition`, `attendantPartyId`, `dueAt`,
`created` and `replayed`, with replay and correlation headers. Exact replay is stable,
changed-key reuse conflicts and room-scoped contenders converge. Only creation writes
one `task.created` fact/outbox pair in the same transaction; returning an existing task
emits nothing. No generic task CRUD, condition or reservation mutation, check-in,
occupancy, folio, financial, day, key, travel, vehicle, parking or statutory authority
is introduced.

## 32. Governed due-in room assignment

`ReservationSegmentService.findDueInRoomAssignmentCandidates` accepts one exact
lowercase tenant, property and reservation UUID. In one transaction-local tenant
read it admits only an exact-property `due_in` reservation with exactly one latest
`booked` segment, a null sellable-unit assignment and zero occupancy rows whose
`slot_ref` is that segment. It derives availability for the segment's recorded
period, occupants and unit type through the existing PostgreSQL-authoritative
inventory path. Only active same-property sellable units of that exact type which
map exclusively to one active physical room are candidates.

`GET /api/v1/properties/{property}/reservations/{reservation}/due-in-room-assignment/candidates`
accepts no query, requires existing `reservations.segments:read` authority and its
exact property grant, and is `Cache-Control: no-store`. The minimized HTTP response is
exactly `{candidates:[...]}`. Each candidate is exactly `sellableUnitId`,
`sellableUnitName`, `spaceId`, `spaceCode`, nullable `floor` and nullable
`roomCondition`. Current condition is evidence only: null, dirty, pickup, clean or
inspected never changes availability authority and never implies check-in readiness.
Status, segment, unit-type and period expectations come only from the already-current
canonical reservation detail/readiness descriptor and are not duplicated in this
response. Price, guest/contact, holds, occupancy rows, internal mapping, task and other
reservation truth are absent.

`ReservationSegmentService.assignDueInRoom` accepts only one actor-bound audit
envelope, idempotency key and
`{segmentId,expectedReservationStatus,expectedSegmentStatus,expectedUnitTypeId,expectedSellableUnitId:null,expectedPeriod:{from,to},sellableUnitId}`.
The command locks reservation and segment, re-proves the complete candidate contract,
claims the exact period only through
`ReservationOccupancyService.claimForSegment`, then calls the bounded
`public.assign_due_in_room` owner capability to set the still-null assignment.
Assignment, the sanctioned occupancy chain, minimized `reservation.modified` and
`occupancy.recorded` fact/outbox evidence and the idempotency receipt commit or roll
back together. Exact replay is byte-equivalent; changed-key reuse, stale evidence,
prior assignment/occupancy and contention fail closed.

`POST /api/v1/properties/{property}/reservations/{reservation}/due-in-room-assignment`
accepts no query, requires existing `reservations.segments:write` authority and its
exact property grant, a valid `Idempotency-Key`, and only the command body above.
The no-store minimized receipt exposes the selected reservation, segment, sellable
unit, physical room, period, claim count and replay state with correlation/replay
headers. Success does not mutate condition, task, folio, identity or reservation
status and does not run check-in. The client must refetch canonical reservation detail
and check-in readiness; it cannot infer the next blocker from candidate or command
output. There is no generic assignment, room-move, bulk or automatic-allocation route.

## 33. Governed property-local due-in roll

`ReservationArrivalRollService.rollDueArrivals` accepts only one lowercase tenant UUID,
property UUID, bounded arrival limit and system audit envelope bound to
`reservation.due_in`. One transaction-local tenant transaction derives
`(transaction_timestamp() AT TIME ZONE property.timezone)::date`, locks at most the
requested number of exact-property `reserved` parents with their latest current
`booked` segment, and revalidates the same shape before writing. It changes only the
parent to `due_in`; the segment remains byte-equivalent `booked`.

Each changed parent uses the deterministic property/date/reservation idempotency key
and commits its status, one minimized `reservation.due_in` fact/outbox pair and stored
result together. Exact reruns and concurrent workers add no second effect. A failed
fact or event publication rolls back status, evidence and idempotency before retry.
Future or past arrival dates, foreign properties, absent/incoherent latest segments and
non-`reserved` parents are no-ops; no delayed catch-up or lifecycle repair is inferred.

`runtime_due_arrival_scopes(limit)` is a bounded, read-only, fixed-search-path owner
capability callable only by `yellow_runtime`. It returns distinct tenant/property IDs
whose coherent latest booked arrival equals that same transaction-stable property-local
date; it exposes no reservation/segment details and grants no direct table read or
transition authority. The worker bounds both scope and arrival batches, supports one
deterministic drain cycle and abortable polling, and is disabled unless explicitly
enabled in the existing workbench composition. This is an internal server contract:
there is no API route, operator control, automatic check-in, business-day read/write or
other reservation-state command.

## 34. Governed property-local due-out roll

`ReservationDepartureRollService.rollDueDepartures` accepts only one lowercase tenant
UUID, property UUID, bounded departure limit and system audit envelope bound to
`reservation.due_out`. One tenant transaction derives the transaction-stable stored-
property local calendar date, locks at most the requested exact-property `in_house`
parents with their latest current `in_house` segments, and revalidates before changing
only each parent to `due_out`. The segment remains byte-equivalent `in_house`.

Each changed parent uses a deterministic property/date/reservation idempotency key and
commits its status, one minimized existing fact/outbox pair and stored result together.
Reruns and contenders add no second effect; publication failure rolls everything back.
Future, missed-past, foreign, absent/incoherent or non-`in_house` truth is a no-op.

`runtime_due_departure_scopes(limit)` is the bounded runtime-only discovery capability.
The worker bounds scope and departure batches, supports one drain cycle and abortable
polling, and is disabled unless explicitly enabled in workbench composition. There is
no API route, automatic checkout, segment/occupancy mutation, business-day operation,
financial effect or other lifecycle command.

## 35. Governed room discrepancy reporting

`HousekeepingDiscrepancyService.listOpen` accepts one lowercase tenant UUID and one
exact granted property UUID. In one transaction-local tenant read it returns only
unresolved discrepancies for active physical rooms in that property, ordered by
room code and immutable discrepancy identity. Each deeply frozen row is exactly the
room id, room code, nullable floor, derived `sleep|skip|person` kind, canonical
reported/system tokens, reporter id and server report instant. Reservation, segment,
occupancy, guest and contact identities are excluded.

`HousekeepingDiscrepancyService.report` accepts only one exact room id, explicit
observed presence `occupied|vacant`, observed persons `1..99` when occupied, an
actor-bound audit envelope and an `Idempotency-Key`. Tenant, property, actor, system
presence, expected persons, classification, timestamps and evidence are server-owned.
The owner-mediated PostgreSQL capability accepts only an active exact-property
physical room with one active exclusive mapping and coherent current stay/occupancy
truth. Dorm, positional, shared, composite, inactive, foreign, non-room, ambiguous or
multiply occupied shapes fail closed.

System presence is occupied only for one latest current `in_house` segment whose
parent is `in_house|due_out` and whose exact room has one current exclusive occupancy
claim for that segment. The canonical differences are sleep (observed occupied,
system vacant), skip (observed vacant, system occupied) and person (both occupied but
persons differ). Matching truth is a successful no-op. A changed result inserts one
unresolved `discrepancy`, one minimized `discrepancy.reported` fact and one matching
outbox event atomically. Exact replay returns the same effect; different evidence for
an already-open room conflicts. V1 does not resolve, update, delete, carry, queue,
message or automatically infer a report.

`GET|POST /api/v1/properties/{property}/housekeeping/discrepancies` accept no query
parameters and are `Cache-Control: no-store`. GET requires
`housekeeping.discrepancies:read`; POST additionally requires
`housekeeping.discrepancies:report`, an exact `Idempotency-Key`, and only
`{spaceId,observedPresence,observedPersons}`. Direct runtime discrepancy DML remains
denied. Reporting does not mutate room condition, task, sheet, reservation, segment,
occupancy, folio, financial, business-day or statutory truth.

## 36. Governed vehicle parking assignment

`VehicleParkingAssignmentService.read` returns the one exact onsite reservation-linked
vehicle, its current in-house segment, any current parking assignment, and otherwise
only active exact-property capacity-one `profile_key='parking'` candidates. It derives
all stay, period and occupancy truth in a transaction-local tenant read; the caller
cannot supply or infer them.

`VehicleParkingAssignmentService.assign` accepts one selected parking-space UUID,
actor-bound audit envelope and `Idempotency-Key`. PostgreSQL locks the vehicle, linked
stay, current segment, parking space and claim truth, derives
`[transaction_timestamp(), upper(segment.period))`, records one exclusive
`slot_kind='segment'` claim through `record_occupancy()`, then binds
`vehicle.parking_space` atomically. The surrounding tenant transaction commits the
binding, one minimized existing `occupancy.recorded` fact/outbox pair and receipt or
rolls all of them back. Exact same-target replay is stable; changed or stale truth
conflicts.

The established six-argument room/unit recorder remains unchanged. Parking uses an
owner-private vehicle-validating overload; direct `app_role`, runtime and PUBLIC
execution are denied. Canonical segment checkout remains the only release path and
clears every validated parking claim plus the matching vehicle pointer before
delegating room/unit release in the same transaction.

`GET|POST /api/v1/properties/{property}/vehicles/{vehicle}/parking` accept no query
parameters and are `Cache-Control: no-store`. GET uses the existing vehicle read
authority; POST requires `stay-operations.vehicles:park`, an exact idempotency header
and only `{parkingSpaceId}`. V1 is create-only: replacement, manual release, entry/exit,
 staff/visitor parking, history and automatic allocation are not commands.

## 37. Governed India GST accommodation payment-receipt-date evidence

`IndiaGstAccommodationPaymentReceiptDateService.resolve(tx,input)` accepts exactly
`tenantId`, `propertyNode`, `reservationId`, `serviceProvisionSnapshotId`,
`paymentReceiptSnapshotId` and `paymentReceiptDate`. The input is an exact plain,
accessor/proxy/symbol-free six-key object. Resolution reconstructs the approved
Order290 service-provision root, Order252 reservation/first-segment lineage and
Order240 canonical positive room-revenue attribution, then equality-selects one
explicit payment-receipt root id/date. Missing, duplicate, malformed, stale-hash,
mixed-lineage or non-full-coverage evidence fails closed.

The sole tenant-leading, forced-RLS, SELECT-only root is
`india_gst_accommodation_payment_receipt_snapshot` with exactly twelve columns:
`tenant_id`, `id`, `service_provision_snapshot_id`, `currency`, `amount_minor`,
`coverage_scope`, `supplier_books_entry_date`, `supplier_bank_credit_date`,
`payment_receipt_date`, `payment_receipt_source`,
`payment_receipt_evidence_sha256`, `legal_rule`. Its exact service-root FK prevents
parallel property/reservation truth. `amount_minor` is positive and equals the
reparsed full Order240 attribution grand total; currency agrees across the complete
lineage; `coverage_scope` is exactly `full_attribution`.

Both statutory source dates are retained and finite, with
`payment_receipt_date = LEAST(supplier_books_entry_date,
supplier_bank_credit_date)`, including equal dates. The exact source is
`governed_supplier_payment_receipt_record`; the legal literal is
`CGST_ACT_13_2_EXPLANATION_II_PAYMENT_RECEIPT_DATE_INPUT_ONLY`; the evidence digest
is lowercase SHA-256. The frozen result returns both source dates, the earlier date,
full amount/currency, source, digest, legal rule, minimized complete lineage and a
tenant-bound evidence hash without exposing tenant identity.

There is no writer, ingestion, bank/provider lookup, attestation, allocation, refund
or reversal authority. `PUBLIC`, `yellow_runtime` and `app_role` cannot INSERT,
UPDATE, DELETE or TRUNCATE. Payment-operation, provider-receipt, journal, posting,
folio, reservation, operational and clock dates are forbidden substitutes; no latest,
nearest, fallback or one-source-only path exists. This is input evidence only and
cannot decide section 13 time of supply or issue/allocate payment, invoice, receipt
voucher, tax, item, posting, journal, document, submission, API, UI or local state.
# Quoted-tax reservation lineage

A quoted-tax attribution bound to a cart hold becomes reservation evidence only when
the existing held-reservation command consumes that exact hold and appends the exact
reservation/first-segment link in the same transaction. The link is immutable audit
lineage, not folio, account, route, posting, document or statutory authority.

Migration0041 remains exact historical evidence at checksum `96795066…f171`.
Migration0042 is the forward-only compatibility correction: when no quoted-tax hold
binding exists, the capability returns zero rows before product authority checks;
when a binding exists, all tenant/property/actor and exact lineage checks remain
mandatory. Neither migration authorizes a ledger checksum rewrite.

## Exact date-specific India GST supplier-registration-status evidence (Order 289)

`IndiaGstSupplierRegistrationStatusService.resolve(tx,input)` accepts exactly
`tenantId`, `propertyNode`, `reservationId`, `supplierServiceLocationId`,
`supplierGstRegistrationStatusId` and `statusAsOf`. The hardened plain input is
resolved through complete approved Order284/272 service-location and supplier-
registration truth. One explicit snapshot row must equality-match tenant,
registration id, registration evidence hash and date; no latest, nearest, clock or
network lookup exists.

The immutable result exposes the selected root id, property, minimized supplier
service-location/registration lineage, evidence date, exact active GST Portal status,
regular/SEZ-unit/SEZ-developer taxpayer type, source, evidence hash, legal rule and a
deterministic tenant-bound SHA-256. It is recursively frozen and fixed-order; the
tenant remains unexposed. The date is evidence time only. It does not establish
statutory time of supply or authorize renewed SEZ status, supply nature, zero rating,
levy, invoice or submission.

## Exact externally evidenced accommodation service-provision date (Order 290)

`IndiaGstAccommodationServiceProvisionDateService.resolve(tx,input)` accepts exactly
`tenantId`, `propertyNode`, `reservationId`, `serviceProvisionSnapshotId` and
`serviceProvisionDate`. The accessor-, proxy- and symbol-free plain input reaches one
explicit 15-column
`india_gst_accommodation_service_provision_snapshot(tenant_id,id,property_node,
reservation_lineage_id,hold_binding_id,attribution_id,reservation_id,segment_id,
origin_quote_hash,snapshot_hash,currency,service_provision_date,
service_provision_source,service_provision_evidence_sha256,legal_rule)` row by equality
on the requested tenant, property, reservation, root id and exact date. No latest,
nearest, clock or network lookup exists.

Before accepting that row, the resolver independently revalidates the complete
immutable Order252 reservation/first-segment posting-identity tuple and reparses the
canonical Order240 attribution. The lineage must retain the exact hold binding,
attribution, reservation, first segment, origin quote hash, snapshot hash and currency;
the attribution must still be `rate_quote`, line `room` and revenue group
`room_revenue`. Missing, duplicate, malformed, cross-lineage or stale-hash evidence
fails closed.

The fixed-order recursively frozen result contains minimized Order252/240 lineage,
the explicit service-provision date, exact source
`governed_service_provision_record`, evidence SHA-256, legal literal
`CGST_ACT_13_2_B_SERVICE_PROVISION_DATE_INPUT_ONLY` and a deterministic tenant-bound
evidence hash while leaving the tenant unexposed. The table is forced-RLS protected
and `app_role` has SELECT only; no application/runtime writer, ingestion command or
attestation policy exists yet. Deployment fixtures stand only for already governed
external evidence.

This date is an input root, not a derived operational date and not a statutory result.
It is never derived from or compared with Order287 `supplyDate`, an Order240 room-night
`businessDate`, the Order252 reservation period, arrival/departure, check-in,
occupancy, checkout, journal or posting dates, or any clock. It does not decide CGST
section 13 time of supply and grants no invoice, payment, tax, item, document,
submission, API, UI or local-runtime authority.

## 38. Governed India GST accommodation invoice-issue-date evidence

`IndiaGstAccommodationInvoiceIssueDateService.resolve(tx,input)` accepts exactly
the eight plain keys `tenantId`, `propertyNode`, `reservationId`,
`serviceProvisionSnapshotId`, `invoiceIssueSnapshotId`, `invoiceIssueDate`,
`invoiceSeries`, and `invoiceSerial`; accessor, proxy and symbol inputs fail closed.
It equality-selects the exact root and revalidates approved Order290 service
provision plus complete Order252 reservation/segment to Order240 canonical
`rate_quote`/`room`/`room_revenue` attribution lineage.

The sole root is forced-RLS, SELECT-only and has exactly twelve columns:
`tenant_id`, `id`, `service_provision_snapshot_id`, `currency`, `amount_minor`,
`coverage_scope`, `invoice_series`, `invoice_serial`, `invoice_issue_date`,
`invoice_issue_source`, `invoice_issue_evidence_sha256`, `legal_rule`. Positive
amount equals full attribution grand total; currency agrees across lineage;
`coverage_scope` is exactly `full_attribution`; source is exactly
`governed_supplier_tax_invoice_record`; legal rule is exactly
`CGST_ACT_13_2_INVOICE_DATE_INPUT_ONLY`; evidence is lowercase SHA-256.

The frozen result returns minimized lineage and tenant-bound evidence only. Missing,
duplicate, malformed, mixed-lineage, stale-hash, identity, amount/currency or
non-full evidence fails closed. `PUBLIC`, `yellow_runtime` and `app_role` cannot
mutate it; no writer, ingestion, rendering or network lookup exists. This evidence
does not issue an invoice, decide validity, numbering, Rule47 regime/deadline,
timely/late status or section13 time of supply, and grants no tax, payment, voucher,
document, IRP, submission, API, UI or local authority. No operational, payment,
provider, folio, journal, posting, reservation or clock date substitutes.

## 39. India GST accommodation invoice timeliness (Order 293)

`resolveIndiaGstAccommodationInvoiceTimeliness` is a read-only composer using one
equality-bound tenant-scoped query over approved Order290 service-date and Order292
invoice-date evidence plus explicit ordinary Rule47 policy. Its exact plain input has
nine keys: `tenantId`, `propertyNode`, `reservationId`, `serviceProvisionSnapshotId`,
`invoiceIssueSnapshotId`, `serviceProvisionDate`, `invoiceIssueDate`,
`ordinaryRegimeSource`, and `ordinaryRegimeEvidenceSha256`. Only source
`governed_rule47_ordinary_regime_record`, and legal literal
`CGST_RULE_47_ORDINARY_SERVICE_INVOICE_30_DAY_INPUT` is accepted; output regime is
fixed `ordinary_rule47_30_day`; no regime is inferred. Date-only arithmetic sets
`deadlineDate = serviceProvisionDate + 30 calendar days`; day 30 is `timely`, day 31
is `late`. Arithmetic is explicit proleptic-Gregorian YYYY date-only arithmetic with
low-year handling and fail-closed overflow; JavaScript `Date.UTC` is not an authority.

The input rejects accessors, proxies and symbols. The fixed-order recursively frozen
result retains both dates, deadline, output regime, policy source, legal literal,
`ordinaryRegimeEvidenceSha256`, `invoiceSeries`, `invoiceSerial`,
`invoiceIssueEvidenceSha256`, `serviceProvisionEvidenceSha256`, complete lineage and
deterministic tenant-bound evidence hash without tenant identity; both predecessor
evidence hashes are revalidated and bound into that hash.
Missing, malformed, duplicate, stale, exception-bearing, mixed or contradictory
evidence fails closed. No clock, timezone conversion, latest/nearest/fallback,
write, migration, invoice issuance/validity/numbering, regime selection, section13
result, tax, document, API, UI or local authority is produced.

## Order295: India GST registration at exact time of supply

`resolveIndiaGstRegistrationAtTimeOfSupply(tx,input)` is a migration-free,
read-only composer. It performs one tenant-leading, transaction-local equality
read joining the approved Order289 registration/status roots and complete
Order294 service, payment, invoice, reservation-lineage and attribution roots.
`statusAsOf` must equal the selected `timeOfSupplyDate` exactly; the snapshot date
is evidence time only and never an inferred validity interval. The resolver
revalidates every public predecessor envelope, identity, source, legal literal,
date, currency, amount, attribution and deterministic evidence hash. Exact input
fields `supplierRegistrationStatusEvidenceHash` and `timeOfSupplyEvidenceHash`
must equal the independently recomputed approved predecessor hashes; hash-only
trust is forbidden. The result returns
only `active_at_time_of_supply` with fixed-order recursively frozen, tenant-hidden
evidence. Missing, duplicate, stale, malformed, contradictory or cross-lineage
evidence fails closed. No rate, levy, tax, section14, document, posting, IRP,
writer, API, UI or network authority is granted.

# Order294: India GST accommodation time of supply

`resolveIndiaGstAccommodationTimeOfSupply(tx, input)` is a tenant-scoped, SELECT-only
composer for ordinary CGST section 13(2)(a)/(b). It equality-binds approved service,
payment, invoice, reservation-lineage and attribution evidence in one read and returns
deterministic frozen evidence; it does not issue documents, calculate tax, or write.

## Order296: India GST recipient registration at exact time of supply

`resolveIndiaGstRecipientRegistrationAtTimeOfSupply(tx,input)` is a migration-free,
SELECT-only composer over complete approved Order285 recipient-status evidence and
complete Order294 accommodation time-of-supply evidence. One tenant-leading,
equality-bound read independently reconstructs both public predecessor envelopes and
requires their caller-selected hashes to match. `statusAsOf` must equal
`timeOfSupplyDate`; no effective interval, nearest/latest status, or portal lookup is
inferred. The recursively frozen result states only
`active_recipient_registration_at_time_of_supply`, preserves complete predecessor
identity/evidence, and hides tenant identity, GSTIN and address. Missing, duplicate,
malformed, crossed, stale or contradictory evidence fails closed. It grants no legal
buyer, B2B/B2C, place-of-supply, supply-nature, rate, levy, tax, document or IRP
authority.

## Order297: India GST supply nature and registrations at exact time of supply

`composeIndiaGstAccommodationSupplyNatureAtTimeOfSupply(input)` is a pure,
migration-free composition boundary over complete approved Order287 supply-nature,
Order295 supplier-active-at-time and Order296 recipient-active-at-time results.
It independently replays each complete frozen envelope, binds property, reservation,
registration, service-location, lineage, hashes and every relevant date, and requires
the Order287 `supplyDate` plus both registration status dates and both time-of-supply
dates to be identical. The result is recursively frozen and tenant-hidden, with only
`supply_nature_and_registrations_bound_at_time_of_supply` evidence. Malformed,
mutable, stale, crossed, reduced, surplus or contradictory roots fail closed. No
buyer/B2B, `Pos`, `SupTyp`, `IgstOnIntra`, rate, levy, tax, document, IRP, writer,
network, API, UI or database authority is granted.
The minimized result preserves `supplierTimeOfSupplyEvidenceHash` and
`recipientTimeOfSupplyEvidenceHash` separately; the predecessor-specific hash
algorithms are never conflated into one cross-root hash.

## Order298: India GST accommodation effective rates

The existing effective-dated `in-gst-lodging` extension retains its tax-exclusive,
document-rounded, transaction-value `slab_percent` shape and `room_revenue` scope.
The launch fixture follows CBIC Notification 20/2019-Central Tax (Rate), effective
1 October 2019, and Notification 04/2022-Central Tax (Rate), effective 18 July 2022.
For one accommodation unit per day, a value at or below 750000 minor INR uses
`0.12`; a value above it uses `0.18` in the final null upper band. There is no nil
or 0.05 accommodation band. The unrelated restaurant/F&B `GST_FNB` example remains
independent. This is content for the existing evaluator only: no rate-date
selection, section 14 change-in-rate composition, levy decomposition, posting,
invoice or fiscal-submission authority is added.
