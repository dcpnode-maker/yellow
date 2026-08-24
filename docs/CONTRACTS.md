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

## 3. Module surfaces (names are the contract; bodies follow §1 shapes)

**reservations**: create/commit · get · modify (diff-based) · cancel · reinstate ·
check_in {segment,space?,keys?} · check_out {settlements[]} · move {to_space} ·
extend/shorten · group: create/status/allotment/rooming_list(bulk)
**financials**: postCharge {folio,tx_code,amount,qty} · transfer {lines[],to_folio|account} ·
adjust {reverses_line,reason} · settle {folio,method,instrument?,amount} ·
routeRules→Automation CRUD · folio: open_window/get/statement · deposits: request/apply ·
cashier: open/close · day: readiness/seal · ar: invoice(from folio)/allocate/statement
**inventory**: spaces/unit_types/sellable_units CRUD · restrictions batch ·
ooo/oos open+close · authority get/set · projection rebuild (admin)
**rates**: plans CRUD · prices batch-insert (insert-only; supersede) · packages · policies
**hk/stay**: condition set · tasks CRUD/assign/complete/verify · sheets generate ·
discrepancies · queue · messages send/thread
**profiles**: parties search(trgm)/create/merge/anonymise · consent · instruments(tokenize via PSP webhook)

Implemented domain slice: `PartyProfileService.search` performs tenant-bound, bounded
active-Party lookup by UUID, display name, or canonical contact and returns masked
contact hints. `PartyProfileService.create` normalizes Party roles/contacts, requires
exact server-recomputed duplicate acknowledgement, and atomically records non-PII
fact/event/idempotency evidence. HTTP/operator composition, merge/anonymisation,
addresses, identity documents, consent/preferences and profile editing remain planned.
**distribution**: channels connect · maps CRUD · inbound replay {id} · push status/cursors
**compliance**: documents issue/get/render · fiscal submit/status · statutory list_due/submit ·
erasure request/execute
**kernel**: extensions CRUD+activate · automations CRUD+test(dry_run) · approvals decide

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
