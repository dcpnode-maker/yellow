# ORDER 477 — live reviewed parking-fixture delivery, correct principal

**Phase:** 0 · **Branch:** `phase-0/live-reviewed-parking-fixture-delivery-correct-principal` · **Written by:** Codex · **Date:** 2026-09-20

## Goal

Make one valid, independently reviewed delivery attempt for the missing synthetic
`PARKING-REVIEW` relationships using the exact reviewed seed and documented
deployment principal.

## Scope

- `handoff/orders/477-live-reviewed-parking-fixture-delivery-correct-principal.md`
- `handoff/reviews/477-live-reviewed-parking-fixture-delivery-correct-principal.md`
- `handoff/LEDGER.md`

## Preconditions

- Order475 read-only target preflight is retained: clean-arrival Party/guest role/
  account/folio are canonical; PARKING has exactly the documented missing relations.
- The two reviewed Order461 source hashes match exactly.
- Build `YELLOW_DEPLOY_DATABASE_URL` only in-process for the documented
  `yellow_deploy` login, never `yellow_owner`, and never print it.

## Authorized action

Run `bun scripts/seed-review.ts` **once** through that exact deployment capability.
Capture only exit status, output length and digest. Stop on any non-zero result;
there is no retry under this order.

## Constraints and acceptance

All Order476 data, privacy, no-reset, no-direct-DML, no-restart and no-provider
constraints apply unchanged. A nonimplementing reviewer must personally run a
current-target read-only postflight and public browser proof before delivery can be
called successful. Postflight must show precisely one reviewed primary guest,
exclusive segment occupancy and empty open primary folio for PARKING, with zero
journal, posting, payment and document activity for that stay.
