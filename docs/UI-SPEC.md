# UI-SPEC.md — the seven surfaces, one PWA

OPERA loses users at the interface: nested modal stacks, mouse-dependent flows,
state lost on navigation. This spec is the displacement weapon. Phase 10 implements
it; every earlier phase's API must make these surfaces possible (deep links, diffs,
idempotency).

## 1. The three-tier surface model (replaces modal stacks)

- **PEEK** — hover/focus card. Read-only glance: reservation summary, folio balance,
  room state. Appears in 150 ms, dismisses on blur, never traps focus.
- **DRAWER** — right-side panel over the current screen. One entity, common edits
  (dates, guests, notes, quick charge). The screen behind stays live and scrollable.
  Esc closes; unsaved changes prompt.
- **WORKBENCH** — full screen for deep work: folio operations, group management,
  rate calendars, day-close readiness. Tabs within a workbench, never windows.

Rule: an action is reachable at the shallowest tier that can hold it. Nothing opens
a modal over a modal. Ever.

## 2. Deep links & state

Every entity and every workbench tab has a URL: `/p/{property}/res/{id}`,
`/p/{property}/folio/{id}?tab=postings`, `/p/{property}/grid?date=2026-09-20`.
Refresh restores exactly. Links are shareable between staff. Browser back = surface
back (workbench → drawer → screen), never data loss.

## 3. Keyboard grammar (front desk lives here)

- Global: `Cmd/Ctrl+K` command palette · `g a` arrivals · `g d` departures ·
  `g g` grid/tape chart · `g h` housekeeping · `/` search · `?` shortcut overlay.
- List navigation: `j/k` rows, `Enter` open drawer, `Shift+Enter` open workbench,
  `Esc` up one tier.
- Actions in drawer: single-letter with visible underlines (c check-in, o folio,
  m move, x cancel — always confirmed).
- Full check-in without touching the mouse is a Phase-10 DoD test, scripted.

## 4. Command palette + voice (same pipeline)

Palette parses intents: "move 204 to 310", "post minibar 45 to Sharma",
"seal yesterday". Voice (Whisper.cpp) feeds the SAME intent parser; Piper reads
back confirmations. One grammar, two inputs. Every palette action maps to a
CONTRACTS.md endpoint — no palette-only capabilities.

## 5. Screen inventory (v1, in build order)

1. **Arrivals / Departures / In-House boards** — the three home tabs. Columns
   configurable, statutory-fields-missing badge (blocks check-in per country).
2. **Grid (tape chart)** — spaces × 14/28 days. Drag to move (= new segment via
   API), color by state, dorm rows expand to bed positions.
3. **Reservation drawer** — summary, stay dates, guests, rate, policies, alerts;
   actions per state machine (buttons render from the transition table, disabled
   with reason if guard fails).
4. **Folio workbench** — one immutable postings workspace with a roving tablist of
   server-owned Business, Personal, Corrections or custom windows. Statement, Add
   charge and Organize charges are inline tasks. Organize selects whole server groups,
   one sibling destination, reason, server preview and acknowledgement before a new
   balanced transfer is appended. Drag in Advanced/Expert only populates that review;
   keyboard/buttons are complete equivalents. Correction is contextual from an
   eligible row and appends a contra; a corrected pair moves only as one group. Simple
   presents View bill, Separate charges and Correct a wrong charge. One global live
   region reports completion after hidden panels change. No browser money arithmetic,
   invoice/print claim or editable financial history.
5. **Availability & rates workbench** — calendar per unit_type: price, restrictions,
   overbooking limit; bulk edit by drag-select; bitemporal "as of" viewer.
6. **Day-close readiness dashboard** — the checklist as live tiles (open cashier
   sessions, unresolved discrepancies, outbox lag); seal button enables when green;
   carry-forward flow for discrepancies with approval.
7. **Housekeeping mobile view** — task list by floor, tap to advance state, photo
   attach for discrepancy, works offline, syncs.

   The Order-202 desktop/mobile task-sheet workbench uses one property-local date and
   one active staff attendant selector. Preview shows only server-resolved eligible
   rooms with room code, floor, condition and cadence evidence; it never accepts a
   browser-authored room list or cadence. A single labelled generation action retains
   its idempotency key across retry and refreshes the authoritative current sheet on
   success. Unsupported weekly/custom/missing/ambiguous cadence is actionable and
   creates nothing. Empty/loading/error/retry states, keyboard operation, restored
   focus, deep links, stale-property/request guards and reduced motion apply in every
   supported appearance.
8. **Kiosk mode** — locked-down check-in flow: find reservation → verify identity
   (statutory fields per country) → sign registration card → issue key placeholder.
9. **Owner portal (read)** — statements from postings, occupancy of owned units.
10. **Group workbench** — block grid, pickup vs allotment, rooming list import.
11. **Reports** — picker + date + Run / Download PDF. v1 set: Arrivals, Departures,
    In-house, Special requests, **Security / Vehicles**, Cashier, Trial balance,
    USALI revenue. Every report is a saved query with a stable URL; PDF is the same
    data rendered server-side, never a screenshot of the screen.
12. **Property setup workbench** — the migration accelerator. Room types, then
    **bulk room create**: numeric range (101–120) with prefix and zero-padding,
    *or* an explicit pasted list ("101, 102, 205A") — whichever is filled wins.
    Rate plans with company linkage and derivation shown inline ("−10% of BAR").
    Corporate accounts assignable org-wide. A property should be enterable in
    under an hour without support.

### Existing-workspace discoverability

The safe Simple detail level keeps progressive disclosure, but it must not make
already-built domains look absent. Before the secondary-workspace disclosure is
opened, compact noninteractive copy names Operations, Housekeeping, Vehicle register,
Inventory setup, Restrictions, Rates and Project status. The disclosure references
that copy for assistive technology. Advanced and Expert show the real controls
directly and suppress the preview; no workspace control or route is duplicated.

## 5b. Adopted from field prototype (Aug 2026)

Observed in a working PMS build and folded into the spec because they solve real
operational problems our earlier draft missed:

- **Travel capture on the reservation** — arrival/departure, mode, carrier, service
  number, scheduled time, pickup requested. Arrivals board sorts by ETA and an
  automation raises the pickup task. Schema: `travel_detail` (indexed on pending
  pickups).
- **Vehicle register** — reg number, make, model, colour, driver, parking slot,
  in/out times. Gated properties in India and the Gulf keep a security register and
  it must be searchable by plate. Schema: `vehicle`. A parking slot is NOT a special
  case: it's a `space` with `profile_key='parking'`, assigned through the same
  occupancy choke point as any bedroom.
- **Human-readable references everywhere** — `RES-…` confirmation numbers already
  existed; `folio_no` (`FOL-…`) added. Staff and guests quote these aloud; UUIDs
  are for machines, never for humans.
- **Property switcher in the app bar** — org hierarchy made visible; switching
  property preserves the current screen and date.
- **Familiar labels over correct internals** — the day-close surface may be
  labelled "Night Audit" for the hotel vertical (via `vertical_profile.terminology`)
  even though the engine is continuous close. Meet OPERA-trained staff in their
  vocabulary; don't inherit OPERA's architecture.

