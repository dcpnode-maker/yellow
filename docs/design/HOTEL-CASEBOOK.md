# Yellow hotel casebook

**Status:** Order440 design specification · 2026-09-05 · **16 SYNTHETIC CASE
STUDIES — NOT FIELD DATA, PRODUCTION RECORDS OR MEASURED RESULTS**

This casebook turns the staff and guest journeys into stable scenarios for design,
prototype walkthroughs and later executable acceptance. Every person, property,
reservation, room, event, appointment, check, purchase order and amount is fictional.
The cases do not show that the described UI, automation, integration or Phase17
capability exists.

Read this with the [staff journeys](STAFF-JOURNEYS.md), the
[staff workbench specification](STAFF-WORKBENCH-SPEC.md), and the sourced
[hotel operations review](../research/HOTEL-OPERATIONS-REVIEW.md). Those documents
define the shared workbench and research basis; this document supplies bounded stories
and observable checks. The Order433 journey intent remains intact.

## How to use the cases

The IDs `YC-01` through `YC-16` are stable. A prototype, design review, test fixture or
future implementation order should cite the ID and the exact branch it covers rather
than copy and silently alter the story.

Each handoff uses this minimum envelope:

- property, subject and source identifiers;
- source version and as-of time;
- requested action, deadline and receiving owner;
- relevant operational or financial context, minimized to the receiver's role;
- `prepared`, `delivered`, `acknowledged` or `rejected`, and `completed` or
  `superseded` state;
- acknowledging actor and time; and
- durable evidence such as a domain receipt, accepted source version, posting or task
  reference, and idempotency key where retries are possible.

“Sent” is not an acknowledgement. A forecast, observation, task completion, financial
posting, document and occupancy change are separate facts. Current PostgreSQL-backed
domain behavior remains authoritative wherever a case touches sellability, occupancy,
money, tenancy or business date.

Capability labels in this document mean:

| Label | Meaning |
|---|---|
| Foundation located | A relevant Yellow context exists, but the complete case and redesigned UI have not been verified. |
| Specified | The desired behavior is documented; this is not a build or release claim. |
| Planned | The owning later phase has not shipped. Phase17 event, outlet, spa and hotel-interface behavior is planned. |
| Research-required | Property policy, jurisdiction, provider contract, credentials or an exact integration capability still needs a separate decision. |

Phase numbers below identify the scope that owns a fact or future capability. They do
not claim that a prerequisite, phase, joined workflow or UI is complete.

## Prototype coverage and bounded variants

The interactive staff-workbench study illustrates 14 cases: `YC-01`–`YC-06`,
`YC-08`–`YC-11`, and `YC-13`–`YC-16`. `YC-07` and `YC-12` are documentation-only
cases reserved for future authenticated domain testing. The prototype's `YC-16`
mentions their close and correction concepts but does not seal or correct a real
business day.

Prototype records are bounded fictional variants, not the full acceptance definition.
A displayed task time can be in the afternoon while the underlying `YC-04` pickup is
late at night; an example count, wording, actor sequence or context can likewise be a
smaller illustration. Such differences do not narrow the casebook. The stable case ID,
invariants, required branches and observable acceptance here remain the implementation
and review reference.

## Guest and staff operations

### YC-01 — Early arrival with a dirty assigned room

**Actors.** Arriving guest, front-desk agent, housekeeping coordinator, room attendant
and housekeeping supervisor; duty manager only if an exception needs authority.

**Precondition.** A valid same-day reservation has room 412 assigned. Occupancy and
assignment are valid, but the latest room condition is `dirty`. The guest arrives
before the property's usual readiness time.

**Guest promise.** The agent explains what is known, gives an evidence-based readiness
estimate or a valid alternative, and never presents a dirty or merely predicted-ready
room as ready.

**Handoff/version.** Front desk prepares `arrival-readiness/v1` with reservation,
room 412, observed condition, priority reason, requested time and guest-contact owner.
Housekeeping acknowledges that exact version. The room attendant records cleaning
completion, which leaves inspection pending. The housekeeping supervisor separately
records inspection evidence and hands `room-ready/v2` to front desk; front desk must
acknowledge that evidence before completing its current arrival review. A later room
reassignment or condition update supersedes the accepted version rather than editing
it invisibly.

**Exception and recovery.** If the estimate slips, housekeeping records the new
estimate and reason. Front desk rechecks sellability, hard guest requirements, room
readiness and any rate impact before proposing another room. Retrying task delivery
must not create a second cleaning task.

**Observable acceptance.** The arrival row distinguishes `assigned`, `dirty`,
`cleaning`, `clean/inspection required`, `inspection recorded/ready evidence pending
FO acknowledgement` and `estimated ready`; exposes owner, last update and
acknowledgement; preserves the guest's place and draft when refreshed; blocks check-in
until front desk acknowledges the inspection evidence and the authoritative command
revalidates readiness; and produces a durable receipt after any permitted check-in or
room change. A narrow/mobile view keeps the blocker and next action visible without
revealing unrelated guest data.

