# Order 612 — complete cashier search and read workbench

## Objective

Complete the read-only cashier workbench so an authorized colleague can find a live
or historical folio by guest, room, confirmation or folio, inspect every posting and
named bill window with bounded pagination, and continue into already governed actions.

## Source authority

Continue only from the accepted Order611 candidate at
`D:\Yellow\temp\order609-four-day-sprint-source`.

## Scope

- existing financial/reservation read adapters and typed React client/workbench files;
- focused authorization, pagination, identity and responsive tests;
- generated frontend assets, this order and its review.

No posting, transfer, settlement, payment, allowance or fiscal mutation changes.
Freeze the exact file list before editing.

## Required behavior

1. Search accepts canonical supported guest/room/confirmation/folio evidence and
   returns only property-authorized results with opaque stable pagination.
2. The selected folio shows all bill windows and complete posting groups/lines with
   server-supplied signed money/currency and immutable references.
3. Missing/closed/historical states remain truthful; no browser accounting or float.
4. Existing governed action entry points remain permission/confirmation gated.
5. At 375px, search/results/statement use a contained disclosure or split layout;
   desktop retains dense columns and expandable detail.

## Forbidden

No financial write, direct SQL, new permission/schema, raw route/account/token,
client sum, OFFSET pagination, dependency, public action, deploy, merge or push.

## Acceptance

- focused tests cover all four search keys, duplicate names, foreign property,
  pagination, all windows/rows and historical/empty states;
- strict TypeScript, boundaries and build pass;
- 240/375/1440 populated browser proof with no overflow and no mutation;
- independent financial read-boundary review.