### Not adopted (and why)
- **Modal reservation dialog.** The prototype opens reservations in a centred modal
  with a Close button — no URL, so a reservation can't be linked or restored on
  refresh, and any second action must stack another modal. Our equivalent is the
  DRAWER at `/p/{property}/res/{id}`: same content, deep-linkable, Esc-dismissable,
  never stacked.

## 6. Field-level audit & the three undo levels

Every editable field shows history on long-press/right-click: who, when, old→new
(from fact_log/audit envelope). Three distinct verbs in the UI, never conflated:
- **Undo** — pre-commit only (form state).
- **Correction** — post-commit non-financial (new fact, history preserved).
- **Reversal** — financial (guided contra-journal; original row untouched).
Buttons say which one they are.

## 7. Offline front desk (pre-leased hold pool)

On connectivity loss: banner, read-only from cache EXCEPT walk-in create against
the pre-leased hold pool (Phase 2). Queue of pending ops with per-op status on
reconnect; conflicts surface as tasks, never silent overwrite.

## 8. Performance & feel budgets

Interaction to paint < 100 ms for peek/drawer from cache; availability search
p99 < 50 ms server-side + skeleton UI; grid renders 500 spaces × 28 days at 60 fps
(virtualized); bundle < 300 KB gz initial; Lighthouse PWA pass is a DoD gate.

## 9. Anti-goals

No modal-over-modal · no mouse-only paths · no unsaved-state loss on navigation ·
no "refresh to see changes" (live via SSE/WebSocket) · no admin screens that
bypass the API (UI speaks CONTRACTS.md only — same rule as everyone else).

## 10. Rate publication approval inbox

The Rates workbench Step 5 shows a bounded plan-local approval inbox beneath the exact
server preview. Each row names the immutable release version, pending/approved/rejected
state, requester, decider and timestamps. It never asks staff to paste an approval UUID.

The requester sees a waiting state and cannot decide. A different property-authorized
operator receives explicit **Approve** and **Reject** actions. The deciding operator may
select their approved latest draft for publication, but the publish button stays disabled
until that operator runs a fresh server preview in the current session. Status and action
availability come from the server; the browser only adds the stricter fresh-preview gate.

There is no polling, background decision, automatic selection, automatic publication or
persisted browser authority. Refresh and “Load older requests” are deliberate controls;
sign-out clears all approval selection and preview evidence from memory.

## 11. Governed departure readiness

Reservation detail includes one advisory **Departure readiness** workbench. A manual
refresh reads one coherent server snapshot for the current reservation; it never
checks out the guest, releases occupancy, changes accounts or infers authority in the
browser. The reservation deep link remains `/p/{property}/res/{reservation}` and the
heading receives focus after an operator-requested refresh; errors retain an explicit
retry control.

The workbench presents reservation state, current in-house segment, physical room,
exact exclusive occupancy and every folio window. Folio balances are displayed as the
server-provided currency plus signed minor-unit string without browser arithmetic.
Every window links to the existing governed Folio controls so staff can resolve the
condition in its owning workflow and then refresh departure readiness.

Blockers use this fixed, human-explained order:

1. reservation is not in house or due out;
2. current in-house segment is missing or ambiguous;
3. active physical room is missing or ambiguous;
4. exact exclusive reservation occupancy is missing or ambiguous;
5. no folio window exists;
6. at least one folio window is open;
7. at least one folio window has a non-zero server balance.

The surface requires `stay-operations.checkout:read` plus a server-derived property
grant. Foreign properties are concealed. Property, reservation-detail, route and
request-generation guards discard stale responses. There is no polling, persistence,
optimistic readiness or checkout action. Keyboard focus, 44-pixel controls, narrow
layouts, forced colours, reduced motion and all six current appearances remain
supported.

## 12. Governed checkout command

The Departure workbench contains one explicit **Check out guest** form beneath the
latest advisory readiness evidence. Its confirmation names the operational
consequences: the server locks and revalidates current truth, marks the current stay
segment departed, releases the room claim and records checkout. It does not rewrite,
delete or close financial records in the browser.

The command sends only `{}` to the exact reservation checkout route. Property,
reservation, actor, authority, readiness, room, occupancy, folio evidence, timestamps
and state transitions are server-owned. The action requires
`stay-operations.checkout:commit` plus a server-derived property grant; a foreign
property is concealed. A checked confirmation and a currently ready advisory snapshot
enable the control for clarity, but neither is treated as server authority.

One idempotency key is retained across a transport retry and replaced only when the
operator changes to a different property or reservation, or after authoritative
success. During the request, both checkout and readiness controls are unavailable to
prevent duplicate submission. A successful result refreshes reservation detail and
Today from server truth before focus returns to the Departure heading. A conflict
keeps the same request key, explains that conditions changed and directs the operator
to refresh readiness. Property, reservation, route, detail-generation and
readiness-generation guards discard stale results. The form adds no polling, browser
storage, client arithmetic, optimistic state or client-authored authority and remains
keyboard-operable, responsive, reduced-motion and forced-colour compatible in all six
appearances.

## 13. Governed Vehicle Register read

`/p/{property}/vehicles` is a deep-linkable, read-only Security register. It shows one
bounded page ordered by exact registration and stable server identity, with a deliberate
**Next page** control rather than OFFSET or background polling. The single search field
sends the registration exactly as entered: case, spaces and punctuation are significant;
the browser does not trim, normalize, wildcard or fuzzy-match it.

Each result displays only registration, make, model, colour, driver, literal entered/exited
timestamps and the linked reservation/Party references returned by the server. It never
shows notes or parking truth and never derives onsite status, access authority or occupancy.
The surface does not create, edit, delete, enter, exit or assign a vehicle.

The read requires `stay-operations.vehicles:read` plus the exact server-derived property
grant. Foreign properties are concealed, and a server-detected inconsistent reservation or
Party association fails the complete page closed. Property, route, exact search, cursor and
request-generation guards discard stale responses. Loading, bounded-empty, error/retry and
paging states are announced; operator-requested search, paging, refresh and retry restore
meaningful keyboard focus. The list contains no browser persistence or automatic refresh and
remains narrow-screen, reduced-motion, forced-colour and all-current-appearance compatible.

## 14. Governed arrival-travel visibility

The existing reservation board adds one compact **Arrival** line beneath each stay,
and the same line appears on Today only for the **Due in** lane. It shows recorded
arrival mode, optional carrier and service number, the literal scheduled instant,
whether pickup was requested and whether the recorded pickup-task association is
valid for the same property. A linked task is association evidence only: the browser
does not infer assignment, queue position, task state, completed transport or a
successful pickup.

The existing reservation-board route, permission, filters, ordering, cursor and
bounded-page replacement remain unchanged. There is no new request, polling, ETA
sorting, travel edit, pickup action or browser persistence. Notes, internal
travel/task identifiers, Party/contact data, parking and vehicle truth are not
transported. The text wraps within existing table cells and cards, remains in
the screen-reader reading order, and retains current stale-response, focus,
narrow-layout, reduced-motion, forced-colour and six-appearance protections.

## 15. Governed departure-travel visibility

The existing reservation board adds one compact **Departure** line beneath each stay,
and the same line appears on Today only for the **Due out** lane. It shows recorded
departure mode, optional carrier and service number, and the literal scheduled
instant. It does not transport or infer pickup/drop-off meaning, notes, internal
travel/task identifiers, pickup flags, Party/contact data, parking, vehicle truth or
transport outcome.

