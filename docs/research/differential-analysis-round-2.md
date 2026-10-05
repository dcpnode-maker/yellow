# Differential Analysis — Round 2

**Sources:** Cloudbeds developer documentation, OpenTravel/HTNG message specifications (via SynXis, Booking.com connectivity, LODGEA), hostel/alternative-accommodation PMS market analysis. All public, fetched 12 Aug 2026.
**Compared against:** `PMS-master-build-prompt.md` v0.1 + Round 1 findings.

---

## Summary

Round 2 found **two architectural problems** that Round 1 missed, and both come from the "support any kind of property" goal rather than from feature comparison.

The bigger one: **our slot model is flat, and it needs to be composite.** Bed-level inventory breaks it.

---

## G. Architectural findings

### G1. Slots must be composite, and sellability is a property of *configuration* ⚠️

The stress test was hostels, and the slot model doesn't survive it.

- A dorm bed is a sellable unit *inside* a room that is itself a sellable unit. <cite index="36-3">Traditional hotel systems treat a dorm room as a single unit, which means the highest-margin product is untracked.</cite>
- The same physical space is sold as **either** one private room **or** N individual beds, decided dynamically by demand. <cite index="35-1">Hostels routinely sell rooms as private or shared depending on demand.</cite>
- Selling one bed must remove the private-room product from availability, and vice versa. Neither is a simple decrement.

This is the same problem as a suite that is also two connecting rooms — which our spec listed as "virtual/component units" and waved at. Hostels make it the *primary* case rather than an edge case, which is what exposes it.

**Correct model:**
- A `Space` is physical. A `SellableUnit` is a *configuration* of one or more spaces.
- Configurations are mutually exclusive: consuming a slot in one configuration invalidates overlapping slots in all others.
- Availability is computed over configurations, not over rooms.

This is a **bigger change than the folio fix** and it touches the single hottest read path in the system. It has to be settled before the ERD.

### G2. "PMS is the system of record for inventory" is a configuration, not an assumption ⚠️

From the HTNG reservation-sync specification: <cite index="27-1">a hotel may choose either the PMS or the CRS as the system of record for inventory.</cite> <cite index="27-2">When the PMS holds that role, reservation uploads do not alter availability in the CRS and the PMS pushes inventory values explicitly; when the CRS holds it, the CRS derives availability itself and PMS inventory uploads are not supported.</cite>

Our spec assumes the PMS always owns inventory. That assumption fails the moment you sell to any branded or chain property — they run a CRS above you.

**Implication:** inventory authority must be a per-property, per-channel setting, with two distinct sync modes. Retrofitting this means rewriting the distribution layer.

### G3. Statistical denominators vary by property type

RevPAB (revenue per available *bed*) rather than RevPAR for hostels; per-square-metre and per-pitch metrics elsewhere. Our reporting spec hardcoded room-based statistics.

**Fix:** statistics defined over a configurable `capacity unit` per property type.

---

## H. Additional gaps

| # | Finding | Source | Action |
|---|---|---|---|
| H1 | **House accounts** exposed as a first-class API resource alongside reservations and guests | Cloudbeds | Third independent confirmation of Round 1's A1. The folio-belongs-to-account fix is settled — stop debating it. |
| H2 | **Accounting as a separate bounded surface** from operational finance | Cloudbeds | Split Financials into *operational* (folio, posting, settlement) and *accounting* (journal, transaction records, GL) contexts. |
| H3 | **Data residency / multi-region partitioning** as an explicit platform strategy | Cloudbeds | Directly relevant to your infra-cost model and to GDPR/Gulf data-localisation. Design tenancy with region as a dimension from the start — retrofitting residency is brutal. |
| H4 | **Gender-restricted and mixed dorm rules** | Hostel market | Assignment constraints as configurable predicates, not hardcoded fields. |
| H5 | **Fragmentation-minimising assignment** — allocating beds/units to avoid unsellable gaps | Hostel market | This is a genuine optimisation problem (bin-packing), not a lookup. Real target for the intelligence layer, and a visible differentiator. |
| H6 | **Bed-level inventory is not expressible to OTAs** — <cite index="36-4">channels don't understand it, forcing manual bed blocking or room-only selling</cite> | Hostel market | Distribution needs an **aggregation layer** that projects internal inventory onto whatever granularity a channel supports. Applies well beyond hostels. |
| H7 | **Push vs pull reservation delivery** — pull exists for systems not permanently connected | OpenTravel | Reinforces the offline design. Support both delivery modes. |
| H8 | **Reservation import as a distinct action type**, separate from create/modify/cancel | HTNG | Directly supports migration-as-a-product. Import must not fire the side effects that a real booking fires. |
| H9 | **Blended distribution** — the same booking arriving via multiple intermediaries | Industry | Deduplication and true-source attribution requirements in the ingestion layer. |
| H10 | **Minimum contracted rooms** — channels can reject or silently amend inventory below a contracted floor | Booking.com connectivity | Channel-side constraints must be modelled locally, or your pushes get amended without you knowing. |
| H11 | **Scope-based OAuth per endpoint** with user-visible permission grants | Cloudbeds | Our API spec had auth but no granular scope model. Needed for a partner marketplace. |
| H12 | **GraphQL alongside REST** | Cloudbeds | Worth considering for the dense read screens (tape chart, availability grid) where REST over-fetches. |

---

## I. Revised risk assessment

Two of the three highest-cost-to-retrofit decisions have now changed from what v0.1 assumed:

1. **Folio ownership** (Round 1, A1) — was wrong, now settled by three independent sources.
2. **Slot compositeness** (G1) — was wrong, and is the more expensive of the two.
3. **Inventory authority** (G2) — was an unstated assumption, now a required configuration axis.

None of these would have surfaced from a feature checklist. They surfaced from testing the model against property types and integration topologies the spec claimed to support.

**This is the argument for stress-testing over enumeration:** a feature list tells you what to build; testing the model against unusual cases tells you whether what you've designed can hold it.

---

## J. Open question raised for you

"Support any kind of property" needs a boundary drawn, because these are not free:

- **Hotels, hostels, serviced apartments, STR** — one composite-slot model covers all four. Cheap once G1 is done.
- **Campgrounds, marinas, glamping** — add pitch/berth geometry, utility hookups, vehicle dimensions. Moderate.
- **Coworking, venues, healthcare, student housing** — different billing cycles, tenancy law, and regulatory regimes. Expensive, and arguably a different product.

My recommendation: design the slot model to cover the first two groups, and explicitly exclude the third from v1 rather than leaving it vague. An abstraction that claims to cover everything usually serves nothing well.

---

## K. Next actions

1. **Resolve G1** — composite slot / space-vs-sellable-unit model. Blocks the ERD.
2. **Resolve G2** — inventory authority as configuration.
3. Apply Round 1 A1 (folio↔account) — now settled, no further debate needed.
4. Draw the property-type boundary (§J).
5. Produce master prompt v0.2 incorporating Rounds 1 and 2.
6. Then the ERD.
