# ORDER 476 — live reviewed parking-fixture delivery

**Phase:** 0 · **Branch:** `phase-0/live-reviewed-parking-fixture-delivery` · **Written by:** Codex · **Date:** 2026-09-20

## Goal

Deliver the independently reviewed, deterministic synthetic parking fixture to the
current public-demo database now that Order475 has proved its previously colliding
clean-arrival prerequisites canonical.

## Scope

- `handoff/orders/476-live-reviewed-parking-fixture-delivery.md`
- `handoff/reviews/476-live-reviewed-parking-fixture-delivery.md`
- `handoff/LEDGER.md`

## Authorized action

Run the existing reviewed `scripts/seed-review.ts` exactly once against the verified
private loopback public-demo target, with its required deployment credential supplied
in-process only. The source hashes must equal the Order461-reviewed values before
execution:

- `scripts/seed-review.ts`:
  `A394A3201B62515ADE9A2A134D4967080451B3447EE1941854428F603D8B80D4`
- `tests/review-seed.integration.test.ts`:
  `A57B6465EACB077B46ACE7109506628A5F49F2EFEDEF3910F0DEEF4D0E64A8DF`

## Constraints

- No reset, baseline reseed, direct SQL DML, migration, restart, provider/channel
  action, credential disclosure, or non-synthetic identity.
- Stop immediately on any non-zero result; do not retry, patch around, or classify a
  failure as success.
- Preserve zero journals, posting lines, payments and documents for the parking
  stay. The only expected new relationships are its reviewed primary reservation
  guest, exclusive segment occupancy and empty open primary folio.
- The implementation owner may perform no independent-review role for this delivery.

## Acceptance

An independent reviewer personally performs target-bound read-only postflight:
source hash, ledger integrity, exact PARKING relationship and financial-zero state,
plus public browser search → billing-workspace proof. The review must identify any
additional seed-side effects rather than infer no-delta from intent.