The existing reservation-board route, permission, filters, ordering, cursor and
bounded-page replacement remain unchanged. Departure travel does not add a request,
polling, departure-time sorting, travel edit, transfer action or browser persistence.
The text wraps within the existing table cell and cards, follows the screen-reader
reading order, and retains current stale-response, focus, narrow-layout,
reduced-motion, forced-colour and six-appearance protections. Arrival travel remains
separately visible on the board and only in Today's **Due in** lane.

## 16. Governed room-condition visibility

The existing Housekeeping workbench begins with one bounded, read-only **Room
conditions** panel sourced from canonical active physical-room truth. It shows room
code, optional floor, the literal `clean`, `dirty`, `pickup` or `inspected` condition,
and the condition update instant even when no housekeeping task exists. It never
combines that evidence with task, assignee, occupancy, reservation, guest,
out-of-order/service or readiness meaning.

Operators may choose one literal condition or all conditions, refresh the first page
and deliberately load the next opaque-cursor page. The counter is always labelled
**rooms loaded** and explicitly described as a bounded loaded count, never a
whole-property total. There is no polling, offset paging, browser persistence,
condition mutation or inferred room status.

Loading, filtered-empty, error/retry and next-page failure states preserve meaningful
keyboard focus and keep previously loaded rows visible when only a later page fails.
Property, Housekeeping view, route, filter, cycle and request-generation guards discard
stale responses. Controls are at least 44 pixels, 48 pixels in Android appearance;
the panel contains at 375 pixels and 200% zoom, respects reduced motion and forced
colours, and has native material treatment in every current appearance.

## 17. Today operational action routing

Today exposes one bounded **Prepare check-in** action only when both the lane and the
server row status are exact `due_in`. It exposes one **Prepare checkout** action when
the lane and row status are both exact `due_out` or both exact `in_house`. Every other
lane/status pair remains inert. Each semantic button reuses the existing
`.today-operational-action` control and opens the canonical reservation detail at
`/p/{property}/res/{reservation}?workbench=check-in|checkout`; no second route,
control family or appearance treatment is introduced. Travel, room, Folio, balance,
occupancy, housekeeping and inferred readiness evidence never creates or changes an
action.

The query carries presentation and focus intent only. Refresh, Back, Forward and a
same-reservation query change reapply that intent after current authoritative detail
settles. Invalid, duplicate, empty, extra or status-incompatible intent canonicalizes
to the plain reservation detail, announces the fallback and performs no command.
The existing strict workbench parser, one-entry history, stale guards and Today return
focus remain unchanged. Existing authoritative reservation detail, checkout-readiness
blockers, server permissions and explicit confirmation remain mandatory before any
existing check-in or checkout command can run; Today navigation adds no authority or
mutation.

Action groups wrap without a fixed inline measure. Buttons remain at least 44 pixels
and 48 pixels in Android appearance, contain at 375 pixels and 200% zoom, expose a
visible keyboard focus indicator, and remain operable under reduced motion and forced
colours in Apple, Android, Windows 95/98, glass, neomorphism and ERP appearances.

## 18. Reservation-detail stay changes

The current reservation drawer offers one semantic **Stay changes** action in the
same action group as the governed reservation controls. It opens the existing
segment editor inside the drawer for the exact loaded confirmation, so the operator
can read segment history and use only the departure-change or room-move forms that
the latest server segment explicitly allows. The detached advanced confirmation
lookup remains inert and is not presented as a second journey.

The panel announces loading, success, failure and retry in the current drawer. A
successful governed command refreshes current segment truth and the exact reservation
detail before focus returns to the live Stay changes panel. Closing the drawer,
changing property, signing out or opening another reservation returns the editor to
its inert home; late results and detached focus are discarded.

The action and every editor control remain at least 44 pixels, and 48 pixels in the
Android appearance. The panel has no fixed inline measure, contains long identifiers
and forms at 375 pixels and 200% zoom, uses a visible keyboard focus indicator, and
respects reduced motion and forced colours. Apple, Android, Windows 95/98, glass,
neomorphism and ERP appearances each preserve their native material treatment without
changing server authority, endpoint, method, request body, idempotency or confirmation
semantics.

## 19. Reservation-detail guest allocation

The current reservation drawer offers one semantic **Guests & shares** action in the
same bounded action group as the existing governed controls. It loads the exact
reservation's authoritative guest occurrence and allocation and moves the one
existing guest editor into the drawer. The detached confirmation lookup remains
inert, is never exposed as a second journey, and no editor is cloned.

The server-owned primary Party and role remain read-only. Dynamic guest rows expose
only the existing accompanying and sharer choices, with the existing explicit share
total and inline command feedback. Guests & shares and Stay changes are mutually
exclusive presentation panels. Closing or changing drawer identity returns each
editor to its own inert home, and late results or detached focus are discarded.

Loading, success, failure and retry are announced in the current drawer. After an
authoritative save, the current guest allocation and exact reservation detail refresh
once before focus returns to the live Guests & shares panel. The action and all
dynamic-row controls remain at least 44 pixels, and 48 pixels in Android appearance.
Long Party identifiers, labels, rows and share totals contain at 375 pixels and 200%
zoom, with visible focus, reduced-motion and forced-colour support. Apple, Android,
Windows 95/98, glass, neomorphism and ERP appearances retain distinct native material
treatment without changing server authority, endpoint, method, body, idempotency or
allocation semantics.

## 20. Governed reservation travel capture

The canonical reservation drawer exposes one semantic **Travel details** action only
when current server actions permit reservation modification. It hosts one reusable
editor and selects exactly one `arrival` or `departure` resource at a time. Mode,
optional carrier/provider, optional service number and an optional canonical UTC
scheduled instant are explicit labelled controls; pickup-requested intent is shown
only for arrival. Departure always submits pickup requested as false. Empty desired
truth and deletion are not offered.

The form binds `expected` to the exact normalized tuple already loaded in canonical
reservation detail, including `null` when that direction is absent. One per-direction
PUT carries the exact desired tuple and a retained Idempotency-Key. The browser never
sends a travel id, task id, notes, actor, tenant or policy evidence, never detaches a
linked pickup task, and never claims pickup automation, task state, vehicle, parking
or transport outcome. A conflict preserves the draft and reports current server
rejection; success reloads authoritative reservation detail exactly once before the
live Travel details editor is restored.

Travel details, Stay changes, Guests & shares and lifecycle editors are mutually
exclusive. Property, route, reservation id, confirmation, detail generation, request
generation and mounted-panel guards suppress every stale paint or focus attempt.
Closing the drawer, changing property, signing out or opening another reservation
returns the single form to its inert home. The action and controls are at least 44
pixels, and 48 pixels in Android appearance; two-column fields collapse to one at 375
pixels and 200% zoom. Long values wrap, keyboard focus remains visible, and reduced
motion and forced colours are explicit. Apple, Android, Windows 95/98, glass,
neomorphism and ERP each retain distinct native material treatment without changing
the governed endpoint, CAS, idempotency or audit semantics.

## 21. Reservation-detail arrival pickup state

The canonical reservation drawer presents pickup automation state only inside the
existing arrival row in its Travel section. Exact authoritative arrival truth maps
to one text label: **Pickup not requested**, **Pickup requested · schedule required**,
**Pickup requested · task pending**, or **Pickup task linked**. Departure rows never
show a pickup state. The state preserves the recorded mode, carrier, service number
and scheduled instant already shown beside it.

