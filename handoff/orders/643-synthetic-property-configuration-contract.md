# Order 643 — Synthetic property configuration contract

## Scope

- Add a read-only configuration contract for the synthetic colleague-demo property.
- Show the property as an actually configured PMS hotel, not scattered decorative demo data:
  - room classes and room types;
  - rate plans, meal plans, package inclusions and cancellation policies;
  - market segment group → market segment hierarchy;
  - sources/channels;
  - cashier roles and operational constraints;
  - statutory/fiscal/payment safety posture for the public demo.
- Reuse existing primitives and demo contracts; do not introduce a new production schema concept.

## Out of scope

- Migrations, DDL, new persistent tables or seed mutation.
- Enabling real PMS writes.
- Live OTA/Gemini/public tunnel work.
- Cleaning unrelated local model or continuity files.

## Natural-Solution Test

This is configuration/read-model data composed from existing Yellow primitives:
property, space/unit type, market segments, rate/package policy, party/source,
account/cashier roles, and extension-like jurisdiction policy. It does not require a
new primitive.

## Acceptance

- `/api/v1/demo/property-config` returns deterministic JSON for the synthetic hotel.
- The config demonstrates at least:
  - room classes/types with counts;
  - rate/meal/package/cancellation policy relationships;
  - MSG → MS hierarchy and independent source/channel intersections;
  - cashier role access and cash-drawer rule;
  - demo safety posture.
- The proof bundle includes this route as evidence for the realistic synthetic configured property gate.
- Tests prove the route and proof bundle remain aligned.
