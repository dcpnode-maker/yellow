# Order 575 — Yellow confirmation-gated bill-window voice

## Objective

Give Yellow conversational parity with the accepted cashier bill-window workflow so
an operator can ask to move one complete posted charge for one named guest into an
existing or newly named bill window, review the exact live preview in the AI layer,
confirm conversationally, and see authoritative reconciliation without manual page
navigation.

## Natural-solution test

Reuse Order573's statement transfer-group metadata, exact preview/receipt validators,
canonical preview/commit endpoints, stable-key recovery and statement reconciliation.
The voice layer may resolve and present the same typed draft but receives no separate
financial authority. It never invents a posting group, destination, amount or window.

## Implementation authority

The sole serving source remains
`D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source`.

## Scope

- `frontend/yellow/src/App.tsx`
- `frontend/yellow/src/voice.ts`
- `frontend/yellow/src/styles.css`
- `tests/yellow-voice-bill-window-allocation.test.ts`
- `tests/yellow-voice-routing.test.ts`
- `handoff/orders/575-yellow-confirmation-gated-bill-window-voice.md`
- `handoff/reviews/575-yellow-confirmation-gated-bill-window-voice.md`
- `handoff/LEDGER.md`

## Required behaviour

1. Parse only explicit complete-charge commands such as “Move Laundry for Omar
   Siddiqui to a new bill called Personal” or “Move Laundry for Omar Siddiqui to
   window 2”. Never parse an amount/percentage/quantity as a supported partial split.
2. Resolve exactly one current reservation, one open source folio, one eligible
   complete transfer group matching the server statement row, and one distinct open
   sibling destination or a bounded new-window name. Ambiguity asks a question and
   performs no write.
3. Call the canonical preview and render an AI operation card containing guest,
   confirmation, source/destination, charge, exact source/destination before/after,
   conserved stay total and audit reason. Do not require the user to open cashier.
4. Only a separate finite affirmative confirmation may commit. Before first commit,
   refresh the reservation/statement and repeat the canonical preview; any group,
   generation, destination, balance, member or revision drift clears the proposal and
   performs no write.
5. Use one stable idempotency key. Validate the complete receipt, refresh source and
   destination statements and claim success only after exact currency, balances,
   journal evidence and conserved stay total reconcile.
6. Malformed success, network/5xx or refresh uncertainty locks the exact draft/body/key
   and exposes a same-key conversational retry while all unrelated Yellow/manual
   mutations remain blocked.
7. Show the live progress steps in the Yellow layer and remain contained at 375px and
   desktop with >=44px controls. Indian English remains the default voice policy.

## Exclusions

- No partial amount/quantity/tax-line split, allowance, correction, payment,
  settlement, invoice, fiscal document, schema/API/database change or public write.
- No broad free-form LLM mutation authority; deterministic typed resolution remains
  the financial gate.

## Verification

- Parser ambiguity/partial-split refusal and actual-effect confirmation tests.
- Controlled mounted browser success, drift, malformed-success and same-key retry at
  phone and desktop widths with all mutation routes intercepted.
- Focused tests, strict frontend TypeScript and production build.
- Independent non-implementing financial review before public promotion.