This is read-only presentation of the current reservation detail response. It adds no
request, polling, cache, task link, route, button or background effect, and it never
shows a task identity or infers task status, assignment, queue, dispatch, completion,
driver, vehicle, contact or transport outcome. Ordinary authoritative detail refresh
is the only way a newly linked task becomes visible, so the label makes no immediacy
claim.

Text carries the complete meaning; colour, border, material and depth are supporting
cues only. The status contains long translated text at 375 pixels and 200% zoom with
no horizontal overflow. Apple iOS, Android, Windows 95/98, glassmorphism,
neomorphism and ERP each retain a dedicated native material treatment. Forced colours
restore explicit system borders and text, while reduced motion applies no animation
or transition. Existing reservation route, Back/Escape/focus and stale-response
guards remain unchanged.

## 22. Reservation-scoped arrival pickup-task detail

An authoritative linked arrival row alone exposes the semantic **Open pickup task**
action. It opens the canonical nested route
`/p/{property}/res/{reservation}/pickup-task/{task}` inside the existing reservation
drawer and reads only the dedicated reservation-scoped arrival pickup-task endpoint.
Direct navigation, refresh and Forward load that same route. Back, the panel's
**Back to reservation** action and Escape restore the exact plain reservation route;
focus returns to the originating action when it still exists, or to the reservation
heading for a direct link.

The single read-only panel shows the confirmation, literal task status, due time,
priority, created time, nullable completion time and progressively disclosed recorded
task/reservation identifiers. It never offers edit, assignment, dispatch, completion,
cancellation or another lifecycle action; does not poll; and does not expose payload,
assignee, Party/contact, notes, driver, vehicle, queue, sheet, credits, tenant/property
identity or transport outcome. A missing or inconsistent current link displays a
bounded retryable failure without partial task disclosure.

Every request and render is bound to the exact property, reservation, confirmation,
task, nested pathname, reservation-detail generation and pickup-task request
generation. Changing property, reservation, task, route or drawer identity makes late
responses inert. The endpoint response is accepted only when its exact minimized
shape and all recorded identifiers agree with the current route.

Text carries the complete task-status meaning for **Open**, **Assigned**,
**In progress**, **Done**, **Verified** and **Cancelled**; colour and material are
supporting cues only. Apple iOS, Android, Windows 95/98, glassmorphism, neomorphism
and ERP each use a dedicated native presentation while preserving the same semantic
order and truth. Controls remain at least 44 pixels, or 48 pixels for Android. Long
identifiers and translated labels remain contained at 375 pixels and 200% zoom.
Forced colours restore explicit system boundaries and focus, and reduced motion
removes panel, control and loading animation.

## 23. Vehicle-register exact detail

Every validated row in the existing Vehicle Register exposes one semantic **Open
vehicle** action. It opens `/p/{property}/vehicles/{vehicle}` and refetches the exact
record through the dedicated no-store endpoint; the list object is never reused as
detail authority. The response is accepted only when its envelope, ten approved
Order205 keys, routed vehicle UUID and canonical microsecond UTC timestamps are exact.

The read-only panel shows literal registration, nullable make/model/colour/driver,
recorded entry/exit instants and progressively disclosed vehicle, reservation and
Party identifiers. It does not show notes, parking or occupancy, infer onsite/access
state, link to Party/reservation content, poll, or offer entry, exit, edit, assignment
or parking controls. A missing or inconsistent record stays on the exact route and
shows one deliberate retry without partial disclosure.

Opening from the register records the exact literal registration/cursor return URL.
Back, **Back to register**, and Escape restore that URL and originating action focus
when it remains connected; a cold direct link falls back to the bounded first page
and Vehicle Register heading. Refresh and Forward refetch the detail. Property,
vehicle, pathname, active-view and request-generation guards make late responses
inert.

Apple iOS uses restrained translucent grouped material; Android uses Material 3
shape and 48-pixel controls; Windows 95/98 uses square inset/outset system chrome;
glassmorphism uses layered blur and translucent boundaries; neomorphism uses paired
raised/inset shadows; ERP uses compact rectangular information density. The same text
and reading order remain authoritative across all six. Controls are at least 44
pixels, identifiers wrap at 375 pixels and 200% zoom, forced colours restore system
borders, and reduced motion removes loading animation.

## 24. Housekeeping-task exact detail

Every canonical task on the existing Housekeeping board exposes one semantic **Open
details** action. It opens the exact nested route
`/p/{property}/housekeeping/tasks/{task}` and reads only the dedicated property-scoped
housekeeping-task endpoint. The board route remains
`/p/{property}/housekeeping`. Direct navigation, refresh and Forward refetch the
detail; a query on the nested route is removed so the pathname remains canonical.

The single bounded panel identifies the physical room and presents literal task
status and room condition, assignment presence, floor, priority, nullable due and
completion instants, the room-condition evidence instant, and progressively disclosed
task and space identifiers. Loading is exposed through `aria-busy`; failure is an
alert with an explicit retry. Task truth is limited to **Assigned**, **In progress**
and **Done**, while room truth is limited to **Clean**, **Dirty**, **Pickup** and
**Inspected**. Text carries the complete meaning; colour, depth and material are
supporting cues only.

The surface is strictly read only. It does not offer assignment, transition,
completion, cancellation or any other lifecycle command; governed task transitions
remain on the Housekeeping board. It does not poll, persist browser state, reuse list
data as detail authority, or disclose payload, notes, credits, sheet, assignee
identity, Party/contact/updater, reservation, guest, occupancy or discrepancy data.
It makes no inferred readiness, workload, SLA, urgency or availability claim. A
missing or inconsistent record remains on the exact route and shows a retryable error
without partial disclosure.

Back, **Back to board** and Escape restore the plain Housekeeping route. Focus returns
to the originating **Open details** action while it remains connected, or to the
Housekeeping heading after a cold direct link or changed board. An operator-requested
refresh focuses the refreshed room heading on success and the retry control on
failure. Property, task, active-view, exact-pathname, mounted-panel and
request-generation guards make late responses and detached focus attempts inert;
leaving the route invalidates the pending read.

Apple iOS uses a restrained translucent grouped panel with rounded inner surfaces;
Android uses Material 3 shape, elevation and 48-pixel controls; Windows 95/98 uses
square inset/outset system chrome and a navy title bar; glassmorphism uses layered
translucent gradients, blur and luminous boundaries; neomorphism uses paired
raised/inset shadows; ERP uses compact rectangular information density and a clear
blue rule. The semantic order and server truth remain identical across all six.
Controls are at least 44 pixels, long headings and identifiers wrap, facts collapse
to one column, and actions become full width so the panel contains at 375 pixels and
200% zoom. Keyboard focus remains visible. Forced colours replace decorative
materials with explicit Canvas/CanvasText boundaries, and reduced motion removes the
loading animation and nonessential transitions.

## 25. Vehicle linked-reservation composition

The exact vehicle-detail panel exposes **Open linked reservation** only after its
current validated, frozen vehicle row contains a canonical non-null reservation
identifier. A vehicle with no reservation association, including a Party-only record,
shows no action. Immediately before navigation, the client rechecks the active
Vehicles view, exact property, routed vehicle, current vehicle and reservation
identifiers, canonical vehicle-detail pathname, and the connected visible panel and
action. A mismatch is inert.

