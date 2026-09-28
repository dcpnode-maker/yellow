# Hospitality Edge-Case Corpus

**Research date:** 2026-08-21
**Purpose:** A design and test input, not a claim of implemented behavior or legal
compliance.

This corpus combines current official/public documentation with Yellow's existing
research and executable invariants. It summarizes patterns in original language; it does
not reproduce proprietary source code or long proprietary text.

## How to use this corpus

Every implementation order should select the relevant cases and turn them into:

1. explicit command guards and state transitions;
2. transaction/concurrency tests;
3. authorization and tenant-isolation tests;
4. failure/retry/reconciliation tests;
5. user-visible explanations and recovery actions.

A case is not “supported” because it appears here.

## Reservation creation, delivery, and change

| Edge case | Required design/test consequence |
|---|---|
| The last sellable unit is committed concurrently by direct, OTA, and staff channels | One PostgreSQL arbitration path; exactly one compatible winner; channel-specific retries cannot bypass it |
| A channel retries an unacknowledged new booking | Idempotency on provider message identity; acknowledgement only after durable local commit |
| A modification arrives before the original message is acknowledged | Correlate all provider identifiers/tokens; do not create a second booking |
| A modification arrives after check-in | Treat as a conflict requiring explicit in-house change semantics, not a blind reservation overwrite |
| A cancellation arrives after a local room move or extension | Reconcile provider scope against local segments and financial state; preserve both histories |
| Multi-room booking partially cancels | Cancel only affected room/stay components; recompute occupancy, policies, deposits, commissions, and communication |
| Stay dates change while date-bounded routing/fixed charges exist | Surface dependent policies and routing for revalidation before commit |
| Arrival date change is requested after check-in | Reject or model as a different command; never rewrite historical arrival |
| Extension loses the currently occupied room partway through | Offer a split stay/new segment and price it; do not silently overbook |
| Shortening crosses a cancellation/early-departure penalty boundary | Quote consequences before commit and record policy version/evidence |
| Booking is reinstated but its old room is now assigned | Re-arbitrate inventory; offer alternate assignment; never restore occupancy by status alone |
| Duplicate guest, booking, or payment details differ on retry | Compare canonical request hash; same key/different payload is a conflict |
| Day-use booking overlaps same-calendar-date arrivals | Use instants/half-open periods, not date-only collision logic |
| Back-to-back reservations should keep the same room | Suggest continuity but preserve housekeeping/maintenance and do-not-move constraints |
| Guest count/children ages change after booking | Re-evaluate capacity, rate, taxes, meal plan, policies, and statutory data |
| Rate plan becomes unavailable after hold but before commit | Define what the hold guarantees: inventory only or inventory+price/policy version |
| Waitlist offer expires while guest is paying | Expiry and payment authorization must have a deterministic winner/compensation path |
| Walk-in is created during network degradation | Consume only a server-issued offline lease; financial capture remains queued/restricted by policy |

