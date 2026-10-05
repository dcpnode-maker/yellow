# Order 611 — shared entity operational timeline

## Objective

Provide one read-only canonical timeline linking Party, reservation, segment, room,
folio, posting, message, task and event context so staff can navigate in either
direction without guessing by display name or flattening unavailable domains.

## Source authority

Continue only after Orders609–610 are accepted in
`D:\Yellow\temp\order609-four-day-sprint-source`.

## Scope

- existing read services/adapters and React detail/workspace files needed to compose
  already-authorized canonical reads;
- focused tenant/property/identity, pagination and browser tests;
- generated frontend assets, this order and its review.

No schema or new write command is authorized. Freeze the file list before editing.

## Required behavior

1. Every link uses canonical IDs and existing tenant/property authority.
2. Events retain source kind, actor/time, property-local business date and safe
   summary; unavailable domains say unavailable rather than fabricating data.
3. Pagination is stable and bounded; no unbounded client fetch or name join.
4. Guest, stay, transaction and room entry points converge on the same timeline
   identities and allow return to the initiating workspace.
5. Mobile shows a compact summary with details disclosed on demand; dense desktop
   views retain Opera-style operational depth.

## Forbidden

No mutation, new table/event, cross-tenant read, raw token/contact/secret, client-side
financial calculation, inferred lifecycle event, dependency, deploy, merge or push.

## Acceptance

- focused tests prove tenant/property/Party isolation, duplicate-name safety,
  pagination stability and navigation from all four entry points;
- strict TypeScript, boundaries and build pass;
- 240/375/1440 browser, keyboard, reduced-motion and forced-colour proof;
- independent review verifies no new authority or write path.