**Business-policy questions.** Does early arrival have a fee? Who can waive it? Which
requests are hard room constraints? May luggage holding or an amenity be offered, and
who owns that communication? These are configured decisions, not defaults in the case.

**Phase dependencies and capability truth.** Inventory and physical-room occupancy are
Phase2 scope; any early-arrival rate/policy is Phase3; the reservation and assignment
intent are Phase4; any financial effect is Phase5; check-in, room condition, cleaning
and inspection are Phase6; and the progressive workbench is Phase10. **Relevant
foundations are located and the joined behavior is specified; the complete journey is
not verified.**

### YC-02 — Housekeeping reports vacant while PMS shows occupied

**Actors.** Room attendant, housekeeping supervisor, front-desk agent and duty manager.

**Precondition.** PMS occupancy says room 307 is occupied through tomorrow. During a
room round, housekeeping reports the physical room as vacant.

**Guest promise.** No one releases, resells or enters the room on an unsupported
inference. Staff resolve the discrepancy without exposing the occupant's identity to
roles that do not need it.

**Handoff/version.** Housekeeping submits `room-discrepancy/v1` containing property,
room, reported state, current system state, observation time and reporter. Front desk
or the assigned supervisor acknowledges the exact discrepancy and owns investigation.

**Exception and recovery.** The observation can be correct while the guest remains
registered in-house, or it can reveal an incomplete checkout. Either way,
closing the discrepancy or completing a housekeeping task cannot release occupancy.
Only the sanctioned occupancy/stay command may do that after the reservation is
resolved.

**Observable acceptance.** The room appears in an explicit discrepancy queue rather
than a ready-room lane; the screen shows physical observation separately from PMS
state; direct “mark vacant and sell” is absent; wrong-role attempts fail closed; the
resolution records actor, reason, evidence and resulting domain receipt; and a stale
open tab cannot overwrite a newer resolution.

**Business-policy questions.** Which role investigates first? When is a welfare or
security check appropriate? What evidence is required to resolve each discrepancy
type? Property procedure supplies these answers.

**Phase dependencies and capability truth.** Inventory and PostgreSQL occupancy
authority are Phase2 scope; the stay's reservation record is Phase4; checkout,
discrepancy and room-state work are Phase6; and workbench treatment is Phase10.
**Relevant foundations are located; the case must reuse the existing discrepancy and
occupancy choke points, without claiming the joined journey is complete.**

### YC-03 — Air-conditioning failure, DND and an authorized room move

**Actors.** In-house guest, front desk, engineering dispatcher, engineer, housekeeping
and an authorized room-move actor.

**Precondition.** The guest reports failed air conditioning in room 508 and has DND
active. Another suitable room may be available, but its sellability and readiness have
not yet been revalidated.

**Guest promise.** Staff acknowledge the problem, agree how and when the room may be
accessed, and offer only a valid room alternative with clear rate and billing effects.

**Handoff/version.** Front desk creates `engineering-request/v1` with room, symptom,
urgency, DND/access constraint, agreed contact method, response owner and deadline.
Engineering acknowledges it. If the guest changes access permission or accepts a move,
`v2` supersedes `v1`; the delta is visible to engineering and housekeeping.

**Exception and recovery.** Non-emergency work remains blocked while DND/access is not
granted. If repair cannot meet the agreed time, front desk prepares a room move that
rechecks occupancy, room condition, guest requirements, rate impact and payer. Task
completion alone cannot move the guest, release the former room, post compensation or
mark either room ready.

**Observable acceptance.** The workbench shows the DND blocker before dispatch;
engineering can acknowledge, schedule, reject or complete within its authority; only an
authorized role sees the commit room-move action; the preview gives old/new rooms,
trade-offs and financial effects; the final receipt links the reservation, occupancy
change and follow-up cleaning task; and stale or duplicate commits converge safely.

**Business-policy questions.** What counts as an emergency override? Who can authorize
entry, upgrades, compensation and rate changes? How long may an out-of-service room
remain unavailable? Those rules need explicit property configuration.

**Phase dependencies and capability truth.** Room inventory and occupancy are Phase2;
rate/policy impact is Phase3; reservation modification is Phase4; compensation or other
financial adjustment is Phase5; stay movement, tasks and condition follow-up are Phase6;
workbench design is Phase10; and engineering/building-system interfaces are Phase17.
**Relevant foundations are located for a governed move; the joined engineering journey
and any device integration are planned/research-required.**

### YC-04 — Late-night airport pickup remains unacknowledged

**Actors.** Arriving guest, reservations agent, concierge or transport coordinator,
driver/provider and night front desk.

**Precondition.** Flight information and a requested pickup are recorded for a
late-night arrival. The transport request was delivered but no driver or dispatcher has
acknowledged it by the operational deadline.

**Guest promise.** Staff never say the pickup is confirmed when only a request exists.
The guest receives a truthful status, escalation owner and fallback instructions through
an authorized communication channel.

