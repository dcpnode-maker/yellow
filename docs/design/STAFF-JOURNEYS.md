# Staff journeys: hotel and STR

**Status:** specified under Order433, not a claim of implemented UI · 2026-09-05.
Requirements: [YF-002–015](../FEATURE-REGISTER.md). Research:
[PMS/STR benchmark](../research/STAFF-STR-ECOSYSTEM-2026-09.md).

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
