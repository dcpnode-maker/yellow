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
contract. `GET /api/v1/properties/{property}/reservations/{reservation UUID}` accepts no
query parameters and returns the approved reservation aggregate plus server-derived
`canModify`, `canCancel`, and `canReinstate` actions. Missing, foreign-tenant and
foreign-property UUID details share one generic reservation not-found response. The
existing exact `GET .../reservations?confirmationNo=...` lifecycle lookup is unchanged.

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