**Handoff/version.** Reservations creates `airport-pickup/v1` with reservation, pickup
location, flight reference as supplied, scheduled time with timezone, passenger count,
contact channel, accessibility/luggage needs where relevant, provider and acknowledgement
deadline. A flight-time change creates a superseding version.

**Exception and recovery.** At the deadline the request enters an unacknowledged queue
owned by concierge/night staff. They may reassign or cancel through the configured
workflow. A provider timeout or lost response remains `unknown`; retry uses the same
handoff identity. The UI does not infer live flight status or successful message
delivery.

**Observable acceptance.** Requested, delivered, acknowledged, assigned, completed,
rejected and unknown are distinct; the night dashboard elevates the missed acknowledgement;
the selected reservation retains its transport context; a stale driver acknowledgement
cannot accept an obsolete time; retry does not duplicate the pickup; and guest-facing
copy never upgrades `requested` to `confirmed`.

**Business-policy questions.** Which providers, cutoff times, fees, cancellation terms,
fallbacks and communication channels apply? Is external flight status licensed and
fresh enough to display? These require property/provider decisions.

**Phase dependencies and capability truth.** The linked reservation is Phase4 scope;
any transport charge is Phase5; travel detail, pickup automation and transfer tasks are
Phase6; staff presentation is Phase10; guest-service communication can use Phase15; and
provider adapters are Phase17. **Relevant foundations are located for recorded
travel/task context; live provider acknowledgement is planned and access-gated.**

### YC-05 — DND blocks non-urgent maintenance

**Actors.** Guest, room attendant, engineering dispatcher, engineer and front desk.

**Precondition.** Housekeeping notices a loose wardrobe handle while servicing is
declined or DND is active. The condition is recorded as non-urgent.

**Guest promise.** Staff respect the access boundary and schedule the repair without
claiming the room was entered or fixed.

**Handoff/version.** Housekeeping prepares `maintenance-observation/v1` with room,
bounded symptom, urgency classification, observation time, DND/access state and suggested
service window. Engineering acknowledges the observation, not permission to enter.

**Exception and recovery.** The engineering task remains blocked until an allowed
window or an explicit authorized access update. If urgency is reclassified, a new
version records the actor and reason. Completion requires work evidence; it does not
change room occupancy or financial state.

**Observable acceptance.** The task visibly separates `acknowledged` from `access
allowed`; the engineer cannot complete a blocked task; a wrong role cannot override
DND; the guest does not appear in the engineering queue by name unless operationally
necessary; and updates are usable by keyboard and at narrow width.

**Business-policy questions.** Which issues are urgent, who may reclassify them, what
access evidence is required, and which communications are allowed? Yellow must apply a
configured policy rather than invent a safety rule.

**Phase dependencies and capability truth.** Housekeeping and operational tasks are
Phase6 scope; role-aware workbench behavior is Phase10; and generalized engineering or
device integration is Phase17. **The case is specified; a joined maintenance workflow
and integration are planned, with no phase-completion claim.**

### YC-06 — Lost key requires identity and current-stay verification

**Actors.** In-house guest, front-desk agent and security or duty manager when the
property's escalation rule requires it.

**Precondition.** A person asks for a replacement key for room 611. They know the room
number and guest surname, but the agent has not resolved the exact active guest and stay.

**Guest promise.** Staff protect room access while using a respectful, property-approved
verification path. The interaction does not announce sensitive identity or payment data
to bystanders.

**Handoff/version.** Front desk starts `replacement-key/v1` bound to the resolved
reservation candidate, current room assignment, requesting actor, verification state and
reason. If the room changed or the stay checked out, that source version becomes stale
and cannot authorize issuance.

**Exception and recovery.** Multiple matching guests, a shared room, missing evidence,
inactive stay or insufficient permission blocks issuance and routes to the configured
escalation owner. Yellow must not invent a lock-vendor success from a PMS receipt.

**Observable acceptance.** Search minimizes candidate data; the agent must choose an
exact current guest/stay; room number plus surname is not treated as sufficient by the
case; the prepare step shows unresolved requirements; stale assignment revalidation
fails; successful authorization produces an audit receipt; wrong-role and duplicate
attempts do not create extra issuance records; and no PAN, document image or secret key
material enters notes.

**Business-policy questions.** What identity evidence is acceptable, when is manager or
security approval required, is a replacement fee allowed, and how are physical or
electronic keys revoked? These depend on property and lock-provider procedure.

**Phase dependencies and capability truth.** Identity and tenant/property grants are
Phase1 scope; the reservation is Phase4; any replacement fee is Phase5; active-stay and
room-move truth is Phase6; staff UX is Phase10; and lock adapters are Phase17.
**Relevant foundations are located for identity and active-stay resolution; key
issuance and lock integration are planned/research-required.**

### YC-07 — Midnight with the prior business day still unsealed

**Actors.** Night auditor, front desk/cashiers, finance exception owners and authorized
manager.

**Precondition.** Local clock time has passed midnight. The property's prior business
date is still open because close readiness has unresolved items.

**Guest promise.** Guest service continues under an explicit business date. Staff do
not misdate postings or claim that the calendar crossing automatically sealed finance.

