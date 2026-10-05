# Order 470 — live clean-arrival account collision discovery

**Date:** 2026-09-20 · **Executor:** Codex · **Method:** private deploy-role,
tenant-scoped read-only transaction. No raw account value, credential or URL is
recorded.

## Result

The deterministic synthetic clean-arrival account exists exactly once. Its tenant,
property, guest-Party link, account role, currency, credit-limit and open status all
match the reviewed fixture oracle. Its display-name predicate alone is false.

The account has one folio dependent, zero posting-line dependents and no relevant
payment rows. The discovery therefore did not find a ledger or payment collision,
but it also does not authorize a direct account mutation: the account is linked to a
folio and must retain auditable, same-transaction evidence.

## Consequence

The next implementation must be a target-bound, security-definer synthetic account
presentation reconciler that locks/revalidates the account and its canonical folio,
changes only the account name, and writes one minimized fact/outbox pair. It needs
isolated race/rollback/idempotency proof and independent review before live use.
