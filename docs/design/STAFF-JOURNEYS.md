# Staff journeys: hotel and STR

**Status:** expanded under Orders433 and 440; research and design specification,
not a claim of implemented UI or live department workflow · 2026-09-05.
Requirements: [YF-002–015](../FEATURE-REGISTER.md). Research:
[PMS/STR benchmark](../research/STAFF-STR-ECOSYSTEM-2026-09.md) and
[hotel operations review](../research/HOTEL-OPERATIONS-REVIEW.md). Companion design:
[synthetic hotel casebook](HOTEL-CASEBOOK.md) and
[staff workbench specification](STAFF-WORKBENCH-SPEC.md).

## One domain core, different workspaces

| Decision | Hotel workspace | STR workspace |
|---|---|---|
| Start of work | Today's shift: arrivals, departures, in-house, readiness and cashier exceptions | Portfolio: listing calendar, arriving guests, turnovers, messages, owner and channel exceptions |
| Primary navigation | Front desk, reservations, rooms/housekeeping, cashier, distribution, revenue | Listings, multi-calendar, reservations/inbox, turnovers, pricing, owners/statements, distribution |
| Inventory mental model | Property → room category → physical room; room assignments and service readiness | Portfolio → listing/unit → linked inventory; whole home/room sharing and turnover windows |
| Revenue work | Room-category/rate-plan/date and segment demand | Listing/date calendar, gaps, minimum stay, weekly/monthly discounts and turnover economics |
| Guest arrival | Staff-led readiness and check-in, identity, payer, room key handoff | Arrival instructions, access readiness and supported self/assisted check-in; no invented smart-lock integration |
| Finance | Cashier sessions, guest/company folios, charges, payments and fiscal documents | The same ledger plus separate owner/trust statements, fees, expenses and payouts where implemented |

Property experience is independent of appearance. An STR portfolio can use Glass or
ERP; a hotel can use Apple or Win95. Role and jurisdiction further shape the allowed
journey. Neither a skin nor a workspace creates new server permissions.

## Guest lifecycle: one stay, many accountable handoffs

| Stage | Guest experience | Staff work and evidence | Failure or recovery |
|---|---|---|---|
| Discover and reserve | Compare an actually sellable stay, understand inclusions, total, guarantee and cancellation terms, then receive a human-readable confirmation | Reservations records booking intent, source, payer scope, occupants and only applicable mandatory data; the server receipt is the evidence | Preserve unavailable reasons, rejected payment/guarantee and ambiguous outcomes; an exact retry must not create a second reservation |
| Prepare to arrive | Supply travel, accessibility and arrival requests once; receive accurate instructions | Reservations resolves source revisions and missing requirements; front office reviews current-day arrivals; transport, bell, housekeeping and other teams receive only their owned work | A changed ETA, unacknowledged pickup or unmet request remains a visible exception with an owner, rather than optimistic guest copy |
| Enter the property | Find the entrance, vehicle process, pickup or luggage help without repeating the booking | Security, valet, bell or transport records an access, custody or service milestone linked to the stay where necessary | The service outcome never implies identity verification, check-in, parking allocation or room readiness |
| Arrive and check in | Be matched to the exact booking, answer only unresolved questions, understand a wait or room choice, and receive an access credential only after success | Front office reviews current server truth, assigns an eligible room, verifies configured identity/payment prerequisites and commits the governed check-in | Duplicate names require disambiguation; an unready room enters a managed queue; a failed or stale command retains context and revalidates before retry |
| Stay | Request service through one visible thread and receive truthful progress and follow-up | The owning department acknowledges, acts and attaches bounded evidence; front office or the duty manager coordinates cross-department recovery | DND, inability to enter, unavailable stock, unsafe equipment, failed delivery and guest no-contact are explicit blocked states with a next attempt or escalation |
| Move or recover | See the room, rate, billing and access consequences before agreeing to a move or recovery | Front office owns the stay transition; engineering owns repair evidence; housekeeping owns condition; finance owns postings; the duty manager owns only an authorized exception decision | A room move closes the prior occupancy segment and creates the next; repair, cleaning and compensation do not silently prove one another |
| Depart | Review the correct payer windows, settle or transfer through an allowed path, arrange luggage/transport and receive a truthful checkout receipt | Front office executes checkout only from current readiness; the committed event creates separate room-audit, housekeeping, bell or transport work where configured | A minibar observation remains a proposed charge; undelivered downstream work is retryable and visible; checkout does not claim the room is clean |
| After stay | Retrieve documents, resolve a complaint or lost-property enquiry and control future contact | Finance, guest relations or security uses a purpose-limited case with an accountable owner and retention policy | Do not expose the former guest's profile broadly or keep incidental identity, health, payment or incident detail merely because it might be useful later |

