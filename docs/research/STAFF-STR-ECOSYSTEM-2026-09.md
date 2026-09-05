# Staff and STR ecosystem benchmark — September 2026

> **Development documentation snapshot — 2026-09-05.** Source:
> [`61dbeea`](https://github.com/dcpnode-maker/yellow/commit/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e).
> This updates the original project documentation on main; main's executable code
> is still an older integrated baseline. Implemented contracts, setup behavior and
> proof described below refer to that development revision, not a claim that main
> or the local app already runs them. Planned capabilities remain planned.


- **Status:** `RESEARCH / PROPOSED`. This is design input, not implementation evidence.
- **Evidence checked:** 2026-09-05.
- **Method:** bounded desk research of representative vendors' public, official
  documentation. No vendor account, demo, proprietary UI asset, live property, or
  hands-on product evaluation was used. This is not a claim that every major PMS was
  evaluated.
- **Related direction:** [staff journeys](../design/STAFF-JOURNEYS.md) ·
  [feature register](../FEATURE-REGISTER.md) ·
  [OTA connectivity](../integrations/OTA-CONNECTIVITY.md) ·
  [voice and RMS plan](../architecture/VOICE-RMS-PLAN.md) ·
  [regional packs](../architecture/REGIONAL-PACKS.md)

Vendor statements below mean only that the cited vendor documentation describes the
capability. Yellow recommendations are separate, and a linked Yellow source file is
implementation evidence only for the bounded behavior actually present in that file.

## 1. Hotel and STR journeys are related, not identical

| Operating model | Primary staff journey | Important exceptions |
|---|---|---|
| Hotel, hostel, resort | Start a property-time shift; resolve arrivals, departures, room readiness and assignment; check in; serve the in-house stay; post and settle the folio; check out; reconcile and close the business day. | Walk-ins, groups and shared rooms, dirty-room override, room move, no-show, split folios, cash control, maintenance and housekeeping discrepancies. |
| STR manager or owner | Start from a portfolio exception feed and multi-calendar; protect availability; coordinate remote turnover; answer channel messages; deliver access instructions; monitor payment/payout state; manage owner blocks and owner statements. | Request-to-book, preparation blocks, unassigned multi-units, lock/access failure, channel-specific edit limits, remote cleaner evidence and payout disputes. |
| Shared kernel | Reservation lifecycle, occupancy truth, property-time dates, unit assignment, tasks, communication, safe payment state, audit, approvals and exception routing. | The same fact may need a different role view, urgency and permitted action. |

**Yellow recommendation:** keep one domain truth but ship distinct `Hotel operations`
and `STR portfolio` staff shells. The landing view should answer: what changed, what
must happen next, by when, who owns it, and what blocks completion. A calendar is a
working surface, not the only navigation model.

## 2. Representative official benchmark

Each entry is deliberately under 150 words derived from that vendor's materials.

### Beds24 — compact hotel/STR reference

**Vendor-documented:** Beds24 combines a configurable dashboard and calendar with
bookings, pricing, a direct booking engine, two-way channel management, OTA messaging,
payments and rule-based Auto Actions. Its channel documentation distinguishes API
connections from lower-fidelity iCal, and its API guidance combines push notification
with periodic modified-since reconciliation.

**Yellow recommendation:** learn from the breadth-to-cost ratio, one master calendar,
self-service configuration, progressive channel capability, and automation triggered
from booking facts. Do not copy its control panel or reproduce every setting. Yellow
should lead with role-specific queues and reveal advanced rules only when needed.

Sources: [introduction](https://wiki.beds24.com/index.php/Introduction),
[channel manager](https://wiki.beds24.com/index.php/Category%3AChannel_Manager),
[messages](https://wiki.beds24.com/index.php/Messages),
[developer/API overview](https://wiki.beds24.com/index.php/Category%3ADevelopers).

### Oracle Hospitality OPERA Cloud — enterprise hotel reference

**Vendor-documented:** OPERA Cloud reservations connect profiles, deposits, room
assignment, housekeeping, billing, groups and registration cards. Front-office flows
cover arrivals, in-house guests and departures. Housekeeping task sheets support
attendant assignment and mobile status updates. OHIP exposes subscribed REST,
asynchronous and business-event surfaces; customer and partner access is gated by the
applicable OPERA/OHIP subscription and enabled modules.

**Yellow recommendation:** retain explicit state transitions, strong role permissions,
batch/group operations, operational controls and event/API boundaries. Avoid making an
enterprise configuration tree the everyday staff experience.

Sources: [reservations](https://docs.oracle.com/en/industries/hospitality/opera-cloud/22.3/ocsuh/c_about_reservations.htm),
[front desk](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.2/ocsuh/ch_front_desk_workspace_intro.htm),
[task sheets](https://docs.oracle.com/en/industries/hospitality/opera-cloud/21.5/ocsuh/c_tasksheets_task_sheets.htm),
[OHIP prerequisites](https://docs.oracle.com/en/industries/hospitality/integration-platform/pswuc/r_prerequisites.htm),
[API modes](https://docs.oracle.com/en/industries/hospitality/integration-platform/msrig/t_using_the_opera_cloud_apis.htm).

### Mews Operations — action-oriented hotel reference

**Vendor-documented:** the Mews dashboard summarizes tasks, reservations, spaces,
customers, occupancy and finance. Its Timeline joins bookings, space assignment,
cleaning/maintenance status, tasks, charges and payments. Reservation management keeps
operational status alongside financial details, while role permissions separate
front-office, housekeeping, finance and administrative actions.

**Yellow recommendation:** use a compact today/exception feed with drill-through to a
timeline or reservation workspace. Preserve bounded role scopes and make occupancy,
room condition and payment exceptions visible without exposing unrestricted financial
or guest data.

Sources: [dashboard](https://help.mews.com/s/article/your-dashboard),
[Timeline](https://help.mews.com/s/article/The-Timeline-An-overview?language=en_US),
[reservation management](https://help.mews.com/s/article/what-is-the-reservation-module-and-what-are-its-features),
[roles and permissions](https://help.mews.com/articles/en_US/Knowledge/setting-up-workplace-privileges).

### Cloudbeds PMS — accessible hotel/hostel reference

**Vendor-documented:** Cloudbeds' dashboard surfaces arrivals, departures, occupancy,
availability, reservation status and quick actions. Reservation pages support search,
filters, groups, import/export and bulk operations, with details and folio access.
Housekeeping provides room conditions, attendants, bulk actions and printable/exported
lists. Its channel manager sends rates, availability and supported restrictions, while
calendar-only connections have narrower behavior.

**Yellow recommendation:** combine a readable today board with contextual drawers and
safe bulk action. Always show channel/source and room-readiness exceptions. Capability
labels must prevent a narrow calendar connection from looking like full distribution.

Sources: [dashboard](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/115000400634-Dashboard-Everything-you-need-to-know),
[reservations](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/218512847-Reservations-Tab-Everything-You-Need-to-Know),
[housekeeping](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/25695101078427-Housekeeping-Everything-you-need-to-know),
[distribution behavior](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/22066119732507-Channel-Distribution-FAQ).

### Guesty — STR portfolio reference

**Vendor-documented:** Guesty's Multi-Calendar manages reservations, blocks,
availability and nightly-rate context across listings. Its Inbox keeps channel
conversations beside reservation and operations context. Tasks and cleaning status can
be linked to reservations, automation and mobile cleaner workflows. Owner, preparation,
manual, smart-rule and iCal blocks have distinct behavior.

**Yellow recommendation:** make portfolio exceptions, turnover readiness and unified
communication primary STR navigation. Preserve block provenance and flexibility;
never flatten owner use, confirmed reservations, preparation time and iCal into one
ambiguous unavailable state.

Sources: [Multi-Calendar](https://help.guesty.com/hc/en-gb/articles/28012752150685-Navigating-the-Multi-Calendar),
[Inbox](https://help.guesty.com/hc/en-gb/sections/9112136006301-Inbox),
[cleaning operations](https://help.guesty.com/hc/en-gb/articles/20187928852637-Managing-your-cleaning-operations-in-Guesty),
[calendar blocks](https://help.guesty.com/hc/en-gb/articles/10889479006109-Understanding-blocks-on-the-Multi-Calendar).

### Hostaway — STR automation and owner reference

**Vendor-documented:** Hostaway combines multi-property calendars, reservation states,
channel synchronization, direct booking, guest-message automation, manual/automatic
tasks, cleaner assignment, owner stays and owner reporting. Automated tasks can follow
reservation times; owner stays block availability but have different monetary and
automation behavior from guest reservations.

**Yellow recommendation:** model owner use, guest stay and operational block as
different facts; connect turnover tasks to reservation changes without erasing manual
adjustments. Scheduled messages need preview, channel capability, failure status and
human takeover rather than silent fire-and-forget delivery.

Sources: [calendar](https://support.hostaway.com/hc/en-us/articles/360002573193-Calendar-Views-Colors-and-Indicators),
[reservations](https://support.hostaway.com/hc/en-us/articles/360002561274-Reservations-Overview),
[tasks](https://support.hostaway.com/hc/en-us/articles/360036506093-Tasks-Create-Manage-Assign-Tasks),
[message automation](https://support.hostaway.com/hc/en-us/articles/360002563794-Inbox-Message-Automations),
[owner stays](https://support.hostaway.com/hc/en-us/articles/1260804707449-Reservations-Create-Owner-Stays).

### Hotelogix — hotel and regional-operability reference

**Vendor-documented:** Hotelogix presents reservations, front desk, housekeeping,
billing, reports, booking engine and channel management as one cloud PMS. Its public
materials describe a front-desk tape chart, current room condition, quick reservation,
night audit and two-way availability/rate/reservation synchronization. Some numerical
reach and real-time statements are vendor marketing claims, not independently tested
here.

**Yellow recommendation:** value direct daily workflows and regional channel
operability, especially for cost-sensitive independent hotels. Require per-channel
technical evidence rather than inheriting broad marketing language, and keep night
audit subordinate to Yellow's immutable business-day controls.

Sources: [PMS](https://www.hotelogix.com/products/property-management-system),
[front-desk manuals](https://www.hotelogix.com/manuals/frontdesk),
[channel manager](https://www.hotelogix.com/products/channel-manager),
[distribution manuals](https://www.hotelogix.com/manuals/distribution).

### PriceLabs — RMS input, not a PMS benchmark

**Vendor-documented:** PriceLabs is a revenue-management platform for STR operators and
hotels. It provides dynamic daily rate and minimum-stay recommendations, market
dashboards, portfolio analytics and integrations that publish approved pricing to a
PMS or channel. Importing a listing does not itself activate price changes; syncing is
a separate action.

**Yellow recommendation:** treat PriceLabs, and any future RMS, as a versioned
recommendation provider. Show source, observed inputs, guardrails and affected dates;
require explicit approval or a bounded policy before publication; retain an audit and
support rollback through a new rate publication. Do not call it a PMS or make it
occupancy authority.

Sources: [product orientation](https://help.pricelabs.co/portal/en/kb/articles/getting-started-with-pricelabs-a-comprehensive-guide),
[dynamic pricing behavior](https://help.pricelabs.co/portal/en/kb/articles/what-is-dynamic-pricing-and-how-to-use-it-14-12-2023),
[pricing model](https://help.pricelabs.co/portal/en/kb/articles/how-much-does-pricelabs-costs).

## 3. Low-cost, open-foundation strategy

1. Extend Yellow's existing PostgreSQL facts, audit, idempotency and outbox instead of
   buying or operating a second workflow engine. Build a responsive/PWA staff surface
   before native mobile applications.
2. Reuse one task primitive for housekeeping, pickup, maintenance and STR turnover,
   with typed templates, role scopes, due-time semantics, checklists and proof fields.
   Do not collapse their state machines or permissions.
3. Use official channel APIs first. iCal is an optional degraded availability block;
   CSV/PDF are bounded import/export surfaces. Never scrape an OTA or automate its UI
   without explicit applicable permission.
4. Put integrations behind capability negotiation. Properties pay operational and API
   cost only for enabled adapters; workers coalesce safe reads and apply documented
   backoff, budgets and reconciliation.
5. Prefer open protocols and permissively licensed, maintained libraries after licence,
   security and SBOM review. Pin versions and keep replaceable ports around calendar,
   messaging, documents and optimization providers. “Open source” is not permission to
   copy vendor screens, text, assets or proprietary workflow expression.
6. Start revenue management with transparent rules plus an optional RMS adapter.
   Do not fund a universal forecasting model before clean property data, publication
   guardrails and measurable operator adoption exist.

## 4. Yellow implementation evidence versus planned work

| Evidence in this worktree | What it proves | What remains planned |
|---|---|---|
| [reservation board](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/reservations/board.ts), [detail](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/reservations/detail.ts), [lifecycle](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/reservations/lifecycle.ts), [commit](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/reservations/commit.ts) | Bounded reservation read/write and lifecycle services exist. | The role-specific staff journey and STR portfolio shell are not established by these services. |
| [check-in](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/stay-operations/checkin.ts), [checkout readiness](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/stay-operations/checkout-readiness.ts), [checkout](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/stay-operations/checkout.ts) | Hotel arrival/departure domain paths exist. | Unified shift handoff, exception feed, group journey and remote STR arrival/access remain proposed. |
| [housekeeping tasks](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/housekeeping/tasks.ts), [sheets](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/housekeeping/sheets.ts), [discrepancies](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/housekeeping/discrepancies.ts), [arrival cleaning](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/housekeeping/arrival-cleaning.ts) | Task lifecycle, daily sheets, room condition and discrepancy behavior exist in bounded form. | Generic templates/checklists, maintenance, STR turnover proof and offline/mobile experience remain proposed. |
| [folios](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/financials/folios.ts), [business-day close](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/financials/business-day-close-workbench.ts), [owner trust](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/financials/trust-workbench.ts), [statements](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/financials/statements.ts) | Bounded folio, close and trust-accounting services exist. | A cohesive cashier shift and STR owner workspace remain proposed. |
| [inventory](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/inventory/availability.ts), [holds](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/inventory/holds.ts), [operational blocks](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/inventory/operational-blocks.ts), [occupancy choke point](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/inventory/reservation-occupancy.ts) | Local availability and occupancy safeguards exist. | Portfolio calendar projection and channel capability/status presentation remain proposed. |
| [rate recommendations](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/rates/recommendations.ts), [publication](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/rates/publication.ts), [pricing](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/rates/pricing.ts) | Bounded recommendation/publication concepts exist. | PriceLabs or other RMS connectivity, voice control and compset ingestion are not proven. |
| [operator HTTP](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/http/operator.ts), [operator client](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/http/operator/operator.js) | Operator routes and browser interactions exist for implemented slices. | Benchmark parity, a redesigned staff shell and complete hotel/STR journeys are not proven. |
| [distribution context](https://github.com/dcpnode-maker/yellow/blob/61dbeea6f2e0eac764ff177d33d8a6f8ac36103e/src/contexts/distribution/index.ts) | The context path exists but is empty in this worktree. | Every OTA/channel adapter remains `PROPOSED / DISCOVERY`; see the connectivity design. |

## 5. Guardrails carried into the staff design

- PostgreSQL remains booking, occupancy, folio and task authority. Calendar projections,
  channel state, RMS recommendations and voice output are not authority.
- Staff actions are tenant/property scoped, least privilege, auditable and idempotent.
  Sensitive identity, payment, tax, bank and destructive actions require the applicable
  permission and step-up approval.
- PAN and CVV never enter Yellow screens, payloads, logs, events or storage. Staff see
  safe payment state and provider tokens/hosted flows only.
- Issued fiscal documents and sealed business days are not edited to simplify a journey;
  corrections use the governed compensating path.
- Vendor capability, feature design and production implementation must remain separately
  labelled in the feature register and acceptance evidence.
