# Order 561 — public confirmation-gated arrival completion

## Objective

Prove the live public Yellow application can take one exact fictional current due-in
from inspected-room readiness through a separately confirmed primary-folio open and
a separately confirmed check-in, while displaying each canonical refresh inside the
same retained Yellow conversation.

## Scope

- Existing fictional Locanda reservation `L3R-DI-0015` / Omar Siddiqui only
- Existing public Compose project `yellow-public-demo`
- Read-only preflight plus exactly two governed commands already implemented and
  independently accepted: open its primary folio, then check in that reservation
- One private pre-action PostgreSQL checkpoint beneath the existing ACL-restricted
  `D:/Yellow/recovery/` pattern
- `handoff/reviews/561-public-confirmation-gated-arrival-completion.md`
- `handoff/LEDGER.md`
- `handoff/FOUNDER-JOURNEY-CAPABILITY-LEDGER.md`

## Required behaviour

1. Independently establish exact reservation/segment/guest/room-condition/folio/
   occupancy/fact/outbox/idempotency state before any write. Stop if the target is
   no longer one unique due-in with inspected assigned room and sole blocker
   `primary_folio_not_open`.
2. Create and verify a private consistent backup before the first command. Never
   print credentials or guest contact/document/payment data.
3. Through the live public Yellow UI, prepare the named arrival. Confirm only the
   exact primary-folio proposal. Yellow must refresh canonical truth and present the
   separate check-in proposal without requiring the operator to restart the request.
4. Confirm only the exact named check-in proposal. The server must recheck the
   inspected room and primary folio, then commit the target reservation/segment as
   in-house plus one immutable fact/outbox/idempotency result. The already-existing
   segment-owned occupancy claim must remain byte-identical; check-in does not create,
   replace or alter occupancy.
5. Prove no charge, journal, posting, payment, invoice/document or unrelated
   reservation/room/guest state changed. The new folio remains open with zero
   financial balance/postings. Opening it may advance only the configured non-fiscal
   folio series from `next_no = 1` to `next_no = 2`.
6. Prove same-key retry/reload reconciliation does not duplicate either operation,
   and the public Today/arrival/in-house views refresh to canonical counts/state.
7. Independent non-implementing review is mandatory before and after the two
   public writes.

## Exclusions

- No cleaning/inspection declaration, room selection, guest/profile/document edit,
  charge/payment/invoice, checkout, seed, reconciliation, schema/migration, service
  restart, credential/provider/tunnel change or other reservation mutation.
- No claim that one successful fictional journey completes PMS01 or the whole PMS.

## Rollback boundary

The two accepted commands are append-only/auditable hotel operations, not temporary
test writes to be silently erased. The backup is disaster recovery evidence only;
do not restore or delete the resulting business history without a separate order.