The detailed cases are explicitly fictional and test the competing needs, recovery and
observable acceptance of these stages in the [hotel casebook](HOTEL-CASEBOOK.md).

## Six independent room and stay truths

Never compress the following into one editable `ready` field:

| Truth | Examples | Authority and consequence |
|---|---|---|
| Reservation lifecycle | reserved, due-in, in-house, due-out, checked-out | Front office/reservations command state; says nothing by itself about physical presence or cleaning |
| Physical occupancy | vacant, occupied, uncertain/discrepant | Authoritative stay/occupancy plus bounded observations; only the governed occupancy path allocates or releases space |
| Housekeeping condition | dirty, pickup, clean, inspected | Housekeeping records service condition; a supervisor inspection may be required by property policy |
| Inventory restriction | available, out of service, out of order | An authorized operational restriction with dates and business effect; `out of order` removes inventory while `out of service` can remain counted/assignable in the cited OPERA model |
| Guest service state | DND, service declined, make-up requested | A request or permission for service, not a cleaning, occupancy or safety conclusion |
| Derived arrival readiness | ready, blocked with typed reasons, stale/unknown | A fresh server-owned conjunction of assignment, room condition, occupancy, statutory, payment and other configured guards; the browser never authors it |

OPERA's housekeeping documentation independently models cleaning condition, front-office
occupancy discrepancy, guest service state and inventory restrictions. It defines
dirty, pickup, clean and optional inspected conditions; `out of order` removes a room
from assignable inventory, while `out of service` does not have that same inventory
effect. Yellow adopts the separation of concerns, not OPERA's implementation or every
status rule. See Oracle's
[Housekeeping Board](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.2/ocsuh/t_housekeeping_using_the_housekeeping_board.htm),
[Room Management controls](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.2/ocsuh/c_opera_controls_room_management.htm) and
[Out of Order workflow](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.2/ocsuh/t_housekeeping_out_of_order.htm).

Assignment, a completed cleaning or repair task, a green icon, a sent message or a
manager note cannot independently prove check-in readiness. Every view names which
truth it displays, its evidence time and the owning workflow for the next blocker.

## Work-item grammar and acknowledgement

The operational spine is:

`role → current context → next authorized action → owner → acknowledgement → evidence → exception/follow-up`

Every cross-department work item carries a committed trigger; tenant/property; source
entity and human reference; service date and due time; owning department; current
assignee or visible unassigned queue; priority and reason; acknowledgement state;
bounded completion evidence; guest-communication owner; and correlated successor or
exception. `Sent` means delivery was attempted. It is not `acknowledged`, `started`,
`completed` or `guest informed`. Retries deduplicate the same trigger.