**Handoff/version.** The close workbench publishes `close-readiness/vN` for the property
and open business date, with its as-of time, blockers, owner and evidence. The night
auditor acknowledges the snapshot before resolving, carrying or rechecking items.

**Exception and recovery.** Rolling the operational business date and sealing the
prior day are distinct governed actions. Midnight alone performs neither. A blocker may
be resolved or carried only through an existing authorized transition; a later posting
to a sealed date must use the allowed adjustment/correction path.

**Observable acceptance.** Every financial surface shows property and business date;
the dashboard distinguishes calendar date, current operational date, rolled date and
sealed state; stale readiness cannot authorize a seal; wrong-role attempts fail closed;
refresh preserves the selected blocker; duplicate roll/seal commands return a safe
receipt or domain result; and the audit history identifies actor and source evidence.

**Business-policy questions.** Which discrepancies may be carried, by whom, and with
what evidence? When should the scheduled close be initiated? Policy can set timing and
authority, but cannot redefine the property-timezone or sealed-day invariants.

**Phase dependencies and capability truth.** Cashier, business-day readiness, roll,
carry, seal and post-seal financial correction are Phase5 scope; applicable tax/fiscal
treatment is Phase7; and workbench presentation is Phase10. **Relevant foundations are
located; exact current state machines remain authoritative. Roll must never be presented
as seal, and this case is not executed by the prototype.**

### YC-08 — STR late checkout threatens turnover and owner expense

**Actors.** Departing guest, portfolio operator, cleaner, incoming guest and owner or
owner-accounting reviewer.

**Precondition.** A guest requests late checkout from a whole-home listing. A same-day
arrival and fixed cleaning window follow. An additional cleaner or reschedule may create
an owner expense, but no action has been approved.

**Guest promise.** The operator confirms late checkout only after evaluating occupancy,
turnover and incoming-arrival impact. Access instructions remain accurate without
pretending Yellow controls a smart lock.

**Handoff/version.** The operator prepares `late-checkout-impact/v1` with listing,
current departure, requested departure, next arrival, turnover duration, assigned
cleaner, readiness risk, proposed guest charge and proposed owner expense. Cleaner and
the required commercial owner acknowledge the exact accepted version.

**Exception and recovery.** If cleaner acknowledgement is missing or the next arrival
cannot be protected, staff reject or revise the request and communicate the outcome. A
late checkout changes occupancy only through the governed stay path. Creating a task
does not approve an owner expense; approving an expense does not extend the stay or send
new door codes.

**Observable acceptance.** The impact preview shows before/after times and all affected
reservations/tasks; stale next-arrival data blocks commit; the cleaner's acknowledgement
and owner-expense approval are independent; any guest charge and owner expense have
separate payer/accounting evidence; retries deduplicate; mobile preserves timeline and
decision context; and the UI labels access instructions as recorded or externally
managed rather than “lock updated.”

**Business-policy questions.** Who may approve late checkout, fees, extra cleaning and
owner expenses? What turnover buffer is required? Which channel message and access
provider operations are actually supported?

**Phase dependencies and capability truth.** Listing/unit inventory and occupancy are
Phase2 scope; late-checkout price/policy is Phase3; reservation modification is Phase4;
guest charges and owner/trust expenses are Phase5; stay and turnover tasks are Phase6;
STR workspace design is Phase10; CRM/CRS/direct-booking communication is Phase15; and
lock adapters are Phase17. **Relevant foundations are located for stay, tasks and
governed finance; the joined STR workflow and lock integration are specified/planned.**

## Commercial, events, outlets, spa and finance

### YC-09 — Wedding BEO revision after department acknowledgement

**Actors.** Client contact, catering sales manager, event coordinator, banquet captain,
kitchen, stewarding, AV and stores.

**Precondition.** A synthetic wedding reception has an acknowledged BEO v3 for 80
attendees. Sales changes the guaranteed count to 95 and adjusts serve time after kitchen
and banquets accepted v3.

**Guest promise.** The hotel confirms the current agreed event details and executes one
known version. A document marked sent is not treated as accepted by either client or
departments.

**Handoff/version.** Catering publishes `BEO/v4` with a field-level delta from v3,
client-facing approval state, affected departments, effective time and acknowledgement
deadline. Only affected departments need to re-acknowledge; v3 remains immutable and
viewable.

**Exception and recovery.** If stores or kitchen cannot meet the new quantity or time,
they reject v4 with an owned blocker. Catering revises resources or returns the choice
to the authorized commercial owner. The BEO update does not itself consume stock,
occupy space or post revenue.

**Observable acceptance.** Current and superseded versions cannot be confused; changed
fields, actor, time and reason are visible; departmental acknowledgement is per version;
unaffected AV acceptance remains valid; stale completion against v3 is rejected or
flagged; mobile shows the highest-risk delta first; and BEO content is minimized by
department.

**Business-policy questions.** Who approves BEOs, what is the guarantee cutoff, which
changes require client approval, and which version blocks production? Status names and
deadlines are property configuration.

