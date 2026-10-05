# Order 606 — public departure-role fixture reconciliation

## Objective

Add only the independently designed deterministic Order-593 departure-service duty
roles, staff Parties, app users, property grants and exact review-principal
permissions required to demonstrate the governed workflow in the existing synthetic
public hotel. Preserve every pre-existing operational and financial record.

## Source authority and scope

- Exact release source:
  `D:\Yellow\runtime\order605-344ab3485bf4a9da3d27ffca4cabbce75c36151b-source`.
- Exact deterministic fixture implementation: `scripts/seed-review.ts`, limited to
  the Order-593 departure-role additions already covered by focused seed tests.
- Existing `yellow-public-demo` PostgreSQL after migrations 98–99.
- This order, its independent review, and the final ledger line.

No product-source edit is authorized.

## Required procedure

1. Prove the existing pre-migration Order605 custom archive remains readable and take
   a second restorable post-migration/pre-fixture custom archive with SHA-256.
2. Restore the checkpoint into an isolated disposable trial database on the same
   pinned PostgreSQL 16 server. Apply 98–99 through the production runner, then run
   the exact review seed with protected credentials kept in process/container memory.
3. On the trial target, prove the exact five duty roles, five active synthetic app
   users, five active staff Parties, property-scoped memberships, least-privilege
   role grants and review-principal scopes. Run the seed a second time and prove every
   table fingerprint is byte-identical. Any collision or unrelated change blocks the
   public step.
4. Capture a repeatable-read/read-only public preflight. Stop only the app while the
   seed transaction runs so background workers cannot obscure attribution. Do not
   stop or recreate PostgreSQL/Valkey and do not start the tunnel.
5. Run the exact deterministic review seed once against the designated public
   database. Do not run generic seed, migrations, provision, ad-hoc DML or any
   operational command.
6. Prove changes are limited to the exact fixture tables/rows expected from the seed,
   with all pre-existing rows unchanged. Rerun the seed and prove a complete 130-table
   byte-stable replay.
7. Restart the exact Order605 app image and verify its health and existing container
   source identity. An independent non-implementing reviewer personally executes the
   target-bound fixture, replay, permission and data-preservation proof before the
   public tunnel may start.

## Expected fixture identities

- Roles: Front Desk Cashier, Housekeeping Desk, Housekeeping Team Lead, Assistant
  Manager and Duty Manager.
- Synthetic users/Parties use only the deterministic `yellow.local` and
  `source=local-review` identities defined by Order593.
- The existing automatic review principal gains only the six exact
  `stay-operations.departure-services:*` capabilities already in the approved review
  permission set.
- No app-user-to-Party identity link may be invented.

## Required acceptance evidence

- Trial restore/migrate/seed/replay proof and cleanup record.
- Public before/after/replay 130-table fingerprints with exact changed-row
  attribution and unchanged pre-existing rows.
- Exact role, permission, membership, app-user, Party and Party-role assertions.
- No departure request/task, journal, posting, payment, document, occupancy,
  reservation, checkout or room-condition change.
- Independent reviewer commands, findings and disposition.

## Exclusions

- No guest/reservation/folio seed, migration, provider, model request, operational
  confirmation, new public account, credential publication, app-source change,
  container/volume deletion, merge, push or public tunnel start.
- No restore of the designated public database. Trial-database cleanup is permitted
  only after exact name/target verification and retained evidence.

