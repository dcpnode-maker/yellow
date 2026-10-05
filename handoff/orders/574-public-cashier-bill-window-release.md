# Order 574 — public cashier bill-window release

## Objective

Promote the exact independently accepted Order573 frontend to the single public
Yellow app and prove the target serves those bytes and a read-only bill-window UI.

## Scope

- Docker build and app-only recreation from the sole D: serving source.
- Read-only local/public health, asset, responsive and cashier workflow checks.
- `handoff/orders/574-public-cashier-bill-window-release.md`
- `handoff/reviews/574-public-cashier-bill-window-release.md`
- `handoff/LEDGER.md`

## Required proof

1. Build from the exact Order573 R2-accepted hashes and a valid 40-character build
   revision, then recreate only `yellow-public-demo-app-1`.
2. Preserve PostgreSQL, Valkey, tunnel containers and their data/identity.
3. Verify local/public health HTTP 200 and exact accepted frontend asset names.
4. In the actual public browser, inspect a folio with an eligible complete group and
   prove destination selection/preview controls render at phone and desktop widths.
   Do not confirm or send any financial transfer.
5. Independent reviewer verifies target/source parity and absence of public mutation.

## Exclusions

- No database migration, seed, reconciliation, transfer, posting, allowance,
  settlement, payment, invoice, fiscal action or partial amount split.

## Outcome — publicly accepted 2026-09-21

- Built exact Order573 R2 source and recreated only the public app container.
- Local/public health, page and all five assets returned HTTP 200; the reviewed app
  serves `index-C8aUx2B_.js` and `index-NPwD1YbL.css` with exact local/container/public
  byte parity and valid build revision `a043bb29d64b5c3e555d46dc8263f85992e5dca2`.
- PostgreSQL, Valkey and tunnel container identities were preserved.
- Independent public 375px/1440px proof showed Omar Siddiqui's SAR 25 Laundry group,
  zero selections, disabled Preview/Confirm, >=44px controls and no overflow/errors or
  operational requests.
- Repeatable-read fingerprints for all 129 public tables were identical before and
  after browser proof and matched the retained accepted baseline. No data changed.
- No pre-Order574 rollback image tag existed; this is disclosed without making a
  rollback claim and was not a requirement of this bounded release.
