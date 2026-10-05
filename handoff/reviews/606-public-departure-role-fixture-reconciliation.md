# Review 606 — public departure role fixture reconciliation

## R1 — ACCEPTED, 2026-09-22

Independent non-implementing reviewer: Codex `/root/order593_http_proof`.

The reviewer edited no product source, migration, seed implementation or order;
made no departure proposal/confirmation, checkout, payment, journal, document,
occupancy or provider request; ran no generic seed; and kept the retained public
tunnel stopped. The only public database mutation was the exact Order606
`identity_inventory` role/staff fixture described below.

### Frozen inputs and retained identities

The exact release source was
`D:\Yellow\runtime\order605-344ab3485bf4a9da3d27ffca4cabbce75c36151b-source`
at revision `344ab3485bf4a9da3d27ffca4cabbce75c36151b`.

| Input | SHA-256 |
| --- | --- |
| `scripts/seed-review.ts` | `CC0B67181F7CD7FCA9F3E3A85DAD2A4312EED17002F37436695936F8598C0248` |
| `tests/departure-role-fixture.test.ts` | `3F86237CA2FCF13CC376AC45EF4D25CC6BD95F62BC6CCE3C6C5FA26A97922EB0` |
| `migrations/0098_property_identity_profile.sql` | `DC8472FAEBBD05C4EBD3BAF34D6582E3A7BD9F370BE0D1BC8AFC66284DB69E2A` |
| `migrations/0099_governed_departure_service_coordination.sql` | `115BD87EE7C247F8ED3CCDF2F870860D7DA96217E232DAE577FF09CC477E51E4` |
| `src/app.ts` | `0C66A08A4D900BC077A97CA6AF1B97766DA570FB5251BD09FE29BE87ADD81901` |

Retained public containers were preserved rather than recreated:

- PostgreSQL `9f507e09cc387e7a96a436835a94d036338ed3acf87e70309031347c5ee48cb5`,
  image `sha256:ab5c955e9e57ae9879d4411ab49a912be9d162455676f7bf56e951b11ac73785`,
  volume `yellow-public-demo_yellow-pgdata`;
- Valkey `781c68656c437bf39a2428838b7ebcdd8bbc0f52dcb88c1a6babf084991dea9b`,
  image `sha256:e0eb7c480958d32bdc4357a74bdd70653ae15f2f9b4c93c4a5a9fad1dc471c84`;
- application `361b651c9f428656ead6bf8c6c96b2d7e24095fa80188f35cccac5f9f09d1aa7`,
  image `sha256:73d6423ec4a347d720ca882446786ae34bfe956de42c7cf5dc16f1af5acc85a8`;
- tunnel `e17219ecd7aa403a70d4f82a755c45aca51a6768a82d63a802bb6dadc1acc92a`
  remained exited throughout.

Docker Desktop initially failed because two stale local runtime socket directories
were inaccessible. The reviewer stopped only Docker-owned processes and moved those
two directories to recoverable quarantine paths, allowing Docker to rebuild them:

```text
C:\Users\astha\AppData\Local\docker-secrets-engine.stale-order606-20260922230829
C:\Users\astha\AppData\Local\Docker\run.stale-order606-20260922230950
```

No container, image, volume or database was deleted or recreated by that recovery.

### Backup and trial proof

Both retained archives were personally checked with a full `pg_restore --list`
capture rather than a truncated pipe:

- pre-migration archive: 2,446,285 bytes, SHA-256
  `9f8588f6bc3889648893ef758c01639000b8f7b02c286e43fae503a5c44f8b95`,
  1,483 TOC entries and **0 ACL entries**;
- full post-migration/pre-fixture archive: 2,694,728 bytes, SHA-256
  `aacc49585ba70ada6dd2f7ba1110b8677502bf6243b5bdf5d810b3ff3d023378`,
  2,123 TOC entries and 609 ACL entries.

The initial archive restored and migrated from frontier97/129 tables to
frontier99/130 tables with the exact migration98/99 checksums above. Its subsequent
seed attempt failed closed at `permission denied for table unit_type`, confirming
the already-disclosed limitation: the initial archive is not sufficient for exact
owner/ACL restoration. Nothing public had been mutated.