Free-text logs add context but do not own the obligation. Oracle's service requests
separate resolution from later follow-up/closure, its maintenance requests carry room,
reason, assignee, expected date and optional images, and its departmental log is
described as a next-shift handoff aid. These are useful workflow evidence, not claims
about Yellow's current backend. See Oracle
[Service Requests](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.1/ocsuh/t_managing_service_requests.htm),
[Room Maintenance](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.4/ocsuh/t_maintenance_managing_maintenance_requests.htm) and
[Log It](https://docs.oracle.com/en/industries/hospitality/opera-cloud/23.4/ocsuh/t_logging_it.htm).

## Department workday and handoff ownership

Each workspace starts with owned work and exceptions, not a generic menu. Rows marked
Phase17 are planned product destination only.

| Department | Start queue and next action | Ownership, acknowledgement, deadline and evidence | Guest communication and exception |
|---|---|---|---|
| Reservations | Future arrivals, source revisions, unconfirmed guarantees, rooming-list and travel gaps → resolve the earliest material booking blocker | Owns pre-arrival completeness and booking changes; acknowledges source conflicts; evidence is the accepted change/receipt and source revision before the arrival cutoff | Owns pre-arrival clarification; hands current-day operational blockers to front office without promising a room |
| Front office | Due-in, queued, in-house, due-out and readiness/cashier exceptions → open the exact stay and act on its first server-owned blocker | Owns reservation transitions and the guest-facing arrival/departure decision; revalidates immediately before commit and retains the durable receipt | Owns reception updates and coordinated recovery; ambiguous identity, unready room, failed authorization, room move or unsettled window remains explicit |
| Housekeeping | Authoritative task sheet, departures, stayovers, priorities, DND and discrepancies → verify the room and accept/start the task | Owns observation, cleaning condition and inspection evidence; records start/end, before/after condition and bounded reason/photo by due time | Reports service progress through front office or the approved channel; DND, guest present, damage, lost property, minibar observation and maintenance need create distinct exceptions |
| Engineering | New, unassigned, overdue and reopened faults plus affected-room restrictions → triage safety/business effect and accept by skill | Owns diagnosis, repair, test evidence and ETA; proposes or applies only an authorized dated restriction, then hands back for clean/inspection | Front office owns guest-facing impact unless policy assigns otherwise; unsafe entry, unavailable part, repeat failure and repair past arrival escalate to duty manager |
| Bell / concierge / transport | Scheduled pickups/drop-offs, luggage, vehicles, messages and wake-up failures → accept custody or service task | Owns movement, chain-of-custody and contact outcome with scheduled time, handoff time and recipient; recorded flight/ETA is not live outcome evidence | Owns the agreed service update; no-contact, delayed driver, missing bag, capacity/access need or failed vendor response escalates without implying arrival/check-in |
| Security | Access/vehicle exceptions, assistance requests and restricted incidents → contain immediate risk under property procedure and acknowledge | Owns security incident, access and evidence custody; the duty manager coordinates business recovery but cannot rewrite the security record | Shares only the minimum safety instruction; emergency-service notification, disputed access, lost key, vulnerable person or evidence hold follows configured policy rather than an AI decision |
| Duty manager | Aged unacknowledged work, cross-department blockers, safety/service recovery and requested overrides → accept coordination and choose an authorized path | Owns the cross-department decision, reason, deadline and follow-up; an override remains scoped to its exact permission and never bypasses occupancy, tenancy, money or audit invariants | Owns coordinated guest recovery; unresolved work receives a named incoming owner and acknowledgement at shift handoff |
| Sales and groups (Phase17 planned) | Leads, proposals, blocks, pickup, rooming lists and contract/deposit milestones → progress the next dated commitment | Owns commercial opportunity/block evidence and sales handoff; reservations owns individual bookings and finance owns money | Owns organizer communication; protects attendee data and makes shortage, release-date and contract exceptions explicit |
| Banquets/events (Phase17 planned) | Today's functions, changes, setup/resource gaps and banquet checks → confirm the next service milestone | Owns event-order execution and function evidence; sales owns contracted scope, stores owns issue/return and finance owns postings | Owns organizer operational updates; late changes, missing equipment, dietary escalation and no-show are acknowledged handoffs |
| Kitchen and F&B (Phase17 planned) | Covers/orders, meal-plan entitlements, dietary notices and outlet/interface exceptions → accept the production/service obligation | Owns preparation/service evidence and POS-origin correction; never treats a package label as a hidden financial instruction | Service staff own guest updates; allergen/medical detail is disclosed only as required for safe service, with stock or interface failure escalated |
| Spa/wellness (Phase17 planned) | Appointments, practitioner/resource availability, consent and room-charge exceptions → validate eligibility and accept service | Owns appointment/service evidence; front office/finance owns validated charge destination and posting | Owns appointment communication; health information is compartmentalized from general stay notes and unavailable staff/resource creates a recovery task |
| Purchasing and stores (Phase17 planned) | Requisitions, approvals, deliveries, par/expiry variance and department issues → fulfil or acknowledge shortage | Owns supplier/order/receipt and stock issue/return evidence; requester confirms receipt | The requesting department owns guest impact; substitution, spoilage, short delivery and emergency purchase require visible approval/reason |
| Finance and night audit | Cashier exceptions, unsettled windows, interface/outbox failures and unsealed-day backlog → resolve in owning workflow and refresh readiness | Owns financial evidence, corrections and business-day seal; immutable receipts and exact business date remain visible | Front office communicates guest billing matters; a discrepancy is resolved or governed-carried, never hidden to make close appear green |
| Management and revenue (Phase17 planned where absent) | Demand, availability, restrictions, pace, service risk and property performance exceptions → inspect cited drivers and authorize a bounded decision | Revenue owns rate/restriction proposals; management owns configured approvals; neither writes inventory or money outside canonical commands | Guest contact stays with the operating department; forecasts never masquerade as observed truth or justify invented scarcity |
| STR ownership and field operations (Phase17 planned where absent) | Portfolio arrivals, turnovers, access/message exceptions, owner approvals and statement issues → route to the listing/unit owner | Operations owns turnover/access evidence; finance owns trust/owner accounting; owner approval is distinct from guest authority | Guest messaging has a named operator; cleaner/contractor views receive only unit, task and entry instructions, not the full guest or owner account |

OPERA documents an arrival queue that can prioritize housekeeping and record guest or
attendant notification, but readiness still requires the room to become vacant and the
configured clean/inspected condition. That supports Yellow's explicit
front-office → housekeeping → front-office acknowledgement loop for early arrival;
it does not authorize Yellow to infer readiness from a message or task completion.
See Oracle [Reservation Queue](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.3/ocsuh/t_arrivals_in-house_adding_reservation_to_queue.htm)
and [Check-in](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.2/ocsuh/t_checking_in_reservations.htm).

## Shift start, active work and handoff

1. **Start:** select property and role; show property-local time, active operating
   date, exact business date, data freshness and owned/unassigned/overdue counts.
2. **Accept:** incoming staff acknowledge high-risk and due-soon items. A previous
   assignee remains in history; reassignment does not erase elapsed time.
3. **Work:** each completion refreshes authoritative truth and proposes the next
   action in its owning workflow. Cross-department progress is visible without exposing
   all source data.
4. **Escalate:** missed acknowledgement, deadline, conflicting room truth, unsafe
   condition or guest-impact threshold routes one deduplicated exception to the
   configured lead/duty manager.
5. **Hand over:** outgoing and incoming staff review open risk and guest promises
   verbally and in the written work record; the incoming owner acknowledges each
   transferred obligation. A shift summary alone cannot close its underlying tasks.

UK HSE guidance describes safe shift handover as two-way, jointly responsible and
supported by both verbal and written communication. Yellow should make that ownership
observable while leaving staffing policy configurable. See
[HSE shift handover guidance](https://www.hse.gov.uk/humanfactors/topics/shift-handover.htm).

## Reservation: concise first, complete when needed

1. Choose property/listing, dates and guests. Search actual sellability and show
   comparable total, cancellation terms and inclusions. Keep unavailable explanations.
2. Select a sellable/rate/package and hold where supported. Collect lead guest and
   contact, source/channel and an explicit booking intent; distinguish hold from booking.
3. Add details in contextual sections, not a mandatory giant form:
   occupants and ages where needed; room/bed preferences; accessibility and requests;
   arrival/departure travel; company/agent/group; meal plan and inclusions; payer and
   billing instructions; deposit/guarantee/cancellation policies; messages and tasks.
4. Review dates, occupants, rates, currency, taxes/fees, restrictions, guarantee,
   payer and required fields. Commit through the existing reservation/occupancy path.
5. Show the server receipt and reservation detail with relevant next actions. Losing
   a network response must not create a second reservation on retry.

EP/CP/MAP/AP are configurable meal-plan labels whose included meals/services must be
explicitly defined by the property. Packages are not hidden financial instructions.
Never collect PAN/CVV in guest notes, voice transcripts or booking forms.

| Branch | Required treatment |
|---|---|
| Walk-in or same-day | Check current business date, room condition and payment prerequisites; no shortcut around readiness |
| Repeat/VIP or multiple matching names | Resolve exact guest/reservation; show recorded preferences without assuming identity |
| Multiple rooms/group/company | Preserve rooming list, linked reservations, dates and payer scope; do not equate a group with one invoice |
| OTA modification/cancellation | Show source/revision and reconciliation state; apply through normal domain transitions |
| Extended/shortened stay or move | Recheck sellability, rate impact, room readiness and billing; present explicit before/after |
| Child/additional guest or accessibility need | Ask applicable questions only, respect access/privacy and enforce actual inventory constraints |
| Insufficient permission or unsupported feature | Explain the unavailable action and authorized handoff; do not expose hidden data |

## Today/future queue drill-down

`property + local date/range → count → filtered queue → reservation → guest/stay/folio`

Each count and its list share the same authorization, date semantics and filters.
Snapshot/as-of indicators explain updates. Preserve filters, scroll and focus when
returning. Cards must not show unauthorized guest counts or invent a count from a
partially loaded page. Future arrivals are a deliberate date/range choice, not a
separate disconnected workflow. Every row exposes status, time, unit/category,
readiness and the most important unresolved action; secondary details open in context.

## Arrival and room decision

Read booking requirements before suggesting a room: occupants, booked category,
explicit requests, accessibility, fixed assignments, protected allocations, current
occupancy and housekeeping readiness. Hard constraints eliminate invalid rooms;
soft preferences rank valid candidates. A VIP preference must be recorded policy or
an actual protected allocation, not an AI invention that silently displaces a guest.

Show: recommended room, evidence, alternative, trade-off and any upgrade price/terms.
Distinguish ready now from estimated-ready, including timestamp and responsible team.
Upgrade suggestions use actual availability and permitted prices; never pressure staff
to misrepresent scarcity. Check-in asks only unresolved mandatory questions, then
revalidates before the server command and shows a durable receipt.

The [voice flow](../architecture/VOICE-RMS-PLAN.md) follows this same state machine:
“Check in Mr XYZ, first tell me about the booking” resolves ambiguity, summarizes
relevant details, proposes a room, asks for missing information and confirms the
current target. Do not read sensitive identity/payment details aloud by default.

## Departure, room audit and service handoffs

`departure queue → checkout readiness → cashier/folio resolution → governed checkout → operational tasks → clean → inspected/ready`

Property policy determines whether a room audit/minibar check blocks checkout or is
a follow-up; do not invent a universal rule. A completed checkout can create distinct
housekeeping, room-audit and requested bell-desk/luggage tasks via committed events.
Workers deduplicate events. Pending task delivery is visible and retryable, not a
false “sent” success. A minibar observation is a proposed charge until an authorized
posting command accepts it; late corrections obey sealed-day and fiscal rules.

Dirty, cleaning-in-progress, clean and inspected/ready are different facts. The exact
implemented state machine remains authoritative; the UI must not invent unsupported
transitions. Inspection rejection creates explicit rework rather than silently making
an occupied or unready room available. Task completion does not independently release
occupancy or issue a refund/invoice.

## Cashier and split billing

Open the cashier workbench from a selected reservation/folio with property and currency
already explicit. Show current balance, window/payer and allowed charge actions. A
business-stay invoice and a personal spa/alcohol invoice may need separate legal
buyers/documents; grouping postings in a window is not itself fiscal issuance.

Corrections are new linked negative/positive entries. An original and its reversal
remain in the audit record even when an eligible guest-facing invoice excludes the
pair. The invoice must reconcile to its exact included posting set. Never hide a
live unpaid charge merely by calling a window “internal.” Post-seal corrections use
the authorized actor policy and current permitted accounting transition.

## Purpose-limited data, not a global access role

No role receives global guest access merely because it is called manager, security,
concierge or AI. Property and role scope remain server-owned; exceptional access must
be reasoned, audited and limited to the exact case. Shared queues show the smallest
useful projection and link to more detail only when the actor has the separate grant.

| Workspace | Necessary by default | Excluded by default |
|---|---|---|
| Front office/reservations | Display name, human confirmation, stay/party shape, masked contact where needed, identity/payment readiness and recorded requests | Raw payment credentials, unnecessary identity fields/images, unrelated profile history and sensitive details read aloud |
| Housekeeping | Room, service class/time, condition, DND/service request and only the operational instruction needed to service safely | Contact, identification, folio, payer/rate and complete profile; guest name itself remains a separate permission/policy choice |
| Engineering | Room/equipment, defect, safe-entry/DND signal, impact and coordination path | Guest identity/contact, folio/payment and security or medical narrative |
| Bell/concierge/transport | Pickup name or alias, approved contact channel, travel/service details and assistance required for that service | Identity document, payment/folio and unrelated preferences or stay history |
| Security | Restricted access/incident facts and the minimum identifiers required to act | Broad incident distribution, casual profile browsing, identity-image export and financial detail |
| Duty manager | Cross-department summary and separately authorized detail required for the current decision | An unrestricted “see everything” workspace or reusable browser authority |
| Commercial/contractor views | Organization, function/listing/unit and exact assigned obligation | Guest lists, owner accounts, health/access details or pricing outside the assigned purpose |

Do not copy passport numbers, accessibility/health detail, phone numbers, payment data
or incident narratives into general notes or shift summaries; link the governed source
record. Photos inherit the work item's access and retention, and capture should warn
against faces, documents and screens. Search terms containing personal data should not
enter URLs. Voice never reads sensitive identity or payment data by default.

Oracle makes showing guest names on housekeeping boards a distinct role task, which
supports purpose-limited projections rather than department-wide profile access.
The ICO's data-minimisation guidance requires personal data to be adequate, relevant
and limited to the stated purpose. Payment collection remains at hosted/tokenized
edges: PAN/CVV never enters Yellow, and PCI SSC states that card verification values
cannot be retained after authorization. See Oracle
[Housekeeping Board](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.2/ocsuh/t_housekeeping_using_the_housekeeping_board.htm),
[ICO data minimisation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/)
and [PCI SSC card-verification guidance](https://blog.pcisecuritystandards.org/faq-can-cvc-be-stored-for-card-on-file-or-recurring-transactions).

## Time, service date and business date

Every cross-midnight queue and receipt distinguishes:

- immutable UTC `occurred_at` for ordering and audit;
- property-local display time, including timezone/offset;
- service or stay date to which the arrival, cleaning, transport or event belongs;
- financial `business_date` selected by property rules; and
- accountable shift and its start/end instants.

Never collapse them into an unexplained `Today`. A 00:15 repair can belong to the
incoming shift, affect a stay night that began the prior calendar day and produce an
approved financial correction for a still-open prior business date. Filters, task
creation, handoff and receipts show the exact date kind they use.

Oracle documents business-date advancement as a specific End-of-Day procedure after
arrival, departure, cashier and other checks, demonstrating that business date is not
merely the browser clock. Yellow's canonical model deliberately separates automatic
**roll** from governed financial **seal**: the new operating day can open while an
older day remains in the unsealed backlog. Staff must see both without treating the
older blocker as a reason to target new operations to the wrong day. See Oracle
[End of Day](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.3/ocsuh/c_endofday_procedures.htm)
and Yellow's [state machines](../STATE-MACHINES.md#3-business-day--open--sealed).

## Progressive disclosure and visual acceptance

No final global Simple/Advanced/Expert selector: the next relevant detail appears as
a section, drawer, sheet or focused step. Preserve stable navigation, context, keyboard
access and draft state. Expert shortcuts accelerate the same authorized commands.

Motion explains relationships: selected reservation expands into its detail, rooms
move between visible readiness lanes only after confirmed state, and folio groups
show source/destination during a proposed split. 3D room visualization is optional
and must have equivalent keyboard/2D controls. No fake charts, decorative operational
counts or excessive blur on financial text. Follow the [design atlas](../DESIGN.md)
for dedicated materials, and test reduced motion, no-backdrop fallback, RTL, narrow
viewports and zoom.

Acceptance needs real authenticated browser evidence for hotel and STR journeys,
including loading, empty, stale, partial failure, validation, permission denial,
dirty-draft exit, duplicate retry, success and focus restoration. Existing source
foundations are listed in the feature register; no complete redesign has been verified
by this documentation order.