**Phase dependencies and capability truth.** Commercial financial effects are Phase5
scope; applicable tax/fiscal treatment is Phase7; the workbench is Phase10; groups and
commercial blocks are Phase11; and function space, event resources, BEO and departmental
execution are Phase17. **Specified and planned; no prerequisite completion, Phase17
backend or BEO document lifecycle is claimed.**

### YC-10 — Corporate group with company and personal charges

**Actors.** Corporate contact, sales manager, reservations, event coordinator, front
desk, spa/outlet cashier, finance and AR clerk.

**Precondition.** A company agrees to pay rooms, meeting-room rental and lunch. Each
traveller remains personally responsible for spa services and alcohol. A group block,
individual reservations and candidate posting master exist in the synthetic story.

**Guest promise.** Staff explain payer scope before service and produce documents that
contain only the postings assigned to the correct buyer. “Part of the group” never
means “one invoice for everything.”

**Handoff/version.** Sales publishes `billing-instructions/v2` with company profile,
covered charge categories, reservation/window targets, exclusions, effective dates and
approver. Reservations, events and finance acknowledge it. A later routing change
supersedes the version and does not rewrite already issued financial records.

**Exception and recovery.** A personal spa or alcohol charge proposed for the company
window is blocked or enters a routing exception. Finance previews the authorized
transfer/correction and preserves the original. Direct-bill transfer to AR occurs only
for the correct payee/account and current eligibility.

**Observable acceptance.** Contract tracking, deducting room allocation, picked-up
reservations, posting master, folio windows and fiscal documents remain distinct;
covered/excluded categories are visible in service context; the exact guest is selected
for personal charges; transfer preview identifies source and destination; wrong roles
cannot alter routing; and each generated document reconciles to its included posting
set.

**Business-policy questions.** Which categories, taxes, service charges and incidentals
does the company cover? Who may alter instructions, authorize exceptions and receive
documents? Which buyer and fiscal rules apply is a configured/jurisdictional decision.

**Phase dependencies and capability truth.** Folios, posting, routing, correction and a
bounded direct-billing foundation are Phase5 scope; tax/fiscal treatment is Phase7; UI
is Phase10; group/block capability is Phase11; full AR accounts, allocation, statements
and aging are Phase12; and event, outlet and spa sources are Phase17. **Relevant
financial foundations are located; full AR and the complete cross-source journey remain
planned.**

### YC-11 — Ambiguous outlet room charge followed by PMS timeout

**Actors.** Restaurant guest, server, outlet cashier, front desk and finance exception
owner.

**Precondition.** Two registered guests share room 412. The outlet check is complete,
but the cashier initially enters only the room number. The first posting request receives
no conclusive response.

**Guest promise.** The hotel charges the exact intended guest/account once and never
labels an unknown interface outcome as paid.

**Handoff/version.** POS sends `outlet-charge/v1` with property, revenue centre, check,
employee/cashier, line or total breakdown, amount/currency, selected guest/reservation,
target window and idempotency key. PMS returns accepted, denied, ambiguous or unknown
against that exact request.

**Exception and recovery.** Multiple candidates require positive selection using
minimum identifying context. A timeout keeps the tender unresolved and the check in an
exception state. Retry reuses the idempotency key. A denial such as inactive stay leaves
the check payable by another permitted method.

**Observable acceptance.** Room number alone cannot silently select the primary guest;
the result state and owner are visible; timeout is not success; retry creates at most
one folio posting; an accepted receipt contains source check, target, amount and time;
denial text does not expose unrelated stay information; and the mobile cashier view
keeps unresolved tender status in view.

**Business-policy questions.** What positive-identification input is required? Which
folio/window may receive the charge? May an outlet operate offline, and what must remain
open until reconciliation? These are property/interface settings.

**Phase dependencies and capability truth.** The target reservation is Phase4 scope;
the folio, posting and correction target are Phase5; applicable tax/fiscal treatment is
Phase7; workbench UX is Phase10; and the outlet plus idempotent adapter ingress are
Phase17. **The cross-source flow is planned; no live POS/PMS adapter is claimed.**

### YC-12 — Wrong outlet charge discovered after business-day seal

**Actors.** Guest, outlet manager, front desk, finance correction actor and night auditor.

**Precondition.** An outlet dinner was accepted against the wrong resident. The error
is discovered after the source property's business day is sealed.

**Guest promise.** Staff correct the balance transparently without erasing history or
quietly reopening/re-dating the original transaction.

**Handoff/version.** Outlet manager raises `posting-correction-request/v1` with original
posting/check reference, claimed correct target, reason and supporting evidence. Finance
acknowledges the request and prepares an authorized correction preview against current
ledger state.

**Exception and recovery.** Delete and in-place retarget are forbidden. An unauthorized
actor receives a clear handoff route. An authorized flow creates a linked reversal or
adjustment and, if valid, a new posting. Post-seal rules determine the accounting date;
the UI does not pretend the original never occurred.

