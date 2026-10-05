# Order 623 — Opera-style group block workbench

## Problem

The schema and product docs contain Opera-style group reservation / block primitives, but the public PMS demo did not expose a usable group block management surface. This made the demo overclaim PMS completeness.

## Scope

- Add a read-only Group Blocks workbench API for `reservation_group(kind='block')`.
- Expose group header, account/company, status deduct flag, cutoff state, master folio, stay span, blocked/picked-up/remaining rooms and per-date/per-room-type allotment.
- Add a visible React reservation workspace section so colleagues can see the missing PMS module in the public demo.
- Add probes/tests that prove the API and UI copy exist.

## Out of scope

- No pickup/write, cutoff/wash release, inventory projection mutation or folio routing mutation in this order.
- No migration or new tables.

## Verification

- `bun test tests/order623-group-block-workbench.test.ts`
- `bun run typecheck`

