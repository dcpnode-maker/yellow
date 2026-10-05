# Order 680 — Reservation workspace and God Eye follow-on intake

RESEARCH / INTAKE — 2026-09-24. Follows bounded live-map Order 679. This is not
permission to silently widen 679 or a claim these workflows are already built.

## Founder requirements

1. Existing reservation workspace must visibly include creation of an individual
   reservation and a group reservation/block, plus a calendar comparable to strong
   PMS room grids and Airbnb's calendar. Research official OPERA, Mews, Beds24,
   Protel/Planet and Airbnb flows; reuse existing Yellow commands/screens, not a
   disconnected second application. Keep shared search, advanced sort/filter,
   journey ribbon and responsive same-screen navigation.
2. God Eye is the comprehensive guest/tourist map for locating a hotel, STR or BnB,
   reaching it, exploring nearby stay options and discovering local services.
   Overture is a reference layer, not the whole God Eye product.
3. Retailers/vendors need a registration page and editable service/product
   listings: cabs, concierge, laundry, restaurant menus, grocery shops and other
   services guests can use. Reuse common guest request/order/status and staff
   assignment workflows where applicable.
4. Distinguish public map POIs from actual registered vendors and explicitly
   bookable inventory. Overture presence does not prove registration, verification,
   availability, price, hotel affiliation or ability to fulfil orders.

## Scope (read-only discovery and documentation only)

- Read existing reservation, group/block, calendar, CRM/task, product/service,
  vendor/party, finance and map modules and their documented contracts/decisions.
- Research official product documentation, with direct references and explicit
  observed-versus-proposed distinctions. No private data sent to external models.
- Write `docs/product/RESERVATION-AND-GOD-EYE-FOLLOWON.md`, this order, associated
  receipt/review if needed and ledger/current-status pointers. No application code,
  migration, installation, external API billing, publication or live hotel writes.
- Preserve existing Order472/God Eye artifacts; audit reusability before replacement.

## Required follow-on implementation boundaries

Prepare narrow implementation orders after identifying existing contracts. Any
new table/event, tenancy, registration authority, booking, occupancy, payment,
journal or state transition requires independent reviewer-executed proofs.
Routing/navigation needs a real routing provider/engine or a clearly labelled
external directions handoff; Overture geometry alone is not a navigation service.
Vendor approval, commissions, liability, merchant/payment ownership and access to
guest data are business-policy decisions: reuse documented policy or ask the
founder, never silently invent it. Do not block public map delivery on those future
choices. No open public registrations or actual orders enabled by this intake.
