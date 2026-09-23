# Order 370 — fresh independent non-operating Tier-3 review

**Verdict:** APPROVED — no finding
**Reviewer:** fresh independent non-implementing, non-operating Codex Tier-3 reviewer
`/root/order370_fresh_nonoperating_tier3`
**Date:** 2026-09-02
**Reviewed candidate:** `4dd2368d0dedd4f8df7a1b59b6245437f637b341`
**Runtime source:** `15516170433b008411bb07e13c8001f823f8e16d`
**Authority:** Order370 / D1039–D1040 only

## Verdict

Order370 is approved. Fresh read-only proof independently establishes the exact
restricted Order274 backup, readable PostgreSQL catalogue, restored database truth,
role and ACL containment, exact sole-local Docker topology, approved runtime source,
loopback-only exposure, protected in-memory sign-in, two authorized properties,
truthful recorded status and all 24 bounded management pages. No finding remains.

This reviewer did not implement or operate the recovery. I did not start, stop,
restart, recreate or delete a container, image, network or volume; did not run the
production migration runner, restore or seed; did not write the database or cache;
and did not read, print, hash or persist a credential or bearer token. The only
repository changes are this review record and its bounded approval governance.

## Exact source and scope — PASS

- Candidate `4dd2368d0dedd4f8df7a1b59b6245437f637b341` is a descendant of exact approved
  runtime source `15516170433b008411bb07e13c8001f823f8e16d`.
- Its delta over recovery base `5b9b9dd` contains only Order370, `DECISIONS.log` and
  `handoff/LEDGER.md`; `git diff --check` passes.
- The running app image is labelled with the complete exact runtime revision above,
  runs as `bun` from `/app`, and uses `bun run start`.

## Restricted backup and readable catalogue — PASS

- The independently recomputed SHA-256 of
  `yellow_dev.pre-orders272-273.dump` is exactly
  `fe535af1da59b1aa95d11900dbddedf0c355f7b8407df1ec344597297dfca99c`.
- The restricted backup directory is inheritance-protected, owned by `ASTHA\astha`
  and grants only the owner and `NT AUTHORITY\SYSTEM` FullControl. Every child
  inherits only those two allow entries; no deny or third-principal rule exists.
- PostgreSQL 16.15 `pg_restore -l` read the retained dump from standard input without
  restoring it. The fresh and saved catalogues each contain 1,324 lines and have the
  same normalized SHA-256
  `35a98f64f1bfbef39fd4e171ed813d85147313f6ba6df98ceeef72fe8ed42b23`.
- The retained root-filesystem archive independently rehashes to
  `970c8fefda8ba62c084f8152547807a6eb59d179619308ee0ec66c04fe4e0191`.

## Restored PostgreSQL truth and authority — PASS

Every query used `psql -X`, `ON_ERROR_STOP=1`, an explicit `BEGIN READ ONLY`, and
`ROLLBACK`. Before and after HTTP proof, the exact live truth is:

```text
schema_migration=59 (min=1,max=59)
public base tables=110
public views=2
public RLS policies=100
property org nodes=2
party/contact_point/party_role/fact_log/outbox=8/0/8/75/22
other open transactions=0
```

Role and membership containment matches the approved runtime authority:

- `yellow_owner` and `app_role` are NOLOGIN; neither is superuser, bypass-RLS,
  create-role, create-db or replication capable. `yellow_owner` is NOINHERIT.
- `yellow_runtime` is LOGIN, NOINHERIT, non-superuser, non-owner and cannot create
  roles/databases, replicate or bypass RLS. It has a verifier and exactly one relevant
  membership: member of `app_role`, without admin or inherit option and with set
  option.
- `yellow_extension_registrar` is the same restricted LOGIN shape, connection-limit4,
  has a verifier and has no membership.
- `yellow_deploy` remains the external deployment administrator and owns the database;
  it owns no public relation. `yellow_owner` owns all 110 base tables, two views, 265
  indexes and the one public sequence.
- `PUBLIC`, `yellow_runtime` and `yellow_extension_registrar` have no direct public
  relation grant. `app_role` has SELECT on 107 base tables and two security-invoker
  views, plus only the two historically approved DELETE grants on
  `availability_projection` and `reservation_guest`. No default ACL widens authority.
- The public schema is owned by `yellow_owner`; only `yellow_owner` has CREATE.

The reviewer did not rerun the production runner because Order370 explicitly requires
a non-operating review. D1040 records the immediate second pass as
`applied=0/status=no-op/transaction_pids=none`; fresh catalogue proof independently
confirms the terminal migration59 state, one row per version and zero other open
transaction.

## Exact sole Docker topology — PASS

Exactly four containers are running, and all four are healthy with restart count0,
restart policy `unless-stopped`, Compose project `yellow_order311_local` and the exact
named network:

| Container | Exact image | Exposure |
| --- | --- | --- |
| `yellow-order335-app` | `sha256:ee096f1277ea6ae8c72e7c7039e339c53da7897a5d986d8110c4eb99e7974a56` | `127.0.0.1:3000` |
| `yellow-order311-provider` | same exact approved-source image | `127.0.0.1:3001` |
| `yellow-order311-postgres` | `postgres:16.15-alpine@sha256:ab5c955e9e57ae9879d4411ab49a912be9d162455676f7bf56e951b11ac73785` | no host bind |
| `yellow-order311-valkey` | `valkey/valkey:8.1.9-alpine@sha256:e0eb7c480958d32bdc4357a74bdd70653ae15f2f9b4c93c4a5a9fad1dc471c84` | `127.0.0.1:6389` |

Network `yellow_order311_local` has exactly those four attachments. PostgreSQL mounts
only exact named volume `yellow_order311_clean_pgdata` at its data directory. App and
provider health are HTTP200. Independent listener and TCP probes show only 3000,3001
and6389 open on loopback; obsolete app ports3002,3123 and3188 are closed. No second
running app or database exists.

## Protected login, two properties, status and pages — PASS

The reviewer fetched the no-store root and kept the three populated protected local
defaults only in process memory. The password control remained `type=password`, the
form had autocomplete disabled, and no value was printed, serialized to disk, hashed
or included in review output. One loopback POST to the canonical local-login endpoint
returned HTTP200/no-store. Its bearer token remained only in memory.

Authenticated property discovery returned exactly two authorized properties. For
each property, the same-origin no-store status endpoint independently returned:

```text
latestBuiltOrder=310
currentOrder=311
independentlyReviewedThroughOrder=91
activePhase=7
phaseCount=13
live.app.state=operational
live.database.state=operational
live.database.tenantContext=true
```

For both properties, Today, availability, reservations, folios, operations,
inventory, restrictions, rates, housekeeping, vehicles, cashiers and project status
returned HTTP200 with `Cache-Control: no-store`: **24/24 pages**. A final read-only
database snapshot reproduced the exact pre-HTTP counts, and all four runtime
containers remained healthy/restart0.

## Approval boundary

Approval is limited to Order370's recovery of the sole founder local from the exact
verified backup and approved runtime source. It grants no product or Phase completion,
post59 migration, seed, credential rotation, second/public local, merge, push,
deployment, cleanup or broader financial/statutory authority.