**Observable acceptance.** Original, reversal/adjustment and replacement remain linked
and visible; sealed-day authority is rechecked at commit; wrong-role and stale preview
fail closed; duplicate submission does not duplicate money; both affected folios
reconcile; and guest-facing documents follow their actual included-posting eligibility.

**Business-policy questions.** Who may approve a post-seal correction, what evidence is
required, and which current business date and fiscal treatment apply? Yellow's invariant
sets append-only correction; detailed authority and jurisdiction rules remain configured.

**Phase dependencies and capability truth.** Posting, correction, business-day and
financial-document foundations are Phase5 scope; applicable tax/fiscal and India IRP
treatment is Phase7; operator presentation is Phase10; and outlet origin plus adapter
correlation are Phase17. **Relevant finance foundations are located; outlet integration
is planned, and this case is not executed by the prototype.**

### YC-13 — Couples spa appointment with resource and form exception

**Actors.** Two guests, spa receptionist, two providers, spa attendant and spa cashier.

**Precondition.** A synthetic couples booking requests parallel services using two
providers, one couples room and shared equipment. One configured required service form
is incomplete. Both guests are in-house, but payer choice is unresolved.

**Guest promise.** Staff reserve valid resources, ask only configured service questions,
protect form details and charge the chosen guest or host only after explicit resolution.

**Handoff/version.** Spa reception prepares `appointment/v2` containing exact guests,
services, start/end, providers, room/equipment, processing buffers, price, entitlement
and form-status references. Providers acknowledge the operational version. Form answers
stay in a narrower authorized view.

**Exception and recovery.** A provider, room or equipment conflict blocks booking. A
configured prerequisite blocks only the affected service and explains the next step;
the case makes no medical or legal judgment. Completion, product consumption and
billing remain separate. A room-charge rejection leaves the spa invoice unsettled.

**Observable acceptance.** Availability checks every required resource and buffer;
appointment tiles show form status without answers; wrong-role access to form details
fails closed; each service can be completed only by an allowed actor; payer selection
resolves the exact guest/host; the room-charge result is explicit; and duplicate booking
or posting retries do not create extra appointments or charges.

**Business-policy questions.** Which forms or prerequisites apply, who may view them,
how long are they retained, what provider preferences are supported, and how are no-show,
package and host-payer rules handled? These are service/property/jurisdiction decisions.

**Phase dependencies and capability truth.** Inventory/occupancy boundaries that a
future model may reuse are Phase2 scope; guest/reservation truth is Phase4; finance
targets are Phase5; applicable tax/fiscal treatment is Phase7; staff UX is Phase10; and
appointment, resources, fulfilment and spa/PMS ingress are Phase17. Specialist
scheduling may remain an integration. **Planned and research-required; no prerequisite
completion, clinical suitability or legal-consent claim.**

### YC-14 — Banquet shortage, substitution and actual consumption

**Actors.** Event coordinator, stores clerk, purchasing, executive chef, banquet captain,
sales/commercial approver and finance.

**Precondition.** BEO v4 requests 110 meals, including eight vegetarian meals. Stores
can supply only 90 units of a named ingredient. Final actual attendance is 104.

**Guest promise.** The delivered menu and price reflect an acknowledged, authorized
change; service instructions preserve only the necessary dietary information.

**Handoff/version.** Stores raises `supply-exception/v1` against BEO v4 and the resource
line, with available quantity, required-by time and proposed alternatives. Catering
publishes a revised resource/BEO version after the right commercial and kitchen actors
accept the substitution.

**Exception and recovery.** No quiet substitution is allowed. If no option is accepted,
the exception remains owned and escalated. Expected, guaranteed, actual, produced,
served, returned, wasted and billed quantities remain separate. Billing follows the
configured basis rather than whichever number is largest or latest.

**Observable acceptance.** The shortage appears before production cutoff; decision
history identifies approver and affected menu/resource; kitchen acknowledges the revised
version; relevant dietary instruction remains visible without exposing guest profiles;
inventory movement records actual issue/return once; finance shows its count and price
basis; and changing actual attendance does not retroactively rewrite the accepted BEO.

**Business-policy questions.** Who may approve substitutions and price effects? Which
count drives purchasing, kitchen production and billing? How are waste and returns
recorded? Ingredient, allergen, billing and approval policies require explicit
configuration and specialist review where applicable.

**Phase dependencies and capability truth.** Financial effects are Phase5 scope;
applicable tax/fiscal treatment is Phase7; UI is Phase10; group demand is Phase11; and
event resources, kitchen/stores execution and consumption are Phase17.
**Specified/planned; complete procurement and production contexts are not present and
no prerequisite completion is implied.**

### YC-15 — Partial supplier delivery with price deviation

**Actors.** Department requester, buyer, receiving clerk, stores manager, purchase
manager and accounts payable.

**Precondition.** Synthetic PO 88017 orders 100 bottles for one cost centre. Eighty
arrive at a different unit cost with a delivery note and supplier invoice.

**Guest promise.** Indirect: the hotel maintains supply without hiding shortages or
charging from an unapproved, duplicated or misallocated receipt.