Booking.com's official delivery model repeatedly returns bookings until acknowledgement
and explicitly warns receivers to avoid duplicates. It also documents modifications after
check-in and changed identifiers before acknowledgement:
[Reservations API overview](https://developers.booking.com/connectivity/docs/reservations-api/reservations-overview),
[modified/cancelled retrieval](https://developers.booking.com/connectivity/docs/reservations-api/retrieving-modifcancel-reservations-ota),
[reservation FAQ](https://developers.booking.com/connectivity/docs/con-faq-reservations-general-information).

## Room assignment, moves, shares, and physical occupancy

| Edge case | Required design/test consequence |
|---|---|
| Destination room is out of order | Hard block unless the OOO interval is closed by an authorized command |
| Destination is dirty but user has a dirty-room override | Require specific permission, reason, warning, and housekeeping dependency |
| Destination room is occupied by a compatible sharer | Create explicit share occupancy and guest/folio rules; never imply sharing from assignment alone |
| Only one sharer moves | Preserve remaining sharers and independent folios; split physical occupancy correctly |
| Moving to a different room type is a complimentary upgrade | Keep “room type occupied” separate from “room type charged” |
| Moving guest has active keys/interfaces | Revoke/reissue keys and notify connected systems idempotently |
| Departing room status after move varies by property policy | Apply configured default; override requires permission/reason |
| Two agents move two guests into the same destination concurrently | Choke point decides; loser gets a current conflict and alternatives |
| Reservation is marked do-not-move | Block automated/manual reassignment except explicit override |
| Swap/shift involves unequal dates or room types | Requote/revalidate; do not treat drag-and-drop as authority |
| Dorm is sold privately while beds are occupied | Claim-range constraint rejects incompatible exclusive claim |
| Two beds in the same dorm are assigned the same position | Positional claim uniqueness under concurrency |
| Room moves at business-date boundary | Previous/new segment and charges use property-local time and explicit cutover |
| Accessible-room preference conflicts with operational optimization | Accessibility requirement outranks convenience/upgrade economics; record reason |

Oracle's current OPERA Cloud docs demonstrate that room moves couple availability,
housekeeping state, shares, rate-to-charge, integration events, departing-room condition,
keys, and move history:
[in-house room move](https://docs.oracle.com/en/industries/hospitality/opera-cloud/23.2/ocsuh/t_arrivals_in-house_moving_an_in_house_reservation.htm).
The room diary also exposes date-change dependencies, swaps/shifts, shares, do-not-move,
and OOO checks:
[room diary](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.5/ocsuh/t_booking_reservations_creating_a_room_diary.htm).

## Arrival, check-in, stay, and departure

| Edge case | Required design/test consequence |
|---|---|
| Identity is complete but room is not ready | Show dependency state; queue guest; prioritize housekeeping; do not fake check-in |
| Room is ready but guarantee/deposit is missing | Expose financial blocker and permitted override/approval path |
| Statutory field is required only in one jurisdiction | Property policy module gates that property only |
| Advance check-in before physical occupancy | Separate registration/readiness from occupancy and key issuance |
| Companion arrives before primary guest | Define authorization, identity, payment, and room-access policy |
| Early arrival changes chargeable stay | Quote early-arrival fee/day-use segment and tax effect |
| Late checkout conflicts with next arrival | Re-arbitrate occupancy and housekeeping SLA; offer move/fee/denial |
| Guest extends while payment preauthorization is insufficient | Incremental authorization or approved alternative before extension commit |
| Guest abandons room but has not checked out | Housekeeping “skip” discrepancy triggers investigation, not automatic checkout |
| Housekeeping finds an occupant in a front-office vacant room | “Sleep” discrepancy; restrict assignment and escalate security/front desk |
| Occupant count differs | Person discrepancy; reconcile guest records, capacity, taxes, and safety data |
| Checkout has multiple folio windows | Every required window settles/transfers independently before final state |
| Checkout retains open post-stay folio | Separate physical departure from financial account lifecycle with explicit policy |
| Express checkout payment later fails | Reopen operational exception, not historical occupancy; preserve failed settlement event |
| Guest checks out while OTA sends shortening | Deduplicate/reconcile against local departure; avoid double refund/penalty |
| Property loses internet during check-in | Permit only locally verifiable low-risk operations; queue actions with conflict-aware sync |

Oracle documents zero-balance-across-windows checkout and housekeeping sleep/skip/person
discrepancies:
[checkout](https://docs.oracle.com/en/industries/hospitality/opera-cloud/24.2/ocsuh/t_checking_out_reservations.htm),
[room discrepancies](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.2/ocsuh/t_housekeeping_viewing_room_discrepancies.htm).

## Housekeeping and maintenance

| Edge case | Required design/test consequence |
|---|---|
| Checkout room has imminent VIP arrival | Dynamic priority uses ETA/VIP/scarcity/SLA, with reason visible |
| DND prevents service repeatedly | Record attempts, policy escalation, welfare/security boundary, and guest preference |
| Inspection fails after room marked clean | Transition back to dirty/reclean task; preserve who inspected and why |
| Maintenance issue discovered during cleaning | Link task/work order/asset; decide OOS vs OOO; propagate sellability impact |
| Work order closes but room remains unsafe | Closing maintenance does not automatically restore inventory without inspection/authorization |
| Preventive maintenance overlaps an occupied stay | Schedule around stay or create guest-relocation workflow |
| Attendant goes offline and two supervisors reassign task | Versioned task ownership and sync conflict handling |
| Minibar charge captured twice on sync | Idempotency key tied to visit/room/item capture |
| Lost-and-found item may contain PII/controlled material | Restricted evidence, custody, retention, release verification |
| Linen/amenity shortage changes room readiness | Dependency graph distinguishes clean from truly ready |
| OOO room is manually assigned | Permission alone is insufficient; OOO must be resolved or explicitly compensated through a governed path |
| Asset failure affects multiple sellable spaces | Explicit asset-to-space relationships drive scoped inventory impact |

## Groups, blocks, sales, and events

| Edge case | Required design/test consequence |
|---|---|
| Block is inquiry/tentative and should not deduct | Deduction is status configuration, not hard-coded label |
| Status changes from non-deduct to deduct with insufficient house inventory | Atomic conflict, alternatives, and displacement review |
| Cutoff date passes with unpicked rooms | Idempotent release job; preserve contracted vs blocked vs picked-up history |
| Staged wash releases different quantities by date/type | Effective-dated wash schedule and event evidence |
| Elastic block picks up beyond allotment | Consume house inventory under explicit sell-limit rules |
| Rooming-list import contains duplicates/errors | Preview, stable row identity, partial-error report, atomicity policy, replay safety |
| One group member cancels | Release only member occupancy; update pickup, routing, deposits, and group bill |
| Master folio routing overlaps member routing | Detect conflicting transaction-code/date rules before posting |
| Group dates change after rooming list | Revalidate every reservation, allotment, rate, routing, function space, and document |
| Function-space setup/teardown overlaps another event | Occupancy-like buffered interval arbitration |
| Group guarantee is insufficient | Credit/approval workflow; do not silently confirm deducting inventory |
| Attrition/cancellation terms change after signature | Version contract terms and require authorization; preserve previous terms |

Oracle's block controls distinguish deduct status, automatic/manual cutoff, wash,
elastic pickup, sell limits, and rooming-list import:
[block controls](https://docs.oracle.com/en/industries/hospitality/opera-cloud/26.2/ocsuh/c_opera_controls_blocks.htm).

## Rates, availability, revenue, and Comp Advantage

| Edge case | Required design/test consequence |
|---|---|
| Multiple rate rules overlap | Deterministic precedence with rule/version evidence |
| Derived parent rate changes after a child override | Preserve explicit override and recompute only derived portions |
| Closed-to-arrival/min-stay changes after booking | Existing booking remains auditable; modifications re-evaluate current or contracted policy explicitly |
| Competitor observation is stale or from a weak source | Store source, observation time, freshness, legality, confidence; never present as current fact |
| Competitor sold out | Distinguish unavailable from unknown/scrape failure; avoid treating missing price as zero/infinite |
| Recommended increase breaches floor/ceiling or brand promise | Deterministic policy rejects or routes for approval |
| Recommendation spans room/date/channel with different costs | Optimize net contribution and displacement, not headline ADR |
| Group request displaces higher-rated transient demand | Compare expected group contribution, ancillary revenue, wash, and risk |
| Overbooking recommendation meets a no-show forecast | Policy limits physical exposure and recovery cost; human approval at configured autonomy |
| Event signal is later cancelled | Recompute recommendations and retain causal outcome history |
| Rate change publishes to some channels but not others | Canonical state remains truth; surface divergence and reconcile/replay |
| Tax-inclusive display and commission basis differ by channel | Separate gross, net, tax, fee, and commission calculations |
| Cancellation boundary carries an authoritative timezone offset | Store/evaluate the supplied offset; do not recalculate from guessed geography |
| Automated recommendation performs poorly | Link actual pickup/ADR/net outcome back to the exact evidence/model/rule version |

Expedia documents cancellation windows with authoritative ISO-8601 offsets and separate
non-refundable date ranges:
[cancellation policies](https://developers.expediagroup.com/rapid/lodging/shopping/constructing-cancellation-policies).
Its hard-change API treats date, room type, and occupancy changes as repriced operations:
[hard changes](https://developers.expediagroup.com/rapid/lodging/manage-booking/hard-change).

## Distribution and channel operations

| Edge case | Required design/test consequence |
|---|---|
| Provider retries because local response timed out after commit | Idempotent ingest returns prior acknowledgement |
| Provider sequence blocks later modification until previous acknowledgement | Commit and acknowledge in order; expose queue age |
| Provider falls back to email after repeated failure | Mark channel automation gap; require manual reconciliation; later API changes may not arrive |
| Confirmed OTA booking arrives when local inventory appears full | Booking cannot simply be rejected; create high-priority overbooking incident and reconcile ARI |
| Mapping is removed while messages are in flight | Version mappings and retain historical resolver |
| Room/rate map points to retired canonical entity | Quarantine message with actionable repair, never guess |
| Partial ARI burst succeeds | Per-provider cursor and reconciliation converge without corrupting canonical state |
| Out-of-order modification/cancellation | Provider version/sequence rules and current-local comparison |
| Duplicate external identifier appears across properties | Provider+property+external-id uniqueness |
| Channel sends unknown enum/new field | Preserve raw envelope, reject/ignore according to version policy, alert compatibility |
| Provider outage exceeds retry budget | Dead-letter with replay; canonical operation continues |
| Currency/rounding differs | Store provider amounts/currency and reconcile explicitly |
| Last-room availability is cached externally | Canonical commit still arbitrates; ARI lag is measured and incidentized |

Expedia describes provider-side sequencing, retries, email fallback, and the fact that
confirmed notifications cannot be rejected for inventory reasons:
[Booking Notification API](https://developers.expediagroup.com/supply/lodging/docs/booking_apis/booking_notification/getting_started/introduction/).
Its manage-booking API distinguishes held, current, changed, and cancelled itinerary
operations:
[Manage Booking](https://developers.expediagroup.com/rapid/lodging/manage-booking/about-mg-booking-api).

## Folio, ledger, business date, and night audit

| Edge case | Required design/test consequence |
|---|---|
| Unbalanced journal has individually valid lines | Deferred commit-time balance rejection |
| Correction targets a sealed business day | New adjustment/correction journal; original remains |
| User attempts to delete/overwrite a posted charge | Permission cannot bypass immutability |
| Transfer spans folio windows | Balanced journal with traceable source/destination; no row reassignment |
| Package allowance is consumed partly and stay shortens | Recompute future entitlement; compensate already posted activity explicitly |
| Inclusive tax rounding differs line vs document | Jurisdiction/version-specific rule and golden files |
| Multiple currencies appear in one transaction | Separate single-currency journals plus explicit FX gain/loss |
| Cashier closes with over/short | Record counted vs expected, approval/escalation, immutable journal |
| Guest departs with balance transferred to AR | Permission/credit/account checks and explicit transfer; physical checkout remains clear |
| Day rolls while previous day remains unsealed | Operations use new open property-local date; backlog remains visible |
| Arrival not checked in/departure not checked out at close | Exception workflow offers check-in, no-show, extension, checkout, or approved carry-forward |
| Open cashier or interface queue blocks seal | Readiness explains exact owner/action; seal remains deterministic |
| Close job retries | Duplicate room/tax charges are impossible through idempotent posting keys |
| Late interface charge arrives after seal | Adjustment path with original service date and current posting authority |
| Folio document is issued, then correction required | Credit/debit/correction document according to jurisdiction; no renumber/edit |

Oracle's end-of-day documentation lists unresolved arrivals/departures, open folios,
cashier closure, business-date update, and duplicate-charge prevention as coupled close
concerns:
[end of day](https://docs.oracle.com/en/industries/hospitality/opera-cloud/23.2/ocsuh/c_endofday_procedures.htm).
Yellow intentionally uses continuous roll plus controlled asynchronous seal, but must
retain these exception semantics.

## Payments, deposits, refunds, and disputes

| Edge case | Required design/test consequence |
|---|---|
| Payment callback is delivered twice | Provider-event idempotency; exactly one settlement/journal effect |
| Authorization succeeds but local commit fails | Reconciliation/void or compensation; never invent captured state |
| Local timeout occurs but provider captured | Query/reconcile provider before retrying charge |
| Incremental authorization is partially approved | Explain remaining exposure and policy action |
| Virtual card activates only on arrival/departure date | Schedule/attempt within provider window; surface invalid timing |
| Partial refund follows split tender | Allocate refund by original instruments/provider constraints |
| Charge was partially refunded, then disputed for full amount | Track gross dispute independently from refund; accounting handles overlap |
| FX changed between charge and dispute | Record settlement and dispute currencies/rates; explicit FX journal |
| Deposit is transferred from one reservation to another | Authorization, traceable transfer, tax/receipt consequences |
| No-show penalty exceeds authorized amount | Attempt permitted capture; remaining balance becomes exception/AR, not success |
| Card data is accidentally posted to a normal API field/log | Reject/redact at boundary; never persist or send to AI |
| Hosted payment page integrity is compromised | CSP/SRI/dependency monitoring and PSP redirect verification still matter |
| Refund succeeds at PSP but notification fails | Reconciliation eventually records immutable refund and journal |
| Cash payment is reversed after cashier close | Approved adjustment in current open day |

PCI SSC states that SAQ A eligibility requires outsourced payment handling and that
redirect/iFrame integrity remains in scope:
[SAQ A FAQ](https://www.pcisecuritystandards.org/faqs/1439/),
[redirect/iFrame versus Direct Post](https://www.pcisecuritystandards.org/faqs/1291/).
Stripe documents partial disputes, partial refunds, and FX differences as distinct
real-world dispute cases:
[dispute lifecycle](https://docs.stripe.com/disputes/how-disputes-work?locale=en-GB).

## Guest identity, privacy, communication, and service

| Edge case | Required design/test consequence |
|---|---|
| Same name/phone belongs to different people | Merge suggestions require evidence and human confirmation |
| Same person has channel-specific aliases | Link identities with source/confidence; preserve original records |
| Merge would combine two active stays | Conflict review; reversible merge record and permission |
| Erasure request includes financial/statutory history | Anonymize permissible identity while retaining legally required records |
| Consent is withdrawn mid-campaign | Stop future processing; retain proof of lawful prior actions |
| Guest asks on WhatsApp about another guest's stay | Authenticate/authorize before disclosure; channel identity is not enough |
| OTA message cannot be delivered back through API | Fallback channel and explicit delivery status |
| AI draft invents amenity/policy | Retrieve property knowledge with evidence; human/configured approval |
| Translation changes legal cancellation meaning | Approved templates/policy text, locale version, human escalation |
| Complaint becomes safety incident | Restricted incident visibility, evidence preservation, escalation SLA |
| Child/minor identity and consent | Jurisdictional handling and data minimization |
| Passport/ID retention period expires | Scheduled deletion/anonymization with legal-hold exception |
| Guest preference conflicts with accessibility/safety | Explain and prioritize legal/safety constraints |
| Multiple conversations refer to one reservation | Link without collapsing channel history or sender identity |

GDPR Article 5 requires purpose limitation, data minimization, accuracy, storage
limitation, and security:
[Regulation (EU) 2016/679](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679).

## STR, owner, and property-manager operations

| Edge case | Required design/test consequence |
|---|---|
| Owner stay blocks guest inventory | Authorized owner-stay occupancy uses canonical choke point and distinct economics |
| Co-host may message but not edit calendar | Permission bundles are granular; no “manager” super-role assumption |
| Only listing owner may change payout rules | Owner authority and approval separate from operations roles |
| Percentage payout includes/excludes cleaning fee | Effective-dated agreement stores basis and order of calculation |
| Multiple co-host payouts exceed available earnings | Deterministic priority/shortfall handling and transparent statement |
| Long stay pays monthly | Accrual, payout schedule, cancellation, and owner statement span periods |
| Payout already sent, then reservation is cancelled | Recover through explicit future adjustment/receivable; do not mutate old payout |
| Owner changes agreement during an existing stay | New terms apply by effective-date policy; preserve contracted terms |
| Platform holds payout for risk/KYC | Expected and actual payout states differ; owner statement explains hold |
| Listing currency changes | Re-evaluate payout instructions/FX and retain history |
| Damage claim and guest folio diverge | Separate owner/platform claim from guest operational folio |
| Management fee and tax-reporting gross differ | Statements expose gross, fees, taxes, owner/co-host allocations, net |

Airbnb's public documentation shows granular co-host permissions, owner-only payout
configuration, approval/effective-date behavior, monthly long-stay payouts, shortfalls,
and recovery from later cancellations:
[co-host permissions](https://www.airbnb.com/help/article/1534),
[co-host payouts](https://www.airbnb.com/help/article/3389),
[payout exceptions](https://www.airbnb.com/help/article/3816).

## Tax, fiscalisation, and statutory reporting

| Edge case | Required design/test consequence |
|---|---|
| Tax rule changes between booking and stay | Effective-dated jurisdiction rules; quote, posting, and invoice record applied version |
| Threshold applies per room-night, not stay total | Tax engine preserves calculation basis and nightly allocation |
| Tax-inclusive display but ledger posts net/tax | Reconcile displayed gross to exact postings and rounding |
| Exemption document expires mid-stay | Apply only eligible nights/lines; retain evidence |
| Invoice is rejected after number/hash assignment | Preserve issued identity; correction/retry follows jurisdiction rules |
| India IRN mistake discovered within 24 hours | Cancellation path if permitted and no blocking e-way bill |
| India IRN mistake discovered after window | Credit note/amendment workflow; never edit issued record |
| Cancelled IRN number is reused | Reject: official portal keeps trace and number cannot be reused |
| Saudi simplified vs standard invoice | Choose reporting/clearance and QR/signature chain by verified regime |
| Saudi clearance service is unavailable | Queue/retry only within legal rule; operational UI shows compliance risk |
| UAE requires accredited provider exchange | Provider-routed adapter; do not claim self-clearance |
| Authority accepts payload but callback is lost | Poll/reconcile by stable submission/document identity |
| Guest registration deadline differs by country | Jurisdiction scheduler stores due-at and proof receipt |
| Required identity field is absent at check-in | Block only where verified property policy requires it |
| Legal retention conflicts with guest erasure | Retain protected record while anonymizing unrelated PII; log legal basis |

India's IRP states that generated invoices cannot be amended there, may be cancelled
within 24 hours, remain traceable, and cannot reuse the cancelled number:
[IRP FAQ](https://einvoice6.gst.gov.in/content/faq-powered-by-irisirp/).
ZATCA publishes the official XML implementation/data specifications:
[ZATCA specifications](https://zatca.gov.sa/en/e-invoicing/systemsdevelopers/pages/e-invoice-specifications.aspx).
The UAE Ministry of Finance documents structured PINT AE exchange through accredited
service providers:
[UAE eInvoicing](https://mof.gov.ae/en/about-us/initiatives/einvoicing/).

Rates and rules are time-sensitive. The product must not encode this corpus as law
without re-verifying current primary sources for each release.

## Accessibility and device behavior

| Edge case | Required design/test consequence |
|---|---|
| Keyboard focus is hidden behind sticky operational chrome | Focus remains visible and scrolls into view |
| Dragging a tape-chart booking is the only move mechanism | Provide keyboard/non-drag equivalent with the same preview/guards |
| Dense touch controls are too close on a moving device | Meet target-size/spacing guidance and prioritize destructive-action separation |
| Screen reader encounters a virtualized grid | Preserve semantic row/column context, focus, and announcements |
| Live room/status update steals focus | Announce politely; never move focus unexpectedly |
| Reduced-motion user opens peek/drawer/workbench | Spatial continuity without required animation |
| Phone loses network mid-task | Clear queued/failed/conflicted state; never show false completion |
| RTL locale uses timeline/tape chart | Test logical direction, date axes, numbers, and mixed-script names |
| Text zoom clips financial values/actions | Reflow and retain complete semantics |
| Voice command is ambiguous | Read-only clarification/preview; never choose a critical mutation silently |

WCAG 2.2 adds focus-not-obscured, non-drag alternatives, accessible authentication, and
minimum target-size requirements:
[WCAG 2.2](https://www.w3.org/TR/WCAG22/),
[what changed](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/).

## AI and automation failure cases

| Edge case | Required design/test consequence |
|---|---|
| AI provider is down | Deterministic core and manual UI continue; queued suggestions expire safely |
| Model recommends a command outside its scope | Authorization denies at command boundary, regardless of prompt |
| Retrieved property policy is stale | Show source/version/effective date; refuse consequential action if evidence expired |
| Prompt injection arrives in guest message/document | Treat external content as untrusted data; tool policy and data boundaries remain fixed |
| Model confidence is high but evidence conflicts | Deterministic constraints win; surface contradiction |
| Agent retries after timeout | Command idempotency prevents duplicate mutation/payment/message |
| Agent cost budget is exhausted | Degrade to deterministic/manual path; no business-state corruption |
| Agent proposes rate change across forbidden floor | Policy rejects or requests approval |
| Human approves a proposal after underlying state changed | Revalidate command against current version before execution |
| Autonomous action harms outcome | Link evidence/model/policy/action/result; compensation and autonomy downgrade |
| Provider retains guest content contrary to policy | Route only through approved privacy/region configuration with minimized/redacted context |
| Two agents race to resolve the same task | Optimistic version/transition guard produces one winner |
| AI summary omits a financial exception | Summary is non-authoritative; source facts remain accessible |
| Natural-language command maps to multiple properties | Require explicit property context before mutation |

## Research backlog requiring product-owner or jurisdiction decisions

- Whether reservations may have a separate registration/check-in state before physical
  occupancy for each target vertical.
- Exact owner accounting boundary: payable subledger, full trust accounting, or provider
  payout reconciliation by market.
- Initial launch jurisdictions and property types, which determine the first statutory,
  tax, invoice, identity, and retention modules.
- Which direct/OTA/GDS/payment providers are contractually accessible.
- Offline risk limits for check-in, posting, key issuance, and walk-ins.
- Group/event depth required for the first sellable market.
- Whether long-stay/serviced-apartment recurring billing is in the first commercial slice.
- Autonomy ceilings for each AI agent family.
- Source licences and contracts for Comp Advantage observations.

## Corpus quality rule

This file should grow from defects, operator interviews, provider certification, and
postmortems. Each added consequential case should identify a source or an executable
failure. Volume is not the goal; cases that change a command boundary or proof are.
