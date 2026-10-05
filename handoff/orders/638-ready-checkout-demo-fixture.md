# Order 638 — Ready checkout demo fixture

## Scope

- `tools/probe-colleague-demo-readiness.ts`
- `tests/order638-ready-checkout-demo-fixture.test.ts`
- `handoff/LEDGER.md`
- Optional: a narrowly-scoped public-demo fixture script using only governed APIs if the live demo lacks one ready checkout.

## Problem

The public colleague-readiness probe currently proves checkout-readiness only as a boolean-shaped response. The demo needs the same operational confidence as check-in: one departure that is genuinely ready for checkout and one departure that remains blocked by named guardrails.

## Acceptance

- The public demo proves at least one due-out reservation has `ready=true`, zero blockers, a room, and settled/closed zero-balance folios.
- The public demo also proves at least one due-out reservation is blocked with named checkout blockers.
- Do not fake readiness in the probe and do not directly write insert-only financial or occupancy tables.
- If fixture preparation is required, use existing governed folio/checkout APIs and idempotency keys.
- Add source-level test coverage so future probes keep both ready and blocked checkout checks.