The action adds exactly one history entry and targets only the existing
`/p/{property}/res/{reservation}` route. Existing reservation detail and
`reservations.lifecycle:read` transport remain the sole server authority, including
their existing forbidden response. This composition adds no endpoint, request,
scope, payload field or copied detail authority. Refresh and Forward reopen the
authoritative reservation detail. Close, Escape and Back restore the exact vehicle
detail, refetch its authoritative vehicle truth and focus its title; a second Back
retains the Vehicle Register's exact return URL, literal filter and cursor behavior.

This is read-only navigation between two existing exact reads. It performs no
vehicle, reservation, Party, parking or task mutation; offers no POST, PUT, PATCH or
DELETE; and adds no polling, browser storage, optimistic state, access decision,
onsite state or parking inference. Property, vehicle, reservation, active-view,
pathname, visible-panel and request-generation containment prevents stale navigation,
paint or focus.

The semantic action remains at least 44 pixels and wraps without horizontal overflow
at 375 pixels and 200% zoom; Android raises the target to 48 pixels. Apple iOS uses a
restrained blue rounded control, Android uses a Material 3 filled pill, Windows 95/98
uses square outset/inset system chrome, glassmorphism uses translucent layered blur,
neomorphism uses paired raised and pressed inset shadows, and ERP uses compact
rectangular density. The same label, target and reading order remain authoritative
across all six. Keyboard focus is explicit, forced colours replace decorative
materials with system button colours and boundaries, and reduced motion removes
transition and transform effects.

## 26. Reservation-detail operational preparation

A successfully validated current reservation detail exposes at most one semantic
preparation action from authoritative status: **Prepare check-in** for `due_in`,
**Prepare checkout** for `in_house` or `due_out`, and no preparation action for every
other status. This is presentation composition only; it introduces no new status,
eligibility or lifecycle meaning.

The action targets the same canonical `/p/{property}/res/{reservation}` route with
the existing exact `?workbench=check-in` or `?workbench=checkout` query. The existing
strict query parser, readiness endpoints, server permissions and explicit confirmation
flows remain the sole authority. Navigation adds exactly one same-reservation history
entry and performs no POST or lifecycle command. Refresh and Forward reapply the
existing preparation intent. Back returns to plain reservation detail and restores
focus to the matching action while it remains authoritative, otherwise to the
reservation heading. Close and Escape retain the existing reservation-detail return
and focus behavior.

Immediately before navigation, the client rechecks the exact property, routed and
validated reservation identifiers, confirmation, authoritative status, detail
generation, plain canonical pathname, current Reservations view, and connected
visible drawer, content and action. Any changed, detached or stale identity is inert.
Existing 403, 404 and 409 readiness or command outcomes remain unchanged; this
composition cannot bypass readiness or confirmation and performs no automatic
check-in, checkout, folio repair, occupancy mutation, room-condition change or
housekeeping-task creation.

The action remains at least 44 pixels and wraps without horizontal overflow at 375
pixels and 200% zoom; Android raises the target to 48 pixels. Apple iOS uses a
restrained blue rounded control, Android uses a Material 3 filled pill, Windows 95/98
uses square outset/inset system chrome, glassmorphism uses layered translucent blur,
neomorphism uses paired raised and pressed inset shadows, and ERP uses compact
rectangular density. The label, target, reading order and governed behavior remain
identical across all six. Keyboard focus is explicit, forced colours replace
decorative materials with system button colours and boundaries, and reduced motion
removes transition and transform effects.

## 27. Housekeeping-task detail governed actions

The exact current housekeeping-task detail presents zero or one semantic action from
its frozen server-owned `allowedActions`: **Start cleaning**, **Mark room clean** or
**Verify inspection**. Start and Complete remain governed by the existing property work
grant; Verify remains governed by the distinct existing inspect grant. Browser status,
room condition, assignment or timing never creates an action, and the existing
transition endpoint remains the final authority inside its current transaction.

Immediately before submit, the client rechecks the exact property, routed task,
validated task status and room condition, room-condition evidence timestamp, allowed
action, detail request generation, canonical nested pathname, current Housekeeping
view, and connected visible panel and action. A mismatch is inert. The command uses
only the existing action, expected task status, expected room condition and expected
room-updated timestamp body with an actor-bound idempotency key. An unchanged retry
retains its key; a conflict discards it and refreshes authoritative task-detail,
Housekeeping-board and room-condition truth.

Start and Complete repaint only after current detail, board and condition truth have
settled. Verify returns to the existing Housekeeping board because verified truth is
no longer eligible for this bounded detail, refreshes the same authoritative reads
and restores safe focus. The nested route, Back, Forward, refresh and Escape keep
their existing history behavior. No optimistic lifecycle claim, new target status,
assignment, task creation, polling or browser-owned permission is introduced.

The action remains at least 44 pixels and wraps without horizontal overflow at 375
pixels and 200% zoom; Android raises the target to 48 pixels. Apple iOS uses a
restrained rounded control, Android uses a Material 3 filled pill, Windows 95/98 uses
square outset/inset system chrome, glassmorphism uses layered translucent blur,
neomorphism uses paired raised and pressed inset shadows, and ERP uses compact
rectangular density. The label, target, reading order and governed behavior remain
identical across all six. Keyboard focus is explicit, forced colours replace
decorative materials with system button colours and boundaries, and reduced motion
removes transition and transform effects.

## 28. Housekeeping-sheet task receipt

A deliberate successful or replayed housekeeping-sheet generation displays one
transient receipt containing exactly the tasks returned by that existing governed
command. The receipt accepts only one canonical sheet for the current property,
selected property-local date and selected attendant; its task count must equal its
bounded task array, task and space identifiers must be canonical and unique, room and
profile labels must be nonblank and bounded, and cadence remains exactly `daily` or
`on_departure`. Validated receipt and task truth is frozen before presentation. The
ordinary generated-sheet list remains aggregate history and never becomes a task
detail authority.

Each receipt task presents its recorded room, profile and cadence as text and exactly
one **Open task** control. Merely displaying the receipt makes no request. Immediately
before navigation, the client rechecks exact property, sheet date, attendant, receipt
generation, task, space and cadence identity, active Housekeeping view, current path,
and connected visible receipt panel and action. Any stale or detached identity is
inert. Deliberate activation reuses only the existing canonical nested housekeeping-
task route and Order217 no-store read; current terminal, ineligible or changed truth
retains that endpoint's existing concealed/not-found behavior. Order220 remains the
sole action authority after detail loads.

The receipt is not persisted in browser storage and makes no sheet-history claim. It
is cleared when property, date, attendant or draft identity changes, on a new preview,
generation conflict or error, and when the operator leaves the relevant journey.
Success and exact replay share the same rendering contract. The existing nested detail
history, Back, Forward, refresh, Escape and board-return behavior remains authoritative;
focus enters the receipt after generation and the existing task-detail journey restores
focus only while the originating **Open task** control remains current and connected.
There is no polling, optimistic state, copied task authority or automatic lifecycle
command.

