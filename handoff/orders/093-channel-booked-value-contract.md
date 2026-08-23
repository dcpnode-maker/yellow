# Order 093 — Canonical channel booked-value and guest-total contract

**Phase:** 4 · Cross-cutting future-RMS foundation while operational channel execution remains deferred
**Branch:** `phase-4/channel-booked-value-contract`
**Base:** `phase-4/ota-research-evidence-contract` at `5ab6457`
**Tier:** 3 — canonical money-basis and funding classification
**Written by:** OpenAI Codex, founder-authorized temporary architect/builder under D-95/D-115/D-221

## Outcome

Give the adaptive RMS and future channel-economics layer one exact booked-value decomposition that
cannot silently mix guest price, room revenue, mandatory fees, taxes or discount funding.

The contract distinguishes gross booked room revenue, hotel-funded guest discount, channel-funded
guest discount, mandatory non-room charge and tax/government pass-through. It derives guest room
price, guest booked total, gross guest value before discounts and hotel room receivable before other
distribution costs, then carries an explicit mapping into Order 091's room-economics basis.

This is pure exact-money calculation in the existing Rates context. It does not classify a non-room
charge for accounting, calculate tax or commission, estimate cancellation or demand, recognize a
receivable, persist a booking, select a channel/campaign, recommend a price or authorize action.

## Natural-Solution Test

- Order 091 already owns exact RMS room economics and bigint/rational ARR. Extending that context
  with a pure upstream booked-value decomposition reuses its money language instead of inventing a
  financial or Distribution ledger.
- Order 092 records the external KB conflict: its `gross_room_value` includes mandatory fees while
  Yellow's gross booked room revenue excludes non-room charges and tax. The difference must be an
  executable mapping before any imported data, backtest or optimizer may use either value.
- No existing primitive needs persistence. A future booking, folio, tx-code and tax order will bind
  actual financial recognition; this analytical contract must not pre-empt those authorities.

## Scope

- `handoff/orders/093-channel-booked-value-contract.md`
- `src/contexts/rates/channel-value.ts`
- `src/contexts/rates/index.ts`
- `tests/channel-booked-value.test.ts`
- `docs/CHANNEL-BOOKED-VALUE-CONTRACT.md`
- `src/project-status.ts`
- `tests/founder-status.integration.test.ts`
- `scripts/derive-review-coverage.ts` (Q134 portability correction only)
- `handoff/GATE-3-MANIFEST.md` only after every proof is green
- `handoff/LEDGER.md`
- `DECISIONS.log` only after every proof is green

## Required work

1. Commit this order and an intentional-red focused proof importing absent Rates exports before
   production code.
2. Accept one strict version-1 input with exact keys only: uppercase currency, positive safe-integer
   occupied room nights and non-negative signed-range bigint minor units for gross booked room
   revenue, hotel-funded guest discount, channel-funded guest discount, mandatory non-room charge
   and tax/government pass-through.
3. Reject combined guest discounts greater than gross room revenue and every intermediate or final
   signed-range overflow. Do not coerce number/string money or mutate input.
4. Derive exactly:
   - guest room price = gross room revenue − hotel-funded discount − channel-funded discount;
   - gross guest value before discounts = gross room revenue + mandatory non-room charge + tax/
     government pass-through;
   - guest booked total = guest room price + mandatory non-room charge + tax/government pass-through;
   - hotel room receivable before other distribution costs = guest room price + channel-funded
     discount = gross room revenue − hotel-funded discount.
5. Carry one immutable mapping to Order 091 naming gross booked room revenue and hotel-funded
   campaign discount as included inputs, with channel-funded discount, mandatory non-room charge and
   tax/government pass-through explicitly excluded from hotel distribution-cost deductions/room
   revenue as appropriate. The mapping is evidence, not a journal or receivable.
6. Return exact quotient/remainder per occupied room night for gross room revenue, guest room price,
   guest booked total and hotel room receivable. Preserve signed-range bigint arithmetic; no float.
7. Return a recursively frozen snapshot and strict evidence projection whose bigint leaves are
   canonical decimal strings. Recompute and reject forged or shallow snapshots before rendering.
8. Document funding examples, the external KB mapping conflict, inclusions/exclusions and deferred
   accounting/tax/commission/collection authority.
9. Run focused/default proofs, typecheck, boundaries, licence/audit, exact schema, isolated Phase-3
   gate, protected hashes and fresh app-never-started `./setup.sh --db-only` at 11/11. Record Order
   093 as UNVERIFIED debt, refresh Graphify, rebuild only the founder app, open a stacked draft PR
   and require green replacement final-tip CI. Do not merge.

## Forbidden

- Any edit under `migrations/`, `tests/run_invariants.py`, schema snapshots, Compose, CI, package or
  lock files; any table, column, extension, fact, event, route, worker, cache, permission, RLS/tenant,
  occupancy, reservation, journal, posting, folio, fiscal, payment or state-transition change
- Treating mandatory non-room charges as recognized revenue, selecting a tx code/USALI/account,
  calculating tax, commission, payment fee, cancellation cost or servicing cost, or moving money
- Float/number/string money, cross-currency arithmetic, FX, implicit conversion, hidden rounding,
  major-unit display or ambiguous bare ARR
- Treating channel-funded discount as a hotel-funded cost; subtracting mandatory non-room charges or
  tax/pass-throughs from Order 091 room revenue; including either in its gross booked room revenue
- OTA capability, contract or credential inference; campaign stacking, causality, forecast, bid-price
  estimation, recommendation, approval, publication, enrolment or financial commitment
- AI authority, imported external claims, fabricated review/approval, self-merge or advancing
  independent review beyond Order 044

## Pre-registered proof

### P0 — intentional red

Import `calculateChannelBookedValue`, `channelBookedValueEvidence`, `ChannelBookedValueError` and
`CHANNEL_BOOKED_VALUE_BASIS` from the Rates public surface. Before production code, the focused test
must fail because those exports do not exist.

### P1 — exact booked-value identities and Order-091 mapping

Use non-even bigint values across three occupied room nights. Prove every derived identity,
quotient/remainder recomposition and mapping inclusion/exclusion exactly.

### P2 — funding and charge classification are economically material

Hold total guest discount constant while moving value between hotel-funded and channel-funded.
Guest price stays exact while hotel room receivable and the Order-091 hotel-funded deduction change
by the same amount. Changing mandatory non-room charge/tax changes guest total but not room revenue,
hotel room receivable or the Order-091 room mapping.

### P3 — strict and overflow-safe

Reject missing/unknown fields, bad currency/night counts, number/string/negative/out-of-range money,
discounts exceeding gross and addition overflow. Rejected input yields no partial mutable result and
the source object remains byte-equivalent.

### P4 — immutable transport evidence

Prove snapshot/evidence recursive freezing, exact basis text, decimal-string bigint transport and
JSON serialization. Recomputed evidence rejects a forged derived total.

### P5 — standing evidence

The complete existing suite, exact schema, isolated Phase-3 gate, protected hashes and fresh referee
remain green. Graphify stays disposable and localhost changes only its honest order/debt counters.

## Definition of done

- [x] P0 is committed red before production code.
- [x] P1-P4 are green with exact decomposition and funding classification.
- [x] External gross-value mapping and deferred authorities are explicit.
- [x] P5 and both protected hashes remain exact.
- [x] Order 093 is recorded as UNVERIFIED review debt; no approval or merge is claimed.