**Handoff/version.** Receiving creates `receipt/v1` against PO 88017 with vendor,
delivery/receipt reference, item/UOM, ordered, received and outstanding quantities,
received cost, cost centre, receiver and deviation. Purchase manager or AP acknowledges
the exact receipt/invoice-match version.

**Exception and recovery.** Configured tolerance determines whether a reason or approval
is required. The remaining 20 stay open unless an authorized actor closes the PO. A
duplicate receipt request returns the prior receipt. Invoice mismatch stays pending with
an owner; it does not silently alter received stock.

**Observable acceptance.** Receiver sees ordered versus actual quantity and cost;
wrong-cost-centre or wrong-role actions fail; required deviation reason is enforced by
current policy; booking updates stock once; PO close is separate and explicit; invoice
state is `matched`, `within tolerance`, `exception` or another configured value; and
mobile receiving supports scan/manual entry without hiding confirmation totals.

**Business-policy questions.** What are quantity/price tolerances, approval thresholds,
UOM rules, receiving-as-invoice behavior, PO close rules and segregation of duties?
Supplier, tax and AP handling must be separately configured.

**Phase dependencies and capability truth.** Accounting effects are Phase5 scope;
applicable tax/fiscal treatment is Phase7; an eventual staff surface is Phase10; and
event/outlet demand may originate in Phase17. Full inventory-procurement ERP edges are
parked post-v1 in the build plan. **Design-only and planned/post-v1; no prerequisite
completion or Yellow PO, receiving, stock or AP implementation is claimed.**

### YC-16 — Night audit with four cross-department blockers

**Actors.** Night auditor, event coordinator, outlet manager, cashier and AR clerk;
authorized finance manager for any carry or correction.

**Precondition.** Close readiness contains one partially posted event, one outlet
timeout, one unclosed cashier and one direct-bill invoice awaiting transfer.

**Guest promise.** The hotel can explain and settle guest/company balances from durable
evidence. The business day is not shown as clean while unresolved financial effects are
hidden.

**Handoff/version.** Finance publishes `close-readiness/v7` with property, business
date, as-of time, each blocker, financial impact, source, owner and evidence. Each
department acknowledges and resolves its item or an authorized actor records a permitted
carry against that exact snapshot.

**Exception and recovery.** Resolving one blocker does not clear the others. Unknown
outlet outcome is reconciled before retry; event actualization and posting are distinct;
cashier closure audits the shift; direct-bill transfer requires the right AR account.
Seal requires a fresh complete readiness decision.

**Observable acceptance.** The queue preserves all four source types and owners;
partial success updates only the resolved item; stale readiness cannot seal; wrong-role
carry/seal fails; source links open with minimized context; retries are idempotent; the
seal receipt identifies actor and business date; and a late correction uses the current
authorized correction path rather than silently entering the sealed day.

**Business-policy questions.** Which blockers are seal-blocking, which may be carried,
who owns escalation, is AR transfer automatic or manual, and what evidence is required?
Those controls must be property-specific without weakening Yellow's business-date and
append-only financial invariants.

**Phase dependencies and capability truth.** Business-day, cashier, posting/correction
and bounded direct-billing foundations are Phase5 scope; applicable tax/fiscal treatment
is Phase7; the joined workbench is Phase10; full AR is Phase12; and event/outlet sources
are Phase17. **Relevant finance foundations are located; full AR and the mixed Phase17
queue remain planned and must not be shown as live capability.**

## Case coverage matrix

This is a design coverage map, not a test-results table. A mark means the branch must be
included when the case becomes a prototype script or executable acceptance fixture.

| Case | Main / happy path | Retry / recovery | Stale / superseded | Wrong role | Partial / unknown | Narrow mobile | Keyboard / focus | Privacy minimization |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| YC-01 early arrival | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| YC-02 room discrepancy | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| YC-03 AC failure / room move | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| YC-04 airport pickup | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| YC-05 DND maintenance | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| YC-06 lost key | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| YC-07 midnight open day | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| YC-08 STR late checkout | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| YC-09 wedding revision | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| YC-10 corporate split payer | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| YC-11 outlet timeout | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| YC-12 sealed correction | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| YC-13 couples spa | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| YC-14 banquet shortage | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| YC-15 partial PO receipt | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| YC-16 night audit blockers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

The eventual risk-based test matrix should also cross at least one suitable case with
loading, empty state, validation failure, dirty-draft exit, permission denial, duplicate
submission, provider outage, RTL, zoom, reduced motion and two-tenant hostility. It need
not force every permutation through every case; it must name the risk basis for selected
pairs and retain targeted high-risk combinations.

## Staff walkthrough plans

The facilitator must say that records and integrations are simulated before starting.
Do not present prototype clicks as domain receipts or use participants to estimate
production performance from a static fixture. The two plans below use only the 14
illustrated prototype cases. Run `YC-07` and `YC-12` later as authenticated domain
walkthroughs after their required commands and failure evidence exist.

### 30-minute focused walkthrough