The reviewer verified the disposable database identity and zero sessions, removed
only that reviewer-owned database, and restored the full owner+ACL checkpoint into a
fresh database. The production migration runner correctly no-op'd at frontier99.
The default published seed mode then failed closed on a pre-existing housekeeping
sheet eligible-reservation collision; this was retained as evidence that the broad
default seed is outside Order606's limited fixture scope.

A second clean restore of the full checkpoint then ran the exported official seed
function in the explicit `identity_inventory` mode. Protected inputs came only from
the process/environment file and were never printed. Focused proof passed:

```text
bun test tests/departure-role-fixture.test.ts
=> 4 pass, 0 fail, 32 expectations
```

The first scoped trial seed changed exactly six of 130 tables:

| Table | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `app_user` | 2 | 7 | +5 |
| `party` | 652 | 657 | +5 |
| `party_role` | 652 | 657 | +5 |
| `role` | 2 | 7 | +5 |
| `role_permission` | 130 | 163 | +33 |
| `user_role` | 13 | 18 | +5 |

All other 124 table row multisets remained exact. The second scoped execution had
zero differences across all 130 tables. The reviewer personally proved the exact
five roles and least-privilege permission arrays, five active
`departure-*@yellow.local` users with one grant each to property
`4518a22f-b455-54c6-a50a-4584383749b9`, five synthetic person parties with one
matching `staff` role each, the six-permission automatic review principal and
approver, exactly six departure permission catalogue rows, no invented app-user to
party link, and zero departure requests. The reviewer then identity/session-checked
and removed only the disposable trial database.

### Exact public fixture and preservation proof

Before public mutation the retained app and tunnel were stopped, PostgreSQL and
Valkey retained their exact identities, the migration ledger was at99, the database
had130 tables and zero departure requests, and every table count/hash pair matched
`D:\Yellow\runtime\order605-public-postmigration-prelocalreview.json`.

The reviewer invoked only the scoped official `identity_inventory` mode. The first
public execution produced the same six-table deltas shown above. Every pre-existing
canonical row in those six tables remained present and unchanged; all other124
table row multisets remained exact. The second execution was idempotent with zero
differences across all130 tables.

Target-bound assertions then proved:

- exact five role names and exact least-privilege permission sets;
- exact five active synthetic duty users and one property grant each;
- exact five synthetic person/staff identities and fixture attributes;
- automatic review principal and approver each hold the exact six departure
  permissions;
- exactly six departure permission catalogue rows and no invented user-party link;
- zero departure requests, payments and documents.

The final preservation comparison reported130 tables,124 unchanged tables, exactly
six authorized changed tables, zero errors, departure requests0 and migration
ledger rows99. No reservation, occupancy, checkout, room-condition, journal,
posting, payment, document, departure-task or departure-request row changed.

### Exact app restart and local read proof

The reviewer restarted only the retained application container and observed it
healthy on `127.0.0.1:3010` with the original PostgreSQL and Valkey identities.

```text
GET /health => 200 {"status":"ok"}
GET /ready  => 200 ready; target yellow_runtime_database;
               revision 344ab3485bf4a9da3d27ffca4cabbce75c36151b;
               expected migration frontier 99
```

Release-source and container `/app/src/app.ts` hashes were identical. Served asset
identities remained the accepted Order605 set: entry JS196,568 bytes, runtime716,
React218,840, vendor163,303 and CSS128,857. After automatic demo login, a read-only
GET to the departure-service queue returned the exact five new role names, six staff
members (the five synthetic staff plus pre-existing Avery Housekeeping), and zero
requests. The tunnel remained exited.

Two reviewer harness mistakes are retained rather than hidden: a first archive-list
preview broke its own pipe by truncating `pg_restore` output, and a first asset hash
attempt passed text instead of bytes to the hash API. Full-list capture and byte-array
hashing corrected both; neither touched product or database state.

### Disposition

**ACCEPTED.** Order606's limited public departure role/staff fixture is present,
least-privileged, property-scoped, idempotent and fully attributed. The exact130-table
preservation proof confines public change to the six authorized identity/permission
tables and proves zero operational departure or finance write. The retained app is
healthy at the exact Order605 revision; the tunnel remains stopped. This acceptance
does not authorize a generic review seed, departure proposal/confirmation, checkout,
financial posting, provider call, destructive rollback or replacement of retained
containers.
