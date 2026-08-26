# Order 182 — independent current-local post-import review

**Decision:** APPROVED LOCALLY — D-466  
**Reviewer:** independent non-operating OpenAI Codex  
**Exact operation head:** `f651487c228ec7ed6cb40cfcb2095fa39c519c05`  
**Approved seed:** `d7553761d21ae9b73b8de8b92b5d7cae43695a4a`  
**Approved Order181 governance:** `459b4e5`

## Backup and reversibility

The sole file beneath `D:\Yellow\backups\order182\` is
`yellow-local-before-order182-20260826-193630.dump` (307,774 bytes). Reviewer
SHA-256 is exactly
`34fab2e184184eae5f33a724dd30ca7aa1db77cf034af8c81b0a85f2bd8d8b06`.
The directory and file are owned by `ASTHA\astha`, inheritance is disabled, and
the sole effective ACL entry grants that owner FullControl. Streaming the unchanged
file to PostgreSQL 16 `pg_restore --list` returned exit 0 and 651 catalogue lines;
neither catalogue contents nor credentials were printed.

## Exact authority and operation evidence

`d7553761` is an ancestor of exact operation head `f651487`; the intervening diff is
governance/review/order material only and does not change the approved seeder. The
running app image remains exact independently approved Order180 image
`sha256:72a3060ea96602edfda53488be0d7cef7db6b71b7a74c2e74b9ddef6ae00ad99`;
all 77 `/app/src` files match the current source byte-for-byte.

The operator recorded pre-import scenario cardinality zero. The first protected
execution of exact `bun scripts/seed-scenario-review.ts` exited 0 and reported
`2 properties, 2192 stays`. Its immediate exact replay also exited 0 with identical
output in 10.29 seconds. The reviewer did not rerun the mutating seeder. Instead,
the final database was independently read and all 4,178 expected SHA-256-derived
scenario idempotency identities were found complete, with zero missing or incomplete
records and no duplicate scenario cardinality.

## Active-local database proof

Read-only SQL against the persistent local returned:

- exact properties Riverstone Test Hotel (`Asia/Kolkata`, INR) and Harbourlight Test
  Lodge (`America/Toronto`, CAD), both marked `order181-v1`;
- 4 operator/approver grants, 10 unit types, 80 rooms, 80 sellable units, 16 rate
  plans and 80 current prices;
- 2,192 reservations partitioned only as 1,936 cancelled and 256 reserved;
- 256 live occupancy claims and zero overlapping claim pairs;
- 4,128 reservation facts and 4,128 reservation outbox events;
- 24 charge journals and 48 posting lines, zero imbalance, zero cross-currency or
  non-null-tax lines;
- zero payments, documents, scenario groups/blocks and channels.

The database has the unchanged 18-migration ledger and 85 public tables. Under a
read-only transaction with `SET LOCAL ROLE app_role`, Yellow saw both scenario
properties and a foreign tenant saw zero. `app_role` retains no direct
insert/update/delete privilege on occupancy and no protected update/delete privilege
on journal, posting, fact or outbox rows.

## Authenticated served proof and topology

The protected owner-only operator credential file remains ignored and unchanged; no
secret or token was printed. Login returned HTTP 200. `/api/v1/me/properties` returned
HTTP 200 with exactly Yellow Demo Property, Riverstone Test Hotel and Harbourlight
Test Lodge. For each imported hotel, a reserved-only board returned HTTP 200 with a
bounded 100-row page and next cursor; one folio-backed reservation detail returned
HTTP 200 in reserved state; its one-line folio statement returned HTTP 200 in the
property currency (INR for Riverstone, CAD for Harbourlight).

`yellow-local-current` is the sole Compose project: one healthy app on only
`127.0.0.1:3000`, healthy PostgreSQL on `127.0.0.1:5643`, and healthy Valkey on
`127.0.0.1:6590`. Port 3002 is unbound. Health is exactly HTTP 200
`{"status":"ok"}`. The reviewer made no app, database, backup, credential, image,
container or topology mutation.

Approval is limited to the reversible current-local data import. It does not approve
tax/fiscal policy, payments, documents, group/block or OTA semantics, unsupported
lifecycle states, product/schema/migration changes, public bind, a second local,
merge, push, production deployment or Phase-wide completion.
