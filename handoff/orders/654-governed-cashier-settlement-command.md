# Order 654 - governed cashier settlement command

## Scope
- Add a fixed public-demo governed settlement command for the already-provisioned Sara Al Harbi folio (`FOL-DEMO-303`).
- Accept only the exact confirmation phrase `CONFIRM YELLOW OPERATION`.
- Settle only the current open folio balance with a demo cash marker; no PAN, PSP, cash drawer, refund, fiscal document, statutory submission, or external payment rail.
- Insert one balanced `journal` of kind `payment`, two `posting_line` rows, one `payment_instrument` cash marker if missing, one `payment` row, and one `outbox` event in the same tenant transaction.
- Reread `folio_balance` from PostgreSQL before and after execution; replay must not duplicate journal/payment/outbox rows.
- Expose a demo API route and update the public proof/action-safety/readiness contracts truthfully.
- Add focused tests plus run typecheck, boundary check, and the PostgreSQL 18 invariant battery.

## Out of scope
- Full payment providers, hosted fields, refunds, voids, card captures, UPI rails, cash drawer/session enforcement, invoices/documents, fiscalization, statutory reporting, checkout completion, room move, or group block mutation.
- Schema migration or editing `migrations/0001_init.sql`.
- Broad finance redesign beyond this fixed demo command.