The list contains no more than the command's existing 200-task bound, uses wrapping
room/profile/cadence text and never creates horizontal overflow. Every **Open task**
target is at least 44 pixels and becomes full width when necessary at 375 pixels and
200% zoom; Android raises it to 48 pixels. Apple iOS uses grouped translucent surfaces,
Android uses Material 3 shapes and elevation, Windows 95/98 uses square inset/outset
system chrome and a navy receipt heading, glassmorphism uses layered translucent blur,
neomorphism uses paired raised/inset shadows, and ERP uses compact rectangular density
with a blue rule. Reading order and truth remain identical across all six. Keyboard
focus is explicit, forced colours replace decorative materials with system boundaries
and button colours, and reduced motion removes nonessential transitions and transforms.

## 29. Departure-to-Folio return continuity

Only a successfully validated current Folio card inside the authoritative departure-
readiness workbench may open Folio controls with departure return context. The frozen,
minimized history descriptor binds exact property, reservation identifier,
confirmation number, reservation status, checkout workbench, Folio identifier,
canonical origin path and current reservation-detail and readiness generations. It
adds no financial, checkout or permission meaning.

Opening the card adds exactly one history entry and reuses the existing canonical
Folio route and read. While the exact descriptor remains current, the existing Folio
back control gains the contextual class `folio-departure-return` and its complete
visible copy is **Back to departure**. Direct Folio lookup and every non-departure Folio
open retain **Back to folio lookup** and their existing behavior. The descriptor lives
only in the relevant history state; there is no browser storage, polling or second
return authority.

Before open or return, the client rechecks exact property, reservation, confirmation,
status, Folio, path, active view, visible drawer, checkout workbench, originating card
and detail/readiness generations. A stale, detached or mismatched identity is inert.
The contextual control, Escape and browser Back restore the same canonical reservation
route with `?workbench=checkout`, refetch existing reservation detail and checkout
readiness, then focus the matching Folio card when it still exists or the departure
heading otherwise. Refresh and Forward reconstruct context only from a descriptor that
still validates. Existing dirty-Folio confirmation remains mandatory; cancelling it
changes neither URL nor focus.

Navigation runs no POST, PUT, PATCH or DELETE. Existing Folio writes, readiness and
checkout confirmation, server grants, 403/404/409 handling and immutable finance rules
remain unchanged. The contextual class and copy communicate navigation only and never
claim that a Folio, reservation or departure state changed.

The contextual control remains at least 44 pixels and wraps without horizontal
overflow at 375 pixels and 200% zoom; Android raises it to 48 pixels. Apple iOS uses a
restrained tinted rounded control, Android uses a Material 3 tonal pill, Windows 95/98
uses square outset/inset system chrome, glassmorphism uses layered translucent blur,
neomorphism uses paired raised and pressed inset shadows, and ERP uses compact
rectangular density. The label, reading order and return target remain identical
across all six. Keyboard focus is explicit, forced colours replace decorative
materials with system button colours and boundaries, and reduced motion removes
nonessential transition and transform effects.

## 30. Reservation-to-Folio return continuity

Only an exact current connected existing-Folio control in canonical reservation detail,
or the exact current successful primary-Folio command receipt, may open Folio controls
with reservation return context. Its minimized frozen history descriptor binds source,
property, reservation identifier, confirmation number, reservation status, Folio
identifier, canonical reservation origin path and workbench intent, and the current
reservation-detail generation. The existing-Folio source additionally rechecks the
visible connected control and exact Folio list; the primary-receipt source rechecks its
command generation, identity and validated response. Neither source adds financial,
checkout, readiness, balance, occupancy or permission meaning.

Opening adds exactly one history entry and reuses the existing canonical Folio route
and read. While the descriptor remains exact and current, the existing Folio back
control gains the contextual class `folio-reservation-return` and its complete visible
copy is **Back to reservation**. Copy precedence is exact: a current Order222 departure
descriptor presents **Back to departure**; otherwise a current reservation descriptor
presents **Back to reservation**; otherwise the direct and non-contextual control
presents **Back to folio lookup**. The descriptor lives only in the relevant history
state; there is no browser storage, polling, second route or new request.

Before open or return, the client rechecks exact source, property, reservation,
confirmation, status, Folio, origin path, workbench, active view, visible connected
drawer and control, and detail or command generation. A stale, detached or mismatched
identity is inert. The contextual control, Escape and browser Back restore the exact
canonical reservation/workbench route, refetch authoritative reservation detail and
restore the matching Folio button when it still exists or the Folios heading otherwise.
Refresh and Forward reconstruct context only from a descriptor that still validates.
Existing dirty-Folio confirmation remains mandatory; cancelling it changes neither URL
nor focus.

Navigation runs no POST, PUT, PATCH or DELETE and no financial or checkout command.
Existing Folio reads and writes, server grants, status handling and immutable finance
rules remain unchanged. The contextual class and copy communicate navigation only and
never claim that a Folio, reservation, balance, departure or occupancy state changed.

The contextual control remains at least 44 pixels and wraps without horizontal
overflow at 375 pixels and 200% zoom; Android raises it to 48 pixels. Apple iOS uses a
restrained violet-tinted rounded control, Android uses a Material 3 tertiary tonal
pill, Windows 95/98 uses square outset/inset system chrome, glassmorphism uses layered
violet translucent blur, neomorphism uses paired raised and pressed inset shadows, and
ERP uses compact rectangular density. The label, reading order and return target remain
identical across all six. Keyboard focus is explicit, forced colours replace decorative
materials with system button colours and boundaries, and reduced motion removes
nonessential transition and transform effects.

## 31. Vehicle-register-to-reservation return continuity

Only the exact current register card for a canonical vehicle row with a non-null
reservation identifier exposes **Open linked reservation**. The control carries the
contextual class `vehicle-register-linked-reservation-action`; its label is navigation
copy, not a claim about arrival, pickup, occupancy, readiness or reservation state.
The existing vehicle-detail action remains unchanged.

Opening canonical reservation detail captures a minimized frozen return descriptor
for the current property, vehicle, reservation, registration, register filter and
cursor, register path, page generation, frozen row, card and action. The client
rechecks those identities immediately before navigation, creates exactly one history
entry and reuses the existing reservation-detail read without adding any write.
Detached, replaced, stale or mismatched sources are inert.

The contextual control, Escape and browser Back restore the exact register URL,
refetch authoritative register truth and restore focus to the same linked-reservation
action when it still exists or to the safe register summary otherwise. Refresh and
Forward reconstruct this continuity only from a descriptor that still validates.
The descriptor is history-state only: there is no browser storage, polling, second
route or new authority.

The contextual action is at least 44 pixels and wraps within its register card at 375
pixels and 200% zoom; Android raises it to 48 pixels. Apple iOS uses a restrained
blue-tinted rounded control, Android uses a Material 3 secondary tonal pill, Windows
95/98 uses square outset/inset system chrome, glassmorphism uses layered translucent
blue blur, neomorphism uses paired raised and pressed inset shadows, and ERP uses
compact rectangular density. All six appearances preserve the same label, order and
target. Keyboard focus is explicit, reduced motion removes nonessential movement, and
forced colours replace decorative materials with system button colours and boundaries.

## 32. Check-in-to-Housekeeping return continuity

Only an exact current due-in reservation blocked by the server-owned
`room_condition_missing` or `room_not_ready` readiness result exposes the semantic
**Review room in Housekeeping** action. Every other blocker and ready state omits the
action. Its minimized frozen history descriptor binds the current property,
reservation and confirmation identifiers, due-in status, exact blocker, nullable
assigned room and recorded condition, canonical reservation origin with
`?workbench=check-in`, and the current detail and readiness generations. A detached,
stale or mismatched action is inert.

