# Selectable light interfaces

**Status:** Approved mockup direction; Order458 application fidelity REJECTED by the
founder. Its technical browser tests proved preservation, not visual acceptance.
Order459 has corrected the source screen composition and grouped navigation and
passed scoped browser/source checks. Founder visual acceptance is still pending;
publication/local promotion have not occurred. The signatures below are design
intent and never confer new routes, permissions or commands.

## Grouped navigation reference

The founder supplied [Hotel PMS](http://pms-test-alb-901282387.ap-south-2.elb.amazonaws.com/).
On2026-09-09 its publicly served navigation catalogue groups Overview, Operations,
Guests, Property, Finance and Insights. Yellow adopts the clear job-based grouping,
not its source code or unavailable modules. All15 original Yellow navigation nodes
remain: Front desk (Today, Availability, Reservations); Finance (Folios, Invoices,
Cashiers, Day close, Owner trust); Property (Room outages, Housekeeping, Vehicles);
Rates & inventory (Inventory setup, Restrictions, Rates); System (Project status).
Native disclosures expose each group; the active route reveals its group. There
is no catch-all More workspaces overlay or separate Simple/Expert hierarchy.

## Implemented source composition — Order459

These are actual mounted UI structures, not proof that the entire design-intent
table below has shipped. Today and issued-invoice list/detail were exercised in
the real browser using fictional HTTP fixtures, with no live hotel/database data.

| Interface | Implemented composition |
| --- | --- |
| Ledger | Two-row desktop workflow rail; aligned invoice queue/detail and side-by-side Today lanes. Native exclusive submenu avoids a tall empty menu. |
| Aura | Independent glass context rail, floating search surface, offset queue/detail leaves and stepped Today panels. |
| Relay | Compact light department rail, numbered contiguous dispatch stages, compact record tickets and detail-weighted invoice split. |
| Journey | Numbered workflow index; Today-only chapter tabs show one retained lane at a time; invoices retain their own queue/detail without unrelated arrival tabs. |
| Orbit | Compact workspace launcher reveals the five real groups; operational panels surround the central workspace. No AI processing is simulated. |
| Atlas | Floating property-context index, asymmetric Today mosaic and offset invoice queue beside a larger factual detail surface. No map or extra property data is fabricated. |
| Focus | Narrow task rail, ordered full-width task sections and a control that focuses an existing enabled task control. |
| Index | Dense contiguous planning columns, compact navigation and restrained grid surfaces. This does not create a room/date tape. |

All modes preserve the existing routes, controls, unsaved filter, selection,
record nodes, permissions and request counts when switching. At compact widths,
navigation becomes a bounded native disclosure; keyboard, reduced motion and
forced colours remain supported. This is responsive web UI, not native iOS/Android.
Root final browser capture run:1/0,1,143 assertions. These checks are technical
evidence, not founder design approval. See `.yellow/evidence/order459/ACCEPTANCE.md`.

## One application, eight presentations

Every interface renders the same authorized Yellow application. Changing an interface
may change composition, density, material, navigation placement, and transition
grammar. It must not recreate a form, refetch merely to switch appearance, change a
route, infer a permission, replace an identifier, clear a draft, reorder a financial
fact, or manufacture operational state.

The selectable names are exactly **Ledger, Aura, Relay, Journey, Orbit, Atlas, Focus,
and Index**. The two rejected explorations remain outside the selector. Relay and
Journey reinterpret the useful handoff and guided-workflow ideas from their prototype
predecessors; neither ships a prototype skin or simulated progress.

All eight are light interfaces; no dark-mode or dark-dominant shell is in scope.
Local contrast controls must not overturn the light working canvas, forms, tables, and
review surfaces. The designs are original Yellow compositions, not copies of provider
screens, prototype markup, or third-party assets.

## Structural signatures as design intent

These signatures describe the direction for each presentation, not capabilities
created by a skin. Order458 modes recompose and style the already-built web workspaces
only. Index does not itself implement a room/date tape, Atlas does not add property or
geographic data, and Orbit does not add an AI request, evidence, or proposal engine.
Where the current application lacks the named data or workflow, the interface leaves
it absent instead of mocking it. None of the modes is a native application claim.

| Interface | Primary job | Design-intent signature before colour | Depth and transition rule | Compact behavior |
| --- | --- | --- | --- | --- |
| **Ledger** | Inspect a reservation, guest context, and folio together | Dense master list, factual record, and financial detail form three aligned panes | Selection advances list → record → folio; money stays on the sharpest opaque plane | One pane at a time with a persistent breadcrumb/back trail and unchanged selection |
| **Aura** | Hold several live contexts without losing the active one | A calm central work surface with two visibly subordinate context leaves | Translucency separates context from action; the active leaf sharpens and rises without animated blur | Context leaves become labelled sheets; only one editable sheet is exposed |
| **Relay** | Coordinate accountable handoffs | Work enters an owned queue, crosses a clear handoff seam, and lands with the next owner | Motion represents an actual server state change or navigation only; waiting is a labelled state, never a moving progress prop | Ordered task feed with owner, due time, blocker, and next permitted action |
| **Journey** | Complete a multi-step staff conversation safely | A chapter index surrounds one active task and a persistent evidence summary | Chapters reveal validated dependencies; completion comes only from source truth, not a client-side meter | Vertical chapters with current, available, blocked, and completed states stated in text |
| **Orbit** | Move from a request to evidence and a bounded proposal | Request, evidence, and proposed action form three distinct zones | A proposal can approach review only after real evidence exists; no pulsing “AI thinking” or invented completion | Evidence precedes the action; long responses collapse behind accessible disclosure |
| **Atlas** | Scan a multi-property or distributed-unit portfolio | Portfolio hierarchy plus spatial grouping and a factual detail rail | Spatial position may express verified hierarchy or coordinates only | Becomes region/property lists and exception cards; geography is optional |
| **Focus** | Finish one role-specific task on a phone | One task, one context header, one reachable primary action, and a short evidence trail | Local transitions retain scroll, draft, and focus; no desktop canvas is scaled down | This is the compact web composition and remains useful at wider widths |
| **Index** | Plan against time, units, and exact reservations | A room/date tape, fixed labels, selected interval, and contextual detail | Selection lifts an interval into review while source rows and dates remain anchored | Horizontal tape uses bounded internal scrolling with a parallel chronological list |

## Shared spatial system

Depth communicates decision consequence, never decoration.

| Plane | Token | Meaning | Content rule |
| --- | ---: | --- | --- |
| Context | 0 | Property, date, role, and route environment | Non-editable orientation only |
| Truth | 10 | Server-derived lists, records, balances, and statuses | Values remain readable without effects |
| Navigation | 20 | Interface, module, property, tab, and chapter movement | Never impersonates a business action |
| Work | 30 | Active form, selection, or task | Retains exact control identity and draft values |
| Review | 40 | Derived preview and explicit acknowledgement | Names affected entities and the proposed change |
| Critical | 50 | Destructive, financial, statutory, or uncertain result | Opaque, interruptible, and impossible to dismiss accidentally |

No interface invents another z-layer. A raised surface must correspond to a stronger
decision or a selected object. Shadows, translucency, scale, and perspective may
support that relationship but never replace labels, borders, focus, or status text.

## Truth and safety rules

- The gallery selector changes presentation only. The current route, property,
  authenticated actor, form values, hidden/disabled states, draft identity,
  validation, focus origin, and pending request remain intact.
- Every processing, recommendation, transfer, sync, and completion state comes from
  the application. A timed animation cannot advance operational state.
- **Atlas is not permission to draw a fictional map.** Use a geographic view only
  when authorized source coordinates and an appropriate map asset are available.
  Otherwise render portfolio hierarchy, locality labels, or a spatial mosaic with
  list parity.
- **Orbit is not permission to simulate AI work.** It may show an actual request,
  retrieved evidence, a completed model response, or a prepared command. Unknown,
  unavailable, and delayed states remain literal.
- Financial amounts remain server-rendered strings. Presentation code performs no
  money, tax, availability, score, or progress calculation.
- Relay and Journey show blocked and unavailable steps without making them look
  complete. A dependency can be navigable without being executable.
- Interrupting a transition settles immediately to the latest application state.
  Reduced motion uses an immediate change or a crossfade no longer than 100 ms.
- Keyboard and pointer users receive the same available actions. Escape closes the
  gallery and restores focus to its invoker; arrow-key or tab behavior follows the
  control's declared pattern rather than visual position.
- Forced colours removes material effects and preserves hierarchy with system colour,
  borders, text, and focus. No information exists only in transparency, blur, hue,
  hover, map position, or motion.

## Source-informed interaction patterns

Official provider documentation is used as evidence of useful interaction problems,
not as a visual template:

| Observed problem | Yellow interpretation |
| --- | --- |
| Airbnb distinguishes “sync everything” from “pricing and availability,” permits some Airbnb-side overrides, and exposes last-edit provenance. [Airbnb software sync choices](https://www.airbnb.com/help/article/2348) | Show field ownership and last authoritative source beside affected controls. Never make “connected” imply full ownership. |
| Airbnb groups minimum/maximum stay, advance notice, preparation time, availability window, and weekday arrival/departure restrictions around the calendar. [Airbnb availability](https://www.airbnb.com/resources/hosting-homes/a/updating-your-availability-708) | Index and Atlas keep date context visible while presenting each restriction as a separate semantic value. |
| Booking.com separates room type, rate plan, roomrate, inventory, pricing model, and restrictions; overlapping restrictions can silently remove availability. [Booking.com pricing types and restrictions](https://developers.booking.com/connectivity/docs/understanding-pricing-types) | Ledger and Index disclose mapping scope and conflicts before a publish action. Product and inventory are not flattened into a single row toggle. |
| PriceLabs separates reviewing recommendations from enabling or manually triggering synchronization. [PriceLabs synchronization](https://help.pricelabs.co/portal/en/kb/articles/how-often-are-my-rates-sycned-to-my-pms-and-how-does-sync-now-work) | Orbit separates evidence, recommendation, approval, publication, and read-back. A recommendation never looks published. |

## Gallery contract

The gallery is an interruptible presentation chooser, not an application reset.

1. Opening records the invoker and current interface and changes neither.
2. Hover and focus depth affect only the abstract interface miniatures. They never
   preview a mode on the application root or alter the existing selector.
3. Clicking a card immediately chooses its exact allowlisted value through the
   already-built pure selector and closes the gallery. There is no separate Apply
   operation.
4. Escape or Close before a card selection leaves the current interface unchanged and
   restores focus to the gallery invoker. There is no cancel/revert transaction.
5. Authentication expiry or navigation follows the application's existing behavior;
   the gallery never introduces a pending presentation state.
6. On compact screens the choices remain one readable labelled list; miniatures are
   illustrative and never substitute for the actual workspace.

## Review matrix

Each interface must pass the same evidence at desktop, tablet, and phone widths:

- available presentation structure expresses its design intent in greyscale without
  inventing an absent workflow or data source;
- no root overflow, clipped task, hidden error, or unreachable primary action;
- presentation switching preserves semantic controls, values, selection, focus,
  routes, requests, and synthetic evidence byte-for-byte;
- reduced-motion, forced-colour, keyboard, coarse-pointer, and no-backdrop modes;
- no remote assets, copied provider layout, fictional map, simulated assistant
  progress, automatic business action, or optimistic financial state;
- all visible facts identify their source or remain explicitly synthetic in test
  fixtures and captures.

Prototype screenshots remain design history, not acceptance evidence. Order458 browser
proof must exercise the integrated application and its real presentation controller.
