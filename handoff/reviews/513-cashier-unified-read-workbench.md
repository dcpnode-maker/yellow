# Order 513 — cashier unified read-workbench review

## Verdict

**ACCEPT — deployed read-side workbench; public billing demonstration remains
data-blocked because the current Locanda scenario contains zero folio windows.**

## Automated evidence

- Focused tests: 28 passed, 0 failed, 166 expectations.
- TypeScript typecheck passed.
- Production build passed with 469 modules.
- Deployed assets: `index-CPXNKqsO.js`, `index-BDTnPOOf.css`; app container
  healthy and Finance route HTTP 200.
- Tests preserve the existing governed charge endpoint, idempotency key and
  visible confirmation gate. This order changed no posting payload or money
  conversion.

## Hosted browser evidence

- Finance rendered 14 current in-house/due-out stays and the guest,
  confirmation, room or room-type search.
- Searching assigned room `111` reduced the list to Theo Martin,
  `L3R-IH-0011`, proving room-number discovery.
- Selecting the stay removed the redundant “select a stay” prompt and loaded
  its reservation folio list. No folio appeared because the authoritative
  reservation contains none.
- A bounded API audit of all 12 Locanda in-house stays found zero returned
  folio windows. Consequently sibling-window selection, formatted balances,
  full itemized posting list and server-kind tabs are implemented and built but
  cannot be exercised against current published property data.

## Fixture implication

The current two-property scenario script creates reservations, occupancy and
performance statistics but does not open folios or post itemized charges. A
separate governed scenario expansion is required. It must use canonical folio
and charge services/endpoints, deterministic idempotency, factual synthetic
lineage and independent financial review before touching the published
database. Ad-hoc SQL insertion is not acceptable.
