# Order 489 — Commercial configuration canonical-replay remediation

## Objective

Resolve the independent final review findings for the synthetic Yellow House Mumbai
commercial configuration. Replays must reject any drift in the four named policy
definitions, the three service-created rate plans, or the complete rate-pricing
shape. The existing BAR plan remains an unchanged baseline and is not re-authored.

## Scope

- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/scripts/provision-colleague-commercial-configuration.ts`
- `D:/Yellow/runtime/order460-41415cc5c6953f71d9b3baada6fd9c7853567128-source/tests/colleague-current-date-scenario.test.ts`
- `handoff/reviews/487-synthetic-commercial-configuration.md`
- `handoff/reviews/489-commercial-configuration-canonical-replay-remediation.md`

## Required behaviour

- Treat the four named policies as canonical only when each has exactly one row with
  the expected kind and validated full content; zero rows means create all four, any
  partial or altered set fails without a repair write.
- Treat FLEX, ADV and CORP as canonical only when each has the expected active status,
  name, INR currency, tax treatment, exact policy references and the expected
  market/source fields. BAR stays untouched but must remain the reviewed active INR
  baseline named `Best Available Rate` with no policy references.
- Treat the sixteen current price rows as canonical only when their plan/type pairing,
  business-date-derived range, DOW mask, currency and *complete* decoded
  bigint pricing structure exactly match the declared configuration. No selected-key
  JSON comparison and no JavaScript `number` conversion for money.
- A same-input replay performs no mutation; a hostile drift in policy content, rate
  plan fields/references/status, or pricing structure fails before a mutation.
- Extend the disposable PostgreSQL test to prove hostile-drift rejection and unchanged
  facts/outbox/current-row counts after each failed replay.
- Keep all writes service-owned and in their existing tenant transactions. No new
  migration, no BAR update, no public database deployment, no rate publication and no
  real data.

## Required verification

- Strict TypeScript and the focused scenario suite on a fresh isolated PostgreSQL 16
  database with migrations through 0095.
- The final independent reviewer personally executes the unchanged and hostile replay
  proofs, including rate-domain RLS isolation, before any public deployment decision.

## Exclusions

- No schema/ACL change, no direct `rate_price` DML, no financial posting, no channel
  publication, no sellability override, no public deployment and no real guest,
  customer, OTA or payment data.