| Time | Activity | Cases | Evidence to collect |
|---|---|---|---|
| 0–3 min | Explain synthetic status, role, property, business date and think-aloud method. | All | Participant's initial reading of scope and current context. |
| 3–10 min | Triage an arrival blocker, inspect readiness evidence and hand work to housekeeping. Inject a superseding estimate. | YC-01 | First selected action, context consulted, version noticed, handoff/ack interpretation and recovery path. |
| 10–16 min | Resolve the vacant/occupied report without releasing occupancy. Try a role that lacks resolution authority. | YC-02 | Whether physical and PMS facts stay distinct, unsafe action attempts, denial comprehension and escalation route. |
| 16–23 min | Find the unacknowledged late-night pickup, retry safely and prepare truthful guest communication. | YC-04 | Detection time, status interpretation, owner selection, duplicate-risk understanding and wording chosen. |
| 23–28 min | Review the mixed close-preparation queue and identify why opening or rolling work is not seal evidence. | YC-16 | Business-date comprehension, blocker discovery, stale-snapshot detection and chosen next owner. |
| 28–30 min | Debrief and capture unresolved questions. | All used | Confidence rationale, missing context, terminology conflicts and requested shortcut. |

### 60-minute cross-department walkthrough

| Time | Activity | Cases | Evidence to collect |
|---|---|---|---|
| 0–5 min | Explain synthetic status; assign participant role/property; establish keyboard or mobile condition for one segment. | All | Context comprehension and navigation starting point. |
| 5–15 min | Manage early arrival and an engineering room-move escalation with DND. | YC-01, YC-03 | Hard-constraint use, handoff version/ack, permission boundary and guest-promise wording. |
| 15–23 min | Investigate discrepancy and replacement-key requests without releasing occupancy or overexposing identity. | YC-02, YC-06 | Unsafe-action avoidance, identity resolution, privacy choices and recovery route. |
| 23–34 min | Receive a late wedding revision, reject an infeasible resource quantity and acknowledge the revised BEO. | YC-09, YC-14 | Delta discovery, affected-team recognition, owner/deadline selection and superseded-version handling. |
| 34–43 min | Post an ambiguous outlet charge, inject a timeout and retry with the same request identity. | YC-11 | Exact-target selection, unknown-versus-success interpretation, retry identity and unresolved-owner comprehension. |
| 43–50 min | Resolve a couples spa resource/form exception and payer choice. | YC-13 | Resource conflict detection, form-status privacy, guest/host selection and unresolved-payment treatment. |
| 50–56 min | Close the shift from the mixed exception queue without treating partial resolution as readiness. | YC-16 | Source/owner discovery, close impact, roll/seal distinction and permission response. |
| 56–60 min | Debrief, rank remaining ambiguities and compare desktop/mobile or pointer/keyboard experience. | All used | Terminology, missing evidence, navigation cost, confidence rationale and accessibility obstacles. |

### Measures and recording definitions

No target, benchmark or result is asserted here. For each walkthrough, record the raw
observation and method so later teams can set thresholds only after evidence exists.

| Measure | Definition |
|---|---|
| Scenario completion | Whether the participant reaches the stated safe end condition; record completed, completed with facilitator help, stopped safely, or unsafe/incorrect. |
| Time on scenario | Elapsed time from the facilitator's trigger to safe completion or stop, including injected exception time; report the observed value only. |
| First-action fit | The participant's first meaningful action and whether it advances, is neutral, or conflicts with the case's authorized path. |
| Context discovery | Which required facts the participant finds, misses or misreads before deciding: property, role, business date, version, owner, deadline, target and evidence. |
| Handoff comprehension | Whether the participant distinguishes prepared, delivered, acknowledged, rejected, completed and superseded; capture their explanation. |
| Stale-change detection | Whether and when the participant notices that the accepted source version changed, plus the evidence that caused recognition. |
| Exception recovery | Steps, backtracks and help needed to move from denial, timeout, conflict or missing acknowledgement to a safe owned state. |
| Authority comprehension | Whether a permission denial explains why the action is unavailable and identifies an authorized handoff without disclosing hidden data. |
| Duplicate-risk comprehension | Whether the participant expects retry to reuse the same request identity and can locate the prior/returned receipt. |
| Guest-promise accuracy | Whether proposed guest communication matches recorded status and avoids upgrading requested, estimated, sent or unknown into confirmed or completed. |
| Privacy exposure | Any personal, financial, form, room or commercial detail shown or requested beyond what the participant's role and task need. |
| Navigation cost | Count of meaningful navigation changes, reversals and lost-context events; record device width and input method. |
| Focus/accessibility continuity | Whether focus remains visible and logical, controls are named, status is not color-only, and the task remains possible with the tested keyboard, zoom, RTL or reduced-motion condition. |
| Confidence rationale | Participant's stated confidence and the evidence they cite; do not reduce this to an unsupported performance claim. |

Record participant role, hospitality experience band, device/viewport, input method,
case version, facilitator prompts and any prototype defect alongside these measures.
Keep qualitative findings distinct from product telemetry and field performance.
