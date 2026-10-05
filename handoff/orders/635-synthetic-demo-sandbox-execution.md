# Order 635 — Synthetic demo sandbox execution

## Scope

- Add a clearly labeled synthetic sandbox execution route for the colleague demo.
- Require the same exact confirmation phrase before a sandbox action changes the
  in-memory demo overlay.
- Return the operating journey plus a sandbox overlay/timeline as the authoritative
  demo reread.

## Out of scope

- Database writes.
- Real occupancy, folio, journal, payment, document, statutory or outbox mutation.
- Treating synthetic sandbox execution as production workflow completion.

## Acceptance

- `POST /api/v1/demo/sandbox/actions/execute` rejects missing/unknown action ids.
- Without the exact confirmation phrase it returns `confirmed:false` and does not
  change sandbox state.
- With the exact phrase it returns `sandboxExecuted:true`, `realPmsExecuted:false`,
  and the reread overlay contains the completed action.
- Cashier/payment-like actions never claim journal/payment/document execution.
