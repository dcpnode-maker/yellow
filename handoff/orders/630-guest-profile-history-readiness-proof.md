# Order 630 — Guest profile stay-history readiness proof

## Intent

Prove the public colleague demo exposes a basic Opera-style guest CRM flow:
search a guest profile, open the party record, and retrieve linked stay history.

## Scope

- `tools/probe-colleague-demo-readiness.ts`
- `tests/order630-guest-profile-history-readiness-proof.test.ts`
- `handoff/LEDGER.md`

## Non-goals

- No schema changes.
- No reservation, folio, occupancy, finance or guest-data writes.
- No new synthetic data unless the existing public fixture is missing.

## Acceptance

- The colleague-readiness probe fails if it cannot find a guest profile with linked reservation history.
- A focused source test proves the readiness probe contains the guest-history gate.
- The public probe passes against the current demo.