Opening creates exactly one history entry and reuses the existing canonical
Housekeeping route and condition-board read. Housekeeping may select only the exact
recorded room condition and may focus the exact assigned-room card only when current
authoritative room truth contains that identity; otherwise focus moves to the safe
Room conditions heading. It never infers a housekeeping task, occupancy or arrival
readiness result.

The contextual **Back to arrival** control, Escape and browser Back restore canonical
reservation detail with `?workbench=check-in`, refetch current reservation and
readiness truth, then restore focus to the matching current action or the safe check-in
heading. Refresh and Forward reconstruct context only while the descriptor remains
exact. Direct Housekeeping remains unchanged. The journey adds no request, mutation,
polling, browser storage, task transition, check-in command or new authority.

Both contextual controls remain at least 44 pixels, wrap without horizontal overflow
at 375 pixels and 200% zoom, and rise to 48 pixels under Android. Apple iOS uses a
restrained blue-tinted rounded control, Android uses a Material 3 tonal pill, Windows
95/98 uses square outset/inset system chrome, glassmorphism uses layered translucent
blue blur, neomorphism uses paired raised and pressed inset shadows, and ERP uses
compact rectangular density. All six appearances preserve the same semantic labels,
reading order and targets. Keyboard focus is explicit, reduced motion removes
nonessential transitions and transforms, and forced colours replace decorative
materials with system button colours and boundaries.

## 33. Governed initial room-condition ingress

Housekeeping exposes **Set initial condition** only within the exact current
`room_condition_missing` arrival return context and only after the exact assigned-room
candidate GET confirms that the canonical condition is absent. The paged condition
board never supplies or implies this absence. Direct Housekeeping, a different blocker,
a missing assigned room, a changed property or route, and stale generations expose no
initialization form.

The disclosure is inline in the canonical Room conditions board. Its semantic form
uses one fieldset and the server-returned allowed literals only: clean, dirty and
pickup. No option is preselected, and inspected is never offered because inspection
remains governed transition evidence. Submission sends only the explicit absence
expectation and chosen literal with one idempotency key retained unchanged for an
unchanged retry. There is no browser-derived default, optimistic room row, polling or
browser storage.

Success and absence conflicts refetch the exact candidate, bounded condition board and
arrival readiness before focus moves. Focus returns to the same current disclosure only
when the candidate still proves absence; otherwise it moves to the safe Room conditions
heading. Property, Housekeeping path and view, condition and request generations,
assigned space, blocker, current return object, connected action and board containment
all participate in stale-response rejection.

The action and form remain bounded at 375 pixels and 200% zoom. Controls are at least
44 pixels, with 48-pixel Android targets. Apple iOS uses restrained layered system
surfaces, Android uses Material 3 shapes and elevation, Windows 95/98 uses square
outset/inset chrome, glassmorphism uses translucent blur, neomorphism uses paired raised
and inset shadows, and ERP uses compact rectangular density. All six preserve the same
semantics and reading order. Keyboard focus is visible, reduced motion removes
nonessential transforms and transitions, and forced colours replace decorative
materials with system boundaries while preserving the established Housekeeping detail
fallbacks.

## 34. Arrival pickup-task dispatch

The existing canonical pickup-task nested panel renders only its one current
server-derived `eligibleAction`. An open unassigned task exposes **Assign pickup**
with detached active-staff search and explicit selection; an assigned task exposes
**Start pickup**; an in-progress task exposes **Complete pickup**; every other state
has no mutation control. Staff search may show its already-permitted display label,
but the panel never fetches or renders contact, driver, vehicle, notes or payload.

Submission binds the current property, reservation, task, route, detail generation,
status and nullable assignee evidence, retains one unchanged idempotency key for an
unchanged retry, and locks every related control in flight. The browser never paints
an optimistic assignment or status. Success and current-state conflict refetch exact
pickup detail before restoring focus to the next current action or the safe task
heading. Changing route, property, reservation, task, staff selection or generation
makes a late response inert. There is no polling or browser storage.

Controls remain at least 44 pixels, with 48-pixel Android targets, and are contained
at 375 pixels and 200% zoom. All six current appearances preserve the same semantic
order and action matrix with dedicated native presentation. Keyboard focus is
explicit, reduced motion removes nonessential movement and forced colours replace
decorative materials with system boundaries.

## 35. Arrival room-cleaning task creation

The cleaning disclosure appears only after an exact current
`dirty_room_override_unauthorized` check-in return enters the canonical Housekeeping
route and the reservation-scoped candidate GET re-proves the same assigned room as a
dirty/pickup due-in candidate. Direct Housekeeping, another blocker, a missing or
changed assigned room, route/property mismatch, an incoherent candidate and stale
request generations expose no form. The existing Room conditions board remains the
surrounding authoritative surface and Yellow states explicitly that this action does
not change condition truth.

When an actionable exact-room task already exists, the disclosure explains that no
duplicate was created and offers only **Open cleaning task** into the established
authoritative task-detail journey. Without exact create permission it remains a
read-only candidate. Otherwise the form provides detached active-staff Party search,
explicit **Choose** selection and deliberate **Create cleaning task**. Staff results
are limited to canonical Party id, permitted display name and the existing `staff`
role; no contact, guest, note, payload, workload or inferred assignment is rendered.

Submission sends only the selected `attendantPartyId`, retains one idempotency key for
an unchanged reservation/attendant draft and locks related controls in flight. The
browser paints no optimistic task or room state. A successful create-or-return
refreshes the authoritative Housekeeping board and opens exact task detail. A current
failure preserves the unchanged retry key and reports it in the live status region;
late responses become inert when the property, route, blocker, reservation, assigned
room, return object, section containment or request generation changes. There is no
polling or browser storage.

The section, live status, staff results, selection and actions remain contained at
375 pixels and 200% zoom. Controls are at least 44 pixels and Android raises them to
48 pixels. Apple iOS uses a layered translucent system card, Android uses Material 3
shape/elevation and tonal results, Windows 95/98 uses square outset/inset system
chrome, glassmorphism uses saturated translucent blur, neomorphism uses paired raised
and inset shadows, and ERP uses compact rectangular density. All six appearances
preserve the same semantic order and task authority. Keyboard selection and focus are
explicit, reduced motion removes nonessential movement, and forced colours replace
decorative materials with system boundaries.

## 36. Arrival cleaning-task return to check-in preparation

Only exact task detail opened by the Order-229 existing-task or create-or-return
result carries arrival meaning. Its minimized frozen history descriptor binds the
current property, reservation and confirmation, due-in status, exact
`dirty_room_override_unauthorized` blocker, assigned room and original room
condition, canonical `?workbench=check-in` origin, exact cleaning-task identity and
the current detail, readiness and navigation generations. Direct Housekeeping,
generic task cards and coincidentally matching room or task identifiers never adopt
that descriptor.

Contextual task detail presents one native semantic **Back to arrival** button while
work remains. Only the exact authoritative task response reporting both `done` and
room condition `clean` relabels the same destination **Continue check-in
preparation**. The label is guidance, not a readiness claim: task status cannot prove
check-in readiness, and the browser neither predicts readiness nor runs a check-in or
task transition automatically.

