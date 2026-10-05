# Reservation workspace and God Eye — founder follow-on, 2026-09-24

Order 680 discovery, not delivered functionality. Existing single live application
and documented module authorities remain; no second PMS or new platform rewrite.

## Reservation workspace recommendation

One Front Office workspace with shared universal search, journey ribbon
**Pre-arrival | Arrivals | In-house | Departures | Departed**, and **List | Room
calendar | Groups** views inside the same shell. Primary actions: **New reservation**
and **New group/block**. Pre-arrival means future due-ins; Arrivals/Departures use
the property's current business day. Historical departures remain accessible.

Reuse `ReservationWorkspace`, `MovementGrid` filters/sorting/columns, `HotelSearch`
and existing individual booking commands. `GroupBlockWorkbenchPanel` currently
exposes read-only block/pickup/remaining and rooming-list evidence; do not advertise
editable group creation as complete. `rooms.plan-timeline` is a preview, not a
governed availability/assignment calendar. UI-SPEC already describes group and
calendar workspaces. Follow existing URL/drawer/workbench conventions rather than
introducing a disconnected modal application.

### Official reference comparison

| Reference | Useful observed pattern | Yellow application |
|---|---|---|
| [OPERA reservations](https://docs.oracle.com/en/industries/hospitality/opera-cloud/23.5/ocsuh/ch_reservations.htm), [blocks](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.1/ocsuh/ch_blocks_intro.htm), [room diary](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.5/ocsuh/t_booking_reservations_creating_a_room_diary.htm) | Structured search, journey queues, group allocations/pickup and room/date diary | Keep operational depth under one consistent shell |
| [Mews Timeline](https://help.mews.com/s/article/Managing-reservations-on-the-Timeline), [rooming list](https://help.mews.com/s/article/manage-group-reservations-with-a-rooming-list) | Visual room/category timeline, group rooming-list management | Clear assignment/unassigned states and group drill-down |
| [Beds24 calendar](https://wiki.beds24.com/index.php?title=Dynamic_Multi_Calendar), [groups](https://wiki.beds24.com/index.php?title=Group_Bookings) | Customizable multi-calendar, room/date entry, linked individual bookings; drag/drop optional | Saved views and efficient creation, without accidental drag mutations |
| [Protel room plan](https://connect.protel.net/files/source/pairexthelp/en_US/res-zimmerplan.htm), [groups](https://connect.protel.net/files/Source/pairexthelp/en_US/ht-gruppenreservierungen.htm) | Room-plan search/navigation and group master/member approach | Integrate group context with room planning; documentation is older and warns UI changed, not a verified current screenshot |
| [Airbnb calendar](https://www.airbnb.com/help/article/447), [blocked dates](https://www.airbnb.com/help/article/3612) | Simple date-range selection on desktop/mobile and explanations for blocked dates | Touch-friendly selection and understandable reasons; not a substitute for hotel block/assignment depth |

This is a targeted comparison of requested systems, not an exhaustive audit of
every PMS or a claim any one product is universally best. Product names are
research references, not labels to place in Yellow's guest/staff UI.

### Required acceptance journeys

1. **Individual:** dates, party/profile and offer → current availability/policy
   validation → explicit confirmation → reservation deep link; preserve draft on
   conflict, denial or uncertain retry.
2. **Group:** dated room-type allocation, existing governed deduct/non-deduct and
   cutoff policy → block → pickup → rooming-list validation with row errors and
   idempotent retry; allocation, pickup and remaining must reconcile. First audit
   existing commands; do not invent unsanctioned occupancy writes.
3. **Calendar:** room/room-type × date grid with sticky labels, Today/previous/next,
   date navigation, filtering and saved route state. Free-cell selection starts
   existing reservation flow; booked-cell selection opens existing detail.
4. **Assignment:** separately represent occupancy, housekeeping/readiness and
   out-of-service; explain ineligibility. Preview moves, then authoritative server
   validation. Stale data refreshes on conflict; no optimistic sellability promise.
5. **Mobile:** compact agenda/single-room calendar or contained touch-scroll,
   accessible controls and 44–48px targets; preserve filters/drafts and avoid whole
   page horizontal overflow. All actions have keyboard equivalents.

## God Eye ecosystem requirement

One guest/tourist discovery map should bring together clearly labelled layers:

- **Geography/reference:** Overture places and boundaries now; other map themes
  only when deliberately integrated. Public POIs are not registered vendors.
- **Stays:** authorized hotel/STR/BnB listings, property details and nearby options;
  bookable availability/rates come from authoritative inventory, not Overture.
- **Registered vendors:** self-registration page, business/location/contact
  profile, service area and editable catalogs for cab/concierge/laundry, restaurant
  menus, groceries and other services. Verification/approval states must be honest.
- **Guest journey:** reach the stay, discover service, inspect terms/menu/options,
  request/order, receive confirmation and track assignment/progress/escalation.
  Reuse shared CRM/tasks and staff workflows where contracts support them.
- **Directions:** a real routing engine/provider or clearly labelled external
  navigation handoff. Straight-line distances or building/road shapes are not
  turn-by-turn directions; travel-time claims require measured routing evidence.

Audit existing Order472/God Eye artifacts before replacing anything. Keep private
guest/staff data out of the public map; use tenant-scoped authorization and minimal
vendor disclosure. Public geographic completeness is not commercial availability.

Vendor approval rules, commissions, merchant/payment responsibility, refund policy
and guest-data access are not decided by this intake. Reuse approved policy or get
founder direction before enabling real registrations/orders/payments. Prepare
narrow implementation orders and independent executable proofs for new tables,
events, tenant boundaries, bookings, payments and other high-risk state changes.
