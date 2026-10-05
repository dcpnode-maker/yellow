# Order565 — Yellow confirmation-gated cashier posting

## Objective

Let a colleague prepare and complete one configured folio charge entirely through
Yellow conversation while preserving the same server-owned catalogue, permissions,
idempotency, immutable journal and separate confirmation used by the manual cashier.

## Scope

- `frontend/yellow/src/voice.ts`
- `frontend/yellow/src/App.tsx`
- focused voice/cashier tests
- `handoff/reviews/565-yellow-confirmation-gated-cashier-posting.md`
- `handoff/FOUNDER-JOURNEY-CAPABILITY-LEDGER.md`
- `handoff/LEDGER.md`

## Required behaviour

1. A bounded command such as “post a SAR 120 laundry charge to Omar Siddiqui”
   resolves one current in-house/due-out reservation, its open folio and one exact
   server-returned transaction-code option. Yellow never invents a code or route.
2. Currency and decimal amount are parsed without floating point and converted to
   canonical positive minor units. Unsupported/ambiguous/missing guest, folio,
   currency or charge class asks for clarification and performs no write.
3. First turn shows the exact guest, confirmation, folio, charge class, currency,
   amount and quantity and states that nothing has been posted. A separate finite
   yes/no turn confirms or cancels only that immutable proposal.
4. Confirmation re-reads the folio and catalogue, refuses stale/ineligible context,
   submits the canonical charge endpoint with a stable idempotency key, then verifies
   the returned journal in the refreshed authoritative statement before claiming
   success. An uncertain response reconciles by journal identity before retrying.
5. The resulting live cashier workspace and balance remain visible inside Yellow.
   Manual posting continues to use its independent checkbox confirmation.

## Safety and verification

- No new posting endpoint, direct financial-table DML, schema change or weakening of
  financial permissions/invariants.
- No bare “yes” authorizes anything without one exact live pending proposal.
- Superseding commands clear stale proposals; concurrent folio/catalogue changes fail
  closed or reconcile by exact server receipt.
- Independent non-implementing review must personally run focused parser/effect tests,
  fresh PostgreSQL16 balanced/replay/concurrency/RLS proof and an actual rendered
  confirmation/cancel journey before public promotion.

## Public proof boundary

Source/isolated acceptance does not itself authorize a public charge. Any public
posting must use the actual reviewed UI, a clearly identified fictional scenario,
the exact visible confirmation and a protected before-state checkpoint. Its immutable
financial effect must be retained as scenario data, not erased or described as void.

## Exclusions

- No allowance, reversal, partial split, transfer, settlement, payment, fiscal
  document, arbitrary custom code, early-departure policy or whole-cashiering claim.

