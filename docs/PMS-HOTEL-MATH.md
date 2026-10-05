# Yellow PMS hotel math contract

Yellow's hotel math is intentionally simple and server-owned.

## Authority

PostgreSQL is the system of record. Availability and sellability are accepted only by
the occupancy choke point and database constraints. Finance is accepted only by
balanced journals/posting lines. Reporting screens consume server read models,
projections or `security_invoker` views; they do not calculate operational truth from
ad hoc frontend rows.

## Grain

The production reporting model keeps these grains separate:

1. inventory/capacity by property, date and compatible counting basis;
2. actual hotel nights by reservation or stay segment, property and business date;
3. signed revenue by immutable posting line and business date.

Capacity is not copied onto every demand leaf. Ratios are recomputed only after
compatible numerators and denominators have been summed.

## Business hierarchy

MSG → MS is the only parent-child demand hierarchy:

- MSG: market segment group, such as `CORP`, `OTA`, `WEBSITE`, `TRAVEL_TRADE`,
  `GROUPS`;
- MS: market segment inside that group, such as a corporate segment, Booking.com,
  Airbnb, direct website, MICE, social group, defence group or incentive group.

Everything else is an independent intersection, not a nested tree:

- source/channel;
- company, booker, agent or profile;
- room class;
- room type;
- package, meal plan, cancellation policy and inclusions;
- property, brand, region, city, country or chain grouping.

This lets Yellow answer questions like "which channel, company, product type and
room class produced these room nights and this revenue?" without forcing all
dimensions into one fragile hierarchy.

Operator rule: each reservation night contributes room nights and signed room
revenue to exactly one MS and therefore exactly one MSG for reporting. Many
reservation nights roll up to one MS; many MS rows roll up to one MSG; many MSG rows
roll up to the hotel, brand, city, region or chain view selected by the operator.
Source, room type, room class, booker/company and package are filters/intersections
on the same facts, not competing hierarchies.

## KPI formulas

For a compatible property/date/grouping/currency/counting-basis:

- `occupancy_pct = room_nights / rooms_available * 100`
- `ADR = room_revenue / actual_room_nights`
- `RevPAR = room_revenue / rooms_available`

The math is deliberately boring: add the nights, add the money, then divide once at
the requested roll-up. Never average child ADRs, child occupancies or child RevPARs.

If the denominator is unavailable, zero, mixed across incompatible physical counting
bases, or planned-only rather than actualized, the KPI is unavailable with an explicit
reason. Yellow does not guess.

## UI rule

The UI may format, sort and drill into server-owned read models. It must not:

- hard-code MSG/MS/source hierarchy;
- infer company/source/channel from labels;
- compute occupancy, ADR or RevPAR from partial frontend collections;
- mix currencies or incompatible room/bed capacity bases;
- treat planned demand as occupied inventory.

This is the basis for the public demo and later production PMS screens.
