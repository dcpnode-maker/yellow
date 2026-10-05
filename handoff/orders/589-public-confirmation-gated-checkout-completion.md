# Order 589 — public confirmation-gated checkout completion

## Objective

Prove the released guided checkout end to end on the single fictional public-demo
stay `Rohan Kapoor / L3R-DO-0013`: separately confirm an empty primary folio, settle
that exact zero-balance folio, then separately confirm canonical checkout, while an
independent reviewer attributes every resulting database change and rejects any
broader financial, occupancy or hotel-record mutation.

## Current target truth

- Public property: Locanda Demo Resort,
  `6081b544-22a1-534f-a86d-bb1ae0519e14`.
- Reservation `b6d0f949-8538-5fcb-8783-79f55e75ea0c`, confirmation
  `L3R-DO-0013`, is fictional, `due_out`, with one `in_house` segment
  `cdde34a2-db3f-5f3d-9ad0-76b21f250e35`, room 113 and exactly one occupancy claim
  `d01f8fe7-9e3c-4685-a604-dc98cf802893`.
- It has zero folio windows. Checkout readiness is blocked only by the missing
  financial window once current authoritative UI reads complete.
- Order587 independently approved the three separately confirmed UI actions;
  Order588 independently approved their public release with all 129 tables stable.

## Authorized operation

Only through the actual public Yellow UI, in this exact sequence:

1. Explicitly request `checkout Rohan Kapoor`.
2. On Bill, check only the named primary-folio confirmation and invoke the existing
   governed primary-folio command once. Verify the refreshed exact empty/open window.
3. Check only that window's zero-balance settlement confirmation and invoke the
   existing governed settle command once. Verify the refreshed exact settled/zero
   window and server readiness.
4. On Release, check only Rohan Kapoor's final checkout confirmation and invoke the
   canonical checkout once. Verify reservation `checked_out`, every segment
   `departed`, the exact prior room occupancy claim absent, and the UI success state.

## Required proof

- Capture independent repeatable-read/read-only all-129-table fingerprints and
  target-row detail before the first action.
- Browser capture and network ledger must show exactly the three intended governed
  mutation endpoints, in order, each after its own unchecked-to-checked consent.
- Retain each operation's single idempotency identity; no repeat or uncertain outcome
  may use a new key.
- After each action, use UI/API reads to verify refreshed authoritative state before
  proceeding.
- Independent non-implementing reviewer must personally inspect the final row-level
  delta: one valid primary folio ending settled at zero; exact reservation/segment
  departure; exact occupancy release; expected idempotency/fact/outbox evidence;
  journal/posting/payment/document unchanged; no other reservation, folio, occupancy
  or hotel record changed.
- Final public 375 px and 1440 px views must show the verified completed Release
  state without overflow or false physical-operation claims.
- A second all-129-table snapshot after review establishes the stable post-operation
  baseline.

## Scope

- The exact three public UI actions above on `L3R-DO-0013`.
- Read-only browser/API/database evidence and screenshots.
- `handoff/orders/589-public-confirmation-gated-checkout-completion.md`
- `handoff/reviews/589-public-confirmation-gated-checkout-completion.md`
- `handoff/LEDGER.md`

## Exclusions

- No direct SQL mutation, seed, fixture, migration, source, asset, app, worker,
  credential, role, grant, provider, configuration or deployment change.
- No posting, payment, non-zero settlement, folio close, invoice/document, minibar,
  damage, missing-item, luggage, housekeeping-message/escalation or room-condition
  inference.
- No action on Ella Clarke or any other reservation.
- No whole-PMS completion claim.

## Outcome — independently approved 2026-09-22

- The actual public 375 px Yellow UI required three distinct unchecked-to-checked
  consents and submitted exactly three governed commands once each: primary folio
  201, zero-balance settle 200, checkout 200. No other write was permitted or seen.
- The resulting target truth is one SAR 0.00 primary folio `L3R-FOL-3` ending
  settled, reservation `checked_out`, its only segment `departed`, and the exact
  prior occupancy claim absent.
- Independent review attributed all 12 changed tables: one guest account, three
  idempotency rows, the non-fiscal folio series 3→4, one folio, four facts/outbox
  events, the exact reservation/segment/occupancy transitions, and the existing
  consumers' cursor/processed/projection updates. The projection recomputation
  matched 9/9 with zero mismatch.
- The other 117 tables were byte-stable. Journal 2, posting line 4, payment 0,
  payment operation 0 and document 0 were unchanged. A final stable snapshot kept
  all 129 tables exact at aggregate
  `2af37d091b40f5bec2cd5d1c69b9b78760a5133b55a24d443b9d21f25f12bff6`.
- Independent `/root/order589_checkout_review` approved the exact bounded operation
  in `handoff/reviews/589-public-confirmation-gated-checkout-completion.md`.

The reviewer also recorded one non-blocking UX gap: a fresh `checkout Rohan Kapoor`
request no longer resolves the completed journey because checkout-name resolution
only considers active departures. The completion-session views are genuine and the
persistent server truth is correct, but post-departure retrieval currently requires
checked-out-today or reservation history. A separate source/release order must fix
that before colleague-ready completion is claimed.