Start, Complete and Verify keep their established governed endpoints, request bodies,
idempotency and server refresh. The arrival descriptor survives assigned,
in-progress and done refreshes when every bound identity remains current; errors and
conflicts stay on task detail. Verify may return to the board while preserving only
the exact board-to-arrival continuity. Browser Back and Escape retain their existing
detail-to-board behavior. Refresh and Forward may reconstruct contextual detail only
from an exact valid descriptor.

Deliberate activation reuses the canonical reservation return with
`?workbench=check-in`. Yellow refetches reservation detail and server readiness, then
focuses the exact blocker action if it still exists or the safe check-in heading when
it does not. There is no new endpoint, readiness inference, optimistic room state,
automatic navigation, polling, browser storage or new authority.

The contextual action reuses the established Housekeeping arrival-return material:
at least 44 pixels, 48 pixels on Android, wrapping within 375 pixels at 200% zoom.
Apple iOS, Android, Windows 95/98, glassmorphism, neomorphism and ERP retain their
dedicated native presentations without changing label semantics or reading order.
The native button is keyboard operable with explicit visible focus; reduced motion
removes nonessential transforms and transitions, and forced colours replace
decorative materials with system button colours and boundaries.

## 37. Due-in room assignment from check-in preparation

The assignment disclosure appears only for the exact current
`room_assignment_missing` blocker on canonical reservation detail with
`?workbench=check-in`. Property, reservation, confirmation, due-in status, blocker,
detail/readiness generations, route and section containment must all remain current.
Direct inventory navigation, another blocker, stale history or a detached disclosure
shows no assignment action. Opening the disclosure performs only the exact no-store
reservation-scoped candidate GET.

Each candidate renders only sellable-unit name, physical room code, nullable floor
and the recorded nullable room-condition evidence. Yellow labels condition as current
evidence, never as availability or readiness: a null, dirty, pickup, clean or inspected
value cannot make the browser hide, admit or rank a server-returned candidate. Price,
guest, contact, hold, occupancy and internal mapping detail are absent. The operator
must deliberately choose one candidate and activate **Assign room**; there is no
default, automatic alternate, batch allocation or drag-to-assign behavior.

Submission binds the exact frozen reservation, segment, status, unit type, period,
prior null assignment and selected sellable unit, retains one idempotency key for an
unchanged draft and locks related controls in flight. The browser paints no optimistic
assignment, condition or readiness. A conflict remains in the disclosure with one
authoritative refresh path. A current success refetches canonical reservation detail
and check-in readiness, then focuses the next exact blocker action or the safe check-in
heading. Assignment never runs check-in automatically.

Late results are inert after any property, route, reservation, blocker, candidate,
selection, descriptor, section or generation change. Browser Back returns to the
unchanged check-in preparation view; refresh/Forward reconstruct only from valid
canonical state. There is no polling or browser storage. Candidate selection and
actions remain keyboard operable with visible focus, at least 44 pixels, 48 pixels on
Android, and contained at 375 pixels and 200% zoom. All six current appearances,
forced colours and reduced motion preserve identical semantic order and authority.

## 38. Checkout-to-Housekeeping return continuity

Only an exact current governed checkout result with the matching reservation,
`checked_out` parent, `departed` segment, canonical assigned room and exactly one
released occupancy claim admits the transient completion context. The browser retains
only property, reservation, confirmation, assigned room, fixed expected statuses,
plain reservation-detail origin path and authoritative detail generation. It discards
timestamps, periods, folio counts, segment identity and every readiness or room-state
inference.

After canonical checked-out reservation detail is authoritatively refreshed, one
semantic **Review room in Housekeeping** action appears in that completion context.
Detached, stale, replaced, wrong-property, wrong-reservation, wrong-status, wrong-room,
query-bearing or generation-mismatched controls are inert. The action creates one
history entry, opens the existing Housekeeping condition-board route and performs only
its existing read. It focuses the exact authoritative assigned-room card when present,
or the safe Room conditions heading otherwise. It neither filters room truth nor
claims the room is dirty, clean, inspected, discrepant or awaiting work.

Back, Escape and browser Back/Forward return to canonical plain checked-out
reservation detail, refetch current truth and focus the regenerated action or the safe
reservation-detail heading. Refresh reconstructs only an exact bounded history
descriptor; direct Housekeeping remains unchanged. No checkout replay, condition or
task mutation, polling, browser storage, automatic cleaning consequence or new request
family is introduced.

## 39. Deliberate room discrepancy reporting

The canonical Housekeeping condition board includes a distinct **Room observations**
region. It loads the exact no-store unresolved-discrepancy read independently from
condition paging. Each current card exposes only room code, nullable floor,
`Sleep|Skip|Person`, canonical reported/system values, reporter and server-recorded
time. It never renders guest, reservation, segment or occupancy identity and never
labels a condition or task as discrepant.

**Report room observation** is a semantic form with explicit room selection,
`Occupied|Vacant` presence and persons `1..99` only while occupied. Nothing is
preselected and there is no inferred observation, optimistic discrepancy, automatic
submission, polling or browser storage. Submission retains one idempotency key for
the unchanged draft, locks related controls in flight, then authoritatively refreshes
both the open-discrepancy list and current condition board. Matching truth explains
that no discrepancy was created. An existing changed open report stays a conflict;
the browser never offers resolve, edit, delete, carry, queue or message actions.

Property, active Housekeeping view, route, connected form, selected room and request
generation participate in stale-response rejection. Changing room or presence
invalidates the prior persons value and retry identity. Late or detached responses
are inert. Status uses a polite live region; validation errors focus the exact field,
and successful current refresh focuses the matching open card or the region heading.

The form, list and messages stay contained at 375 pixels and 200% zoom. Controls are
at least 44 pixels and 48 pixels on Android. Apple iOS, Android, Windows 95/98,
glassmorphism, neomorphism and ERP keep their dedicated materials while preserving
identical labels, reading order and authority. Keyboard focus is visible, reduced
motion removes nonessential transitions and forced colours replace decorative
materials with system boundaries.

## 40. Vehicle parking assignment

Canonical vehicle detail loads one separate no-store parking snapshot. An eligible
unassigned onsite reservation-linked vehicle exposes an explicit **Parking space**
picker containing only server-returned active exact-property candidates and an
**Assign parking** action. Nothing is preselected; room spaces, inferred alternatives,
automatic ranking, replacement, release and optimistic parking state are absent.

Submission binds property, vehicle, route, current snapshot, selected parking-space
identity and one unchanged-draft idempotency key. Related controls lock in flight. A
current success authoritatively reloads vehicle detail and parking truth before
painting the assignment; a conflict offers only authoritative refresh. Any property,
route, vehicle, selection, connection or generation change makes a late response
inert. Direct vehicle detail, Back/Forward and refresh rebuild only from canonical
server truth without polling or browser storage.

Labels, status and validation remain keyboard-readable and announce through the
existing live region; invalid selection focuses its control and success focuses the
assigned parking summary. Controls are at least 44 pixels and 48 pixels on Android,
remain contained at 375 pixels and 200% zoom, and preserve identical semantic order
across Apple iOS, Android, Windows 95/98, glassmorphism, neomorphism and ERP. Reduced
motion removes nonessential effects and forced colours supplies system boundaries.
