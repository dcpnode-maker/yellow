# Order 247 — sole-local Orders 244–246 promotion verification

**Conclusion:** PASS — local-only operational verification

**Promoted source:** `088465d5793e1a5f4b024dd9f881b08b53143288`

**Verifier:** independent non-operating Codex worker

## Scope

The verifier did not build, restart, migrate, seed, edit, back up, change credentials,
mutate data or alter containers. It repeated read-only Docker, PostgreSQL catalogue,
loopback HTTP, authenticated status and source-hash checks. Protected values and the
short-lived access token remained in process memory and were not emitted.

## Backup and exact database drift

Before migration, the sole app stopped while PostgreSQL and Valkey remained running.
The custom-format create-capable backup is
`D:\Yellow\backups\yellow-pre-order247-20260828T182939Z.dump`, 645,457 bytes, SHA-256
`ee4338b36a00d3b1b515f63c0b1b9c7aca3ccb4bd8ef619238314e9232dc1a5d`.
Its copied restore catalogue contains 1,232 lines. The backup and its 2,077-byte exact
baseline-count file grant full control only to `ASTHA\astha` and SYSTEM.

Migration0038/0039 hashes exactly match their committed ledgers. Public schema moves
from migration37/93 tables/83 policies to migration39/94/84. All 92 prior non-ledger
table counts match, the ledger adds exactly two rows, both properties remain and the
new attribution table has zero rows. Both repaired function signatures use
`search_path=pg_catalog, public, pg_temp`. PostgreSQL id prefix `89879fcaaff4`, Valkey
id prefix `14e5534bc688` and volume
`yellow-order175-folio-responsive-containment_yellow-pgdata` remain unchanged.

## Sole app and protected founder access

Exactly one healthy app, id prefix `f5e28485c2d5`, listens only on loopback3000;
ports3002/3188 are closed. Root is HTTP200/no-store with populated tenant/email/
password controls, masked password input and restoration helper. Protected login and
the two-property read return HTTP200/no-store without credential disclosure.

Both property status reads return latest built245, current246, review91 and active
Phase7; Phases5, 6 and 7 remain active. App/database are operational with transaction-
local tenant context. Served `src/project-status.ts` SHA-256
`ad3f7ec9f9247956c09a3ad3ce3b359922f19486ecd449cb7e1f5d2b89a54000`
matches clean committed source. Rollback image
`yellow-order247-rollback:pre-orders244-246` exists at the prior image id.

## Boundary

This passes the local promotion only. It does not independently approve product code,
raise review coverage above91, merge, expose publicly, deploy to production or claim
Phase/application completion.
