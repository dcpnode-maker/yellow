# Hospitality UX benchmark

**2026-09-05 · Order440 · Primary-source desk research.** Sources were accessed on
2026-09-05 from each vendor's help centre or developer documentation. This is a review of
published product documentation, not first-hand use, a usability test or a claim about
Yellow's shipped capability. “Evidence” below describes the cited product. “Yellow
proposal” is an original design inference to test with hotel staff. No performance gain
is asserted without measurement. Oracle examples span the linked OPERA22.2–25.3
and Simphony19.7/19.8 documentation; this review does not assert identical behavior
in every version, property configuration or vendor plan.

## What the documented products make fast

| Product and primary evidence | Documented interaction | Yellow proposal (inference) |
|---|---|---|
| **Mews Operations** — [Dashboard](https://help.mews.com/s/article/your-dashboard?language=en_US), [Timeline](https://help.mews.com/s/article/timeline?language=en_US), [mobile app](https://help.mews.com/s/article/download-the-mews-operations-mobile-app?language=en_US) | The dashboard groups tasks, reservations, spaces, customers, occupancy and finance. The Timeline orders bookings by space type and number; selecting one opens booking detail at the right. The mobile app supports messages, housekeeping and tasks. | Make the shift home a queue, not a report gallery. Selecting a row should open a right-side context panel without losing filters or scroll. On phones, expose the next owned action, due time, blocker and acknowledgement; do not squeeze the full desktop navigation into a small viewport. |
| **Cloudbeds PMS** — [Daily Operations Guide](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/40771665486363-Your-Cloudbeds-PMS-Daily-Operations-Guide), [check-in/out](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/221677468-Check-in-and-check-out-guests-in-Cloudbeds-PMS) | The documented start-of-shift view surfaces arrivals, departures, in-house guests, overbookings and unassigned rooms. Notes, folio and messages open from operational lists. Check-in is available from several contexts, while room assignment and date/status rules still constrain eligibility. | Put property, business date and unresolved counts above the queue. Let the same governed command be reachable from a dashboard, reservation and room board, with identical permission and validation behavior. Show why a row is ineligible before a batch action; keep group scope and individual-guest scope explicit. |
| **Apaleo** — [Front Desk training](https://apaleo.zendesk.com/hc/en-us/articles/14854495139484-Training-Kit-Front-Desk), [folios and invoices](https://apaleo.zendesk.com/hc/en-us/articles/14854524471964-Training-Kit-Folios-and-Invoices), [group charge routing](https://apaleo.dev/guides/business-cases/groups-and-blocks/manage-charges.html) | Room assignment is available from the rack, reservation and list; room state includes clean, dirty and inspection. Housekeeping lists can be filtered by condition, occupancy, stay status, maintenance and attributes. Folios distinguish guest, booking, external and house use; routing applies to future charges and does not move already-posted charges. | Keep room condition, observed occupancy, assignment and sellability as separate fields with evidence time. In finance, label the payer, folio, routing effective point and posted/unposted status. Changing a routing rule must preview future effects and must never imply that historical postings moved. Privileged refund or split actions need role checks and a receipt. |
| **Oracle OPERA Cloud** — [batch room assignment](https://docs.oracle.com/en/industries/hospitality/opera-cloud/22.5/ocsuh/t_front_desk_batch_room_assignment.htm), [check-in](https://docs.oracle.com/en/industries/hospitality/opera-cloud/22.2/ocsuh/t_checking_in_reservations.htm), [event resources](https://docs.oracle.com/en/industries/hospitality/opera-cloud/25.3/ocsuh/ch_osem_about_event_resources.htm), [event changes](https://docs.oracle.com/en/industries/hospitality/opera-cloud/23.1/ocsuh/t_viewing_the_events_changes_log.htm) | Batch assignment can filter eligible arrivals and use room condition criteria. Check-in can use property-configured steps. Event resources bring menus, items, quantities, revenue and notes into one working area, while event change history is separately available. | Batch mode should show eligible, excluded and selected counts, exclusion reasons, a preview and an outcome receipt. For events, make BEO/version identity persistent in the header. Show only changed fields to affected departments, require acknowledgement of that exact version, and retain prior versions as evidence. Property-specific check-in steps belong in configuration, not hard-coded universal flow. |
| **Oracle Simphony** — [PMS interface specification](https://docs.oracle.com/en/industries/food-beverage/simphony/19.7/spmsa/G11054_01.pdf), [POS error messages](https://docs.oracle.com/en/industries/food-beverage/simphony/19.8/sipou/c_error_messages.htm) | A room-charge exchange can be accepted, denied with a reason, or require positive account identification; room shares can yield choices. A timeout may leave an operator needing to retry, and a PMS partial tender already posted cannot be treated like a simple local void. | Use four visible outcomes: accepted, denied, ambiguous account and outcome unknown. The recovery panel should retain original request ID, outlet/check, amount/currency, candidate stay/folio and reconciliation owner. Retry must use the original identity; an unknown result remains unsettled until queried or reconciled. Never offer a casual “undo” after a remote acceptance. |
| **Zenoti** — [Appointment Book](https://help.zenoti.com/en/appointments/redesigned-appointment-book.html), [appointment information](https://help.zenoti.com/en/appointments/daily-tasks/book-appointments/book-appointments-using-appointment-info-panel.html), [mobile booking](https://help.zenoti.com/en/zenoti-mobile/zenoti-mobile-v2/book-an-appointment-in-zma-v2.html), [OPERA integration](https://help.zenoti.com/en/integrations/opera-on-premise.html) | Focus mode emphasizes one guest's services while dimming others. Booking can require provider, room and equipment, and mobile booking includes review and prerequisites. Hotel integration supports finding a guest by room or name before charging the room. | Treat a spa booking as a resource claim: service, provider, room/equipment, start, duration and prerequisite status. The schedule needs focus mode plus conflict explanation. Front desk should see “prerequisite complete/restricted” rather than sensitive answers. Service completion, folio posting and refund/correction must remain distinct events. |

## Screen rules to carry into Yellow

1. **Start with obligations.** The first viewport should show property and business
   date, the signed-in role, arrivals/departures/in-house scope, unassigned or blocked
   work, and the next deadline. Totals must drill into the exact filtered rows that
   produced them.
2. **Preserve place while adding context.** A row opens a drawer with guest promise,
   operational facts, current owner, latest acknowledgement, version, evidence time
   and permitted actions. Closing it restores focus to the originating row.
3. **Use actions as governed adapters.** Reaching check-in, assignment or posting
   from several screens may shorten navigation, but every entry point must call the
   same authorized domain command. Disablement includes a reason and recovery route.
4. **Design retries before celebration.** Network and provider boundaries need
   pending, rejected, ambiguous and confirmed states, stable idempotency identity,
   last-attempt time and an accountable reconciliation queue.
5. **Separate facts that change independently.** Clean is not inspected; vacant is
   not assignable; delivered is not billed; service complete is not settled. Colour
   may reinforce state, but text and evidence must carry the meaning.
6. **Measure the proposed efficiency.** In staff walkthroughs, capture time and
   interaction count for finding an arrival, assigning an eligible room, acknowledging
   a BEO revision and resolving a room-charge timeout. Also record wrong-role blocks,
   stale-version attempts, focus restoration and recovery without duplicate effects.
   These are measures to collect, not targets or results.
7. **Make urgency selective.** Use a calm neutral base for stable facts, one strong
   treatment for the selected context, and text-labelled semantic states. Reserve
   intrusive colour and motion for work that is blocked or newly urgent. Align money,
   quantities and times for scanning; keep evidence timestamps visually secondary but
   available. This is a proposed Yellow visual hierarchy, not a finding about measured
   staff preference.

## Reuse and capability boundary

The cited pages are references for workflow and information hierarchy. This bounded
review did not verify an open licence for any vendor screenshot, icon, logo, layout or
product asset, so none is recommended for reuse. Yellow should create original visual
assets and composition from its own design tokens while applying the abstract patterns
above. The dashboard, event, outlet and spa proposals remain design requirements;
documentation and a fictional prototype do not prove their APIs, commands,
integrations or operational behavior are built.
