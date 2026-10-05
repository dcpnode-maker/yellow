# Order 569 — public cashier affordance release

## Objective

Promote the independently accepted Order568 frontend-only cashier affordance to the
single public Yellow app without changing PostgreSQL, Valkey, the tunnel, configuration
or any hotel record.

## Scope

- retain and verify the current public app image under `yellow-public-demo-app:pre-order569`
- build `yellow-public-demo-app:latest` from the exact accepted serving source
- recreate only `yellow-public-demo-app-1`
- read-only local/public health, asset parity and rendered mobile cashier verification
- `handoff/reviews/569-public-cashier-affordance-release.md`
- `handoff/LEDGER.md`

## Gates

1. The Order568 review must be ACCEPT and scoped source hashes must match its evidence.
2. Preserve the currently running app image before replacing its tag.
3. Keep PostgreSQL, Valkey and tunnel containers running with unchanged IDs.
4. No migration, seed, provisioning, authentication-policy change or operational POST.
5. Verify public 375px cashier rendering read-only: grouped controls, semantic status,
   current SAR25 immutable row, unchecked confirmation and disabled posting action.
6. Local and external health/page/assets must return 200 with identical bytes.

## Rollback

If health or rendering fails, recreate the app only from
`yellow-public-demo-app:pre-order569`. Never restore or mutate the database for this
frontend-only release.

## Outcome — 2026-09-21

Released and independently accepted. Only `yellow-public-demo-app-1` was recreated;
PostgreSQL, Valkey and the Cloudflare tunnel retained their exact container identities.
The previous app image is retained as `yellow-public-demo-app:pre-order569`. Local and
public health/page/assets returned 200 with byte-identical assets. Actual public 375px
proof showed all six 44px grouped controls, corrected computed colours, one existing
SAR25 Laundry row, unchecked confirmation, disabled Post action and the drawer/folio
distinction. No operational request or database mutation occurred.
