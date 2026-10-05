# Calendar interaction research and host-calendar replacement

## Order717 — founder clarification and implementation, 25 September

The later founder screenshots and explicit instruction supersede the unresolved
placement choices below: replace the default **Reservations host calendar**, with
Airbnb host layout/interactions and neon green (#b6ff00), not pink. Reservations
owns booking actions now; RMS may supply pricing controls later. The historical
Order704 guest-search observations below are not the accepted host reference.

Root subsequently signed into the founder-authorized Airbnb account and inspected
desktop and 390px mobile-WEB hosting calendars, including List/Month/Year. No
Airbnb booking, rate, availability or account setting was changed. The supplied
Android screenshots supplement that observation; no native phone connection was
available. Credentials and guest images were not copied into Yellow.

Implemented under717: property-scoped room/listing picker; compact icon view menu;
continuous three-month window with seven-column day tiles; week/month-wrapped stay
bars; List date cards; twelve-month lazy-loading Year overview; Today/date navigation;
non-modal date-detail sheet and real reservation navigation. Month presentation
accepts an injected day-content renderer for a future RMS controller; the current
Reservations adapter injects the existing authenticated calendar reader only.

### Reference comparison / deliberate differences

| Reference | Yellow implementation / limit |
|---|---|
| Listing cards with thumbnails and mini calendars | Real room labels/type/current condition plus mini calendar; a room glyph replaces unavailable photos. No invented listing status. |
| List / Month / Year icon popup | Working compact popup with focus, Escape, selected view and matching line icons. |
| Rounded day tiles and continuous months | Three bounded loaded months; arrows/month field change the window. Standard document scrolling, not a full-height trapped grid. |
| Reservation bars, guest avatar, historical grey | Real guest initials instead of unavailable images; canonical departed segments mute even when another segment remains in house. Occupied overdue stays do not turn grey from dates. |
| Pink today / selected day | Neon green today and active states; dark selected date; visible short status text and full labels. |
| Dark bottom action panels | Real stay details/open action. No inert price, availability or policy editing controls. |
| Nightly prices, blocked strike-throughs, range editing | Not supplied by current stay-read contract; intentionally not fabricated. RMS writes and governed availability edits remain later work. |
| Multiple listings/properties | Current property rooms plus unassigned stays; global property switch remains the scope boundary, not a fabricated all-property feed. |

Root browser QA caught inherited `aside {display:none}` and incorrect sticky-sheet
placement; scoped fixed sheet now remains visible without locking body scroll.
Property/timezone/date cache binding prevents reuse of a mismatched initial read.
Year cards distinguish not-loaded, failed, partial and actual zero-stay results.
See717 review/receipt for executed proof and remaining differences.

## Historical Order704 research (retained below)

Order704 · 25 September 2026 · research only. Founder subsequently reconfirmed
Airbnb as the reference and requested inspection of website and installed mobile
app. Exact placement (map dates versus staff portfolio) remains unconfirmed.

## Personally observed website reference

Root opened Airbnb's public Homes search on25September (redirect to airbnb.co.in).
Desktop: adjacent month grids in a rounded panel, clear month arrows, Dates /
Flexible segmented switch, date flexibility chips, disabled past dates and
documented keyboard navigation. Mobile web390x844: full-screen search sheet,
collapsible Where/When/Who sections, vertically scrolling months, dark circular
range endpoints and subtle intervening range, Reset/Next at bottom. Root actually
selected2–4October and observed the selected-end-date announcement; no search,
reservation, payment or account setting change was submitted.

Screenshots personally viewed: D:/Yellow/temp/airbnb-calendar-desktop-reference.png
and D:/Yellow/temp/airbnb-calendar-mobileweb-reference.png. These are mobile WEB
observations, not evidence of access to the installed Android app or authenticated
host multi-calendar. Current browser tools expose no connected Android app surface.
Do not call this an exact native-app inspection or an implemented Yellow calendar.

## Official product references

| Surface | What the reference actually does | Useful Yellow pattern / boundary |
|---|---|---|
| [Airbnb host multi-calendar](https://www.airbnb.com/resources/hosting-homes/a/updating-settings-and-availability-649) | Airbnb describes a multi-calendar for professional hosts to view and manage availability across their listings. This is host inventory management, not a guest trip picker. | If Yellow means multi-property operations, show actual authorized property/listing partitions, and make cross-property date comparison deliberate. Only expose edits if backed by each property’s own governed write command. |
| [Airbnb host calendar](https://www.airbnb.com/help/article/447) | A host opens one listing calendar, selects a night or a range, then marks it available or blocked. On mobile, a press-and-swipe selects dates to edit. Mixed selected states require an explicit choice. | Range selection can be fast, but Airbnb’s gesture edits host availability. Yellow’s existing room calendar is explicitly read-only; do not make drag/swipe change occupancy, sellability, room blocks or price. |
| [Linking Airbnb listing calendars](https://www.airbnb.com/help/article/1864) | Calendar linking is a separate anti-double-booking feature for multiple Airbnb listings in the same home; linked listings must have the same primary host. | Do not confuse sibling-unit conflict linking with a portfolio overview across distinct hotel properties. Yellow must use its own authorized property/occupancy relationships. |
| [Airbnb guest date search](https://www.airbnb.com/help/article/252) and [guest search filters](https://www.airbnb.com/help/article/479) | Guest search starts with destination, check-in/check-out and party size. Flexible/month search changes how the guest expresses trip timing; it does not open/block a host’s inventory. | If the request is guest booking, use a clear arrival/departure range and explicit Search/availability result step; selecting dates alone must not reserve or imply a room is available. |

Airbnb patterns inform interaction only; no Airbnb assets or data are imported.

## Kole resource boundary and Yellow adaptation

The [official Kole Jain resource catalogue](https://www.kolejain.com/resources)
currently presents 24 collections and describes them as Figma components from
design videos/builds. Preview/Download opens an email/signup gate in the existing
audit; there is no verified calendar-specific asset or reuse licence. See
[KOLE resource audit](KOLE-RESOURCE-AUDIT-20260924.md) and
[KOLE interaction system](KOLE-INTERACTION-SYSTEM.md); do not repeat acquisition
or copy hidden Figma files. This pass uses only the catalogue and already
authorized public-lesson synthesis.

Apply the existing Yellow contract rather than attempting pixel matching:
compact recognizable controls with visible labels, clear date/property context,
status text in addition to color, one panel at a time, preserved view context,
keyboard/focus support, full-capability mobile sheet, and 44px touch targets.
Treat motion as optional feedback, never as proof of availability or a successful
mutation. Keep the map visually secondary to operational data.

## Current source and real-data boundary

- [`ReservationRoomCalendar.tsx`](../../frontend/yellow/src/workspaces/ReservationRoomCalendar.tsx)
  is a staff room plan: one `propertyId` and timezone, seven property-local
  dates, previous/next/date navigation, filters for reservation status and room
  type, and rows for assigned rooms plus unassigned stays. It is read-only; a
  stay button opens the existing reservation. Empty cells explicitly do not
  claim sellable availability; result limits and failure states are disclosed.
- [`yellow-api.tsx`](../../frontend/yellow/src/yellow-api.tsx) calls
  `loadReservationCalendar(from, to)`. It uses the configured current property
  and makes `GET /api/v1/properties/{propertyId}/reservation-calendar?from=…&to=…`.
  The query key in the component includes property, start date and end date.
- The existing endpoint is already a suitable property-scoped read seam:
  [`operator.ts`](../../src/http/operator.ts) validates the property UUID,
  requires reservation lifecycle read scope and confirms the requested property
  is among granted properties before calling the calendar service. The service
  reads one tenant/property at a time, derives dates from that property timezone,
  limits date spans to 31 days, returns at most 500 room rows and 1,000 stay
  segments with explicit partial-result flags. It reports occupancy/stay context,
  not an authority to sell or mutate inventory.
- A global selector exists in [`App.tsx`](../../frontend/yellow/src/App.tsx):
  `/api/v1/me/properties` returns granted property choices, but the frontend
  filters them to the two showcase property IDs. Choosing one navigates to
  `/p/{propertyId}/today`; it is a property switch, not a simultaneous portfolio
  calendar. Calendar fetching remains bound to that single configured property.
- `market-map` currently has no persisted hotel/listing pins or map-backed
  booking/search inventory. Its unsaved coordinate preview cannot safely serve as
  a lodging search destination/result source.

Relevant existing proof is in `tests/reservation-calendar-ui.test.ts`,
`tests/reservation-calendar-http.test.ts`,
`tests/reservation-calendar.integration.test.ts`, and
`tests/reservation-calendar.test.ts`. This document does not rerun or claim those
tests.

## Smallest next code slice — choose only after founder clarifies

**If this means a staff Reservations multi-property calendar:** preserve the
current one-property room plan unchanged and start with a read-only comparison for
two explicitly selected properties already returned by the granted-property API.
The smallest vertical slice is the ReservationRoomCalendar/Reservations Calendar
view, its API client, and focused UI/query tests: accept explicit selected
property IDs, issue one existing scoped calendar GET per selected property, keep
each property in a separately labelled group (no flattening/colliding room IDs),
and show per-property timezone and existing partial/error states. Restrict choices
to server-granted properties; the server remains the authority on every GET.
Retain a single-property default and the existing global switcher behavior. Do not
add date-range writes, drag-to-block, price edits, cross-property availability
claims or new API/database work in this first read-only slice. Note current
showcase filtering means the UI does not presently expose all granted properties;
removing that filter should be separately verified/scoped, not assumed.

**If this means the guest booking date picker:** it is a distinct component in the
existing reservation offer flow (Arrival date, Departure date, explicit
availability search); it is not `ReservationRoomCalendar`. Improve that date-range
input in the offer-flow component and its focused tests only. Preserve the
explicit search/quote step and existing availability authority; date selection
does not commit a booking. Do not add it to the map until Yellow has a scoped,
real lodging/listing source and the requested map-to-search journey is defined.

**If this literally means booking dates on the Order699 map:** no honest
real-inventory slice exists today. Ask whether the goal is a date-range planning
control alone or a guest search map, and what authorized listings/availability
source should supply results. Do not draw fabricated room pins or availability.

No implementation is authorized by this research receipt; keep Order704 open for
the clarification and a bounded follow-on order.
