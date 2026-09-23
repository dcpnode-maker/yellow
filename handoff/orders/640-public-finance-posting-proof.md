# Order 640 — Public finance posting proof

## Scope

- `tools/prove-public-finance-posting-flow.ts`
- `tests/order640-public-finance-posting-proof.test.ts`
- `handoff/LEDGER.md`

## Problem

The public colleague-readiness probe proves the cashier/folio surfaces are present and an open folio exposes posting options, but it intentionally stays read-only after demo login. The demo still needs an executable, opt-in proof that a governed finance posting command can run and reconcile to the immutable folio statement.

## Acceptance

- Add a bounded proof script that logs into the public demo, posts one idempotent synthetic charge through `/api/v1/properties/:property/folios/:folioId/charges`, then re-reads the folio statement.
- The proof must verify the charge receipt's folio, tx code, amount, currency, business date, journal id and replay flag shape.
- The proof must verify the resulting statement contains exactly one matching debit row for that journal/folio/tx/amount.
- Do not touch occupancy tables, checkout state, settled folios, or immutable financial tables directly.
- Keep the default colleague-readiness probe read-only after login.
