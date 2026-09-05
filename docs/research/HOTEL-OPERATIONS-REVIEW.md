# Astra review: the hotel as a coordinated service

**2026-09-05 · Order440 · Original research synthesis for the Codex Yellow task.**
Read with the [staff journeys](../design/STAFF-JOURNEYS.md),
[16 synthetic case studies](../design/HOTEL-CASEBOOK.md),
[workbench specification](../design/STAFF-WORKBENCH-SPEC.md) and
[schema guide](../SCHEMA-GUIDE.md).

## Finding

Yellow's next interface should organize work around the guest promise and the next
accountable action. A department menu alone cannot do this. The valuable unit is an
owned request with current context, a receiving team's acknowledgement, an exception
path and a receipt. FO can then coordinate a guest without pretending to perform
housekeeping, repair work, kitchen production or financial reconciliation itself.

The existing TypeScript/Bun/PostgreSQL core already supplies important foundations:
governed occupancy, reservations, room operations, immutable finance, authorization,
business dates and transactional outbox. Keep those boundaries. Build the new
experience as an adapter to authorized queries and commands; do not make the screen,
a chat transcript or an AI prediction a second source of operational truth.

This conclusion combines repository evidence and independent reading of official
hospitality workflow documentation. It is a design hypothesis to validate with hotel
staff, not a claim from field interviews. No real hotel, employee or guest was observed.
All case studies and prototype records are explicitly fictional.

## What the research changed

| Finding | Evidence | Yellow design implication | Confidence and limit |
|---|---|---|---|
| Cleaning condition, occupancy observation and guest service preference can disagree | OPERA documents distinct housekeeping and discrepancy controls | Keep these facts separate and derive arrival readiness from current authorized evidence | High that these distinctions exist; each property's inspection and restriction policy still needs configuration |
| Guest-name visibility on a housekeeping board is separately permissioned | OPERA's housekeeping board documents role-controlled reservation information | HK and engineering get room/task context; a shared task must not carry the whole guest profile | High for the source feature; Yellow must prove its own minimized API payloads |
| A contract record is not the live inventory claim | OPERA's block contract grid is distinct from its allocation grids | Show contract, deducting allocation and pickup separately; never force a universal contract-before-block sequence | High for this source distinction; status effects remain Yellow configuration |
| Events need operational resources and change history | OPERA documents menus/items, departments, setup/teardown and event changes | BEO is a versioned brief; affected departments acknowledge the revision, and actual delivery is separately recorded | High for documented resources/history; exact per-department acknowledgement is our proposed Yellow requirement |
| Outlet posting can be accepted, denied or uncertain | Simphony documents PMS posting and timeout/error responses | Keep an ambiguous check unsettled; reconcile/retry the original identity; choose the exact account | High for the failure modes; provider contracts and certification remain future work |
| Spa work is a resource and prerequisite journey, not just an appointment card | Zenoti documents provider, room/equipment, forms and hotel posting workflows | Schedule constrained resources, show prerequisite status with restricted detail, separate fulfilment and settlement | High for documented features; local service/medical eligibility is outside this review |
| Partial delivery and receiving approval are real work | Oracle inventory documentation covers PO receipts, deviations and user rights | Keep ordered, delivered and outstanding quantities distinct; booked stock receipt and invoice processing are separate | High for documented workflow; matching tolerances and stock architecture need a later bounded order |
| Shift handover needs active receiving participation | HSE recommends two-way handover with written and verbal communication | Incoming staff acknowledge important open work; a broadcast or unread note cannot count as accepted ownership | Supported operational pattern from a safety context, not a measured hospitality result |

Sources supporting these observations: [housekeeping board](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.2/ocsuh/t_housekeeping_using_the_housekeeping_board.htm),
[block grids](https://docs.oracle.com/en/industries/hospitality/opera-cloud/23.4/ocsuh/t_blocks_managing_room_and_rate_grid.htm),
[event resources](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.3/ocsuh/ch_osem_about_event_resources.htm),
[event changes](https://docs.oracle.com/en/industries/hospitality/opera-cloud/23.1/ocsuh/t_viewing_the_events_changes_log.htm),
[PMS interface requirements](https://docs.oracle.com/en/industries/food-beverage/simphony/19.7/spmsa/G11054_01.pdf),
[POS error messages](https://docs.oracle.com/en/industries/food-beverage/simphony/19.8/sipou/c_error_messages.htm),
[spa booking](https://help.zenoti.com/en/appointments/daily-tasks/book-appointments/book-appointments-using-appointment-info-panel.html),
[spa hotel integration](https://help.zenoti.com/en/integrations/opera-on-premise.html),
[PO receipt](https://docs.oracle.com/cd/E80526_01/doc.91/e86244/t_receiving_create_receipt_using_existing_po.htm),
[shift handover](https://www.hse.gov.uk/humanfactors/topics/shift-handover.htm).

## Original design conclusions

### 1. One coordinator for the guest; separate owners for the work

For an early arrival, FO owns the guest update. HK owns preparation and inspection;
engineering owns any fault; bell desk owns luggage. Their work must remain separate
while the reservation context connects it. The visible interface should answer
“Who has it now?” and “When is the next update?” without implying that the sender's
responsibility to communicate has disappeared.

Use explicit states for requested, delivered, acknowledged, in progress, blocked,
resolved and followed up. These are a proposed coordination vocabulary, not a newly
authorized database enum. Adapt the owning domain's actual state machine rather than
forcing all departmental work into one generic task table.

### 2. Do not compress different facts into a reassuring colour

“Clean,” “inspected,” “vacant,” “assignable,” “payment ready” and “checked in” answer
different questions. A useful arrival panel shows the unresolved requirement and
its evidence time. Estimates stay labelled estimates. A completed task is not an
occupancy command, a payment receipt or an invoice.

The same rule applies outside rooms: forecast, guaranteed, actual and billed covers;
ordered, delivered and invoiced quantities; appointment completion and settlement;
business-day roll and seal. A beautiful card that collapses these distinctions would
make the product less reliable.

### 3. Put changes beside the work they affect

A wedding revision from 80 to 95 guests should show the delta to the banquet captain,
kitchen and stores. The unchanged AV instruction need not create another interruption.
Acknowledgements must name the version. An older accepted brief remains evidence,
but cannot appear current. Client-facing terms and internal department instructions
need different disclosure rules.

The contract grid, event resources and posting master remain separate operational
objects. Oracle documents event posting as a separate workflow with its own target
requirements; Yellow should preserve the separation between fulfilment, billing and
legal invoice issuance. [Event posting](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.4/ocsuh/t_osem_managing_event_posting.htm)

### 4. Design the uncertain result before the success animation

The restaurant cashier must know whether a charge was accepted, denied or still
unknown. A retry must carry the original request identity. The user needs the original
check, exact payer/folio, amount/currency and reconciliation owner, not a generic
“Something went wrong.” This is also the model for booking retries, delayed task
delivery and stale readiness. Never offer blind resubmission as the only recovery.

### 5. Mobile is a different work arrangement

A receptionist benefits from a queue beside reservation context; a room attendant
benefits from one task with a clear return to the queue. Both use the same underlying
authorized capability. Keep the object and focus stable when changing department,
opening detail or returning to a filtered list. Use text and semantics as well as
colour; status changes should be announced without moving focus unpredictably.

The design targets labelled controls, visible keyboard focus, meaningful ordering,
larger touch actions and reduced motion. WCAG 2.2's minimum target criterion is
24 CSS pixels with stated exceptions; Yellow's primary frontline actions target
44–48 pixels. This study does not claim complete WCAG certification.
[W3C target sizes](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html),
[W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

### 6. AI should explain and prepare, then use the same command

An assistant can summarize unresolved work, suggest a permitted next action and draft
a guest update. It must identify sources, freshness and ambiguity. It must not infer
that a room is vacant, waive an inspection, issue a key, change a payer, approve its
own financial action or invent a confirmed flight status. Text, voice and manual UI
converge on the same bounded server commands and receipts.

## What should be built, in what order

| Slice | Deliverable | Existing foundation | Required proof before a production claim |
|---|---|---|---|
| Arrival coordination | Queue → selected reservation → HK request/acknowledgement → inspection evidence → fresh arrival decision | Arrival rolls, room assignment, arrival cleaning, HK tasks and check-in readiness | Real authenticated two-role journey, stale/duplicate/permission hostility and actual domain receipts |
| Shift continuation | Owned unresolved items and incoming acknowledgement, with distinct business dates | Task/fact/outbox and business-day foundations | Delivery failure, duplicate event, role change and midnight tests; no accidental seal |
| Departure and outlet exception | Checkout context, late service observations, exact payer and uncertain-posting recovery | Checkout, folios, cashiers, approvals and immutable financials | Real posting/reversal/reconciliation cases with sealed-day and cross-tenant denial |
| Groups and event operations | Contract/allocation/pickup → BEO revisions → affected-team acknowledgement → actuals | Phase11 planned group completion plus governed occupancy and finance | Resource contention, changed-version replay and actualization-to-billing reconciliation |
| Spa and stores | Resource schedule/prerequisites and controlled receiving | Existing inventory/financial primitives; specialist workflows remain planned | Conflict, privacy, receipt idempotency and exact financial integration |

This sequence describes reusable UX slices, not a phase override. Preserve the
18-phase plan and dependency-constrained priority **11 → 13 → 17**. Cross-department
research can happen now while the active engineering phase remains 7.

## Review limits and next evidence

This is desk research using public official product documentation and the Yellow
repository, supported by internally delegated research and independent review.
Source versions differ; a vendor's configurable feature is not a universal hotel
rule and no vendor implementation has been copied. We have not interviewed operators,
observed a shift, measured task times in a hotel or verified external providers.

The [casebook](../design/HOTEL-CASEBOOK.md) defines 30/60-minute walkthroughs and
observable measures. Record task completion, wrong-target attempts, abandoned work,
handoff acknowledgement latency, exception recovery and staff comprehension using
fictional fixtures. Set operational targets after baseline measurement with the
property; do not invent a percentage improvement or claim that a prototype saves
staff time before testing it.

The separate [schema guide](../SCHEMA-GUIDE.md) addresses the GitHub setup issue:
80 is the immutable first migration, 125 is the historical main5879e2b7 catalogue,
and 127 is the reviewed main443e3826 catalogue after PR83 at the recorded frontier. A table count measures
schema objects, not completed guest journeys or hospitality departments.
