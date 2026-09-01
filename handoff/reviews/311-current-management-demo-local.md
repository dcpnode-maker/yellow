# Order 311 — independent non-operating Tier-3 review

**Verdict:** FINDING — NOT APPROVED
**Reviewer:** fresh non-operating OpenAI Codex Tier-3 reviewer `/root/order311_fresh_tier3_review`
**Candidate:** `9a1673b7ce4d5f146b519191005b7cfb6dc10b31`
**Runtime image source candidate:** `2f7198c716fad2b260164a94010fc90a2baa1174`
**Approved base:** `3f50f7e32c122b73d94ad4a64cdba1aa2b21b18c` (Order310 governance head)
**Date:** 2026-09-01

## Independence and review boundary

I implemented none of Order311 and did not create, restore, migrate, restart, replace,
delete, reseed or otherwise operate its local resources. I read PROJECT.md, ran
`./state.sh`, inspected Order311 and D861-D862, and performed only filesystem,
container, database and HTTP reads. Protected credentials were parsed in memory;
neither password nor bearer token was printed.

The candidate is an exact four-commit descendant of the approved Order310 governance
head: admission `12d4995`, intentional red `42984bd`, status build `2f7198c`, and
local-evidence record `9a1673b`. Its seven-path diff is limited to the order/governance,
`src/project-status.ts`, and the two exact status tests. `git diff --check`, ancestry,
scope and clean-worktree checks passed.

## Finding

### F1 — D862 and Order311 mislabel two views as base tables

The builder evidence, D862, LEDGER and BUILD-PLAN say the restored database contains
**112 public tables**. My read-only catalogue query returns:

- `schema_migration=59`;
- `BASE TABLE=110`;
- `VIEW=2`;
- total rows in `information_schema.tables` for `public` = `112`; and
- policies = `100`.

This is not a runtime corruption: it is an evidence-label error. It also conflicts
with the already approved D844/D860 wording of **59 migrations / 110 public tables**.
The Order311 record must say **110 base tables + 2 views (112 table-like public
relations)** everywhere it currently says **112 public tables**. Because the order's
required proof explicitly includes exact table counts, I cannot approve evidence
whose object class is misstated.

## Verified runtime evidence

- Retained dump SHA-256 personally recomputed as
  `fe535af1da59b1aa95d11900dbddedf0c355f7b8407df1ec344597297dfca99c`;
  catalogue, count, migration, property and image manifests are present. Both protected
  authority/login files are present without secret output.
- Exact running identities are healthy:
  - app and provider image
    `sha256:92280852fc026bb0f0f60fdf50e3e5f26c62bbb93f4556c1358076d81f40d7f9`;
  - retained dbtools image
    `sha256:6e20ffa0f777127ce8976e1d44367fb996eee1f5e9f674561f328fcbcd628814`;
  - PostgreSQL `postgres:16.15-alpine`; and
  - Valkey `valkey/valkey:8.1.9-alpine`.
- The sole UI is loopback `127.0.0.1:3000`; the synthetic provider is loopback 3001,
  Valkey is loopback 6389, PostgreSQL has no host bind, and ports 3002, 3123 and 3188
  are closed. Only the four `yellow-order311-*` containers are running, all on network
  `yellow_order311_local`; PostgreSQL mounts only
  `yellow_order311_clean_pgdata` at its data directory.
- App and provider health return HTTP200 `{"status":"ok"}`. Root returns HTTP200,
  `Cache-Control: no-store`, contains the approved local tenant/email defaults and a
  protected password default field without exposing its value.
- Protected operator login returns HTTP200/no-store and a bearer token. Exactly two
  authorized properties are listed. Each returns live app/database operational and
  truthful `latest=310`, `current=311`, `reviewed=91`, `active=P7` status.
- For both properties, Today, availability, reservations, folios, operations,
  inventory, restrictions, rates, housekeeping, vehicles, cashiers and project status
  each return HTTP200/no-store: **24/24 pages**.
- Representative bounded reads return HTTP200 for inventory, restrictions, rate
  configuration, operational blocks, inventory policy, holds, reservation board,
  vehicles, housekeeping tasks/conditions and cashier sessions. Unqualified reservation
  and housekeeping-sheet requests correctly reject missing required query shape, and
  discrepancy reads correctly enforce scope; no write endpoint was invoked.
- Read-only database truth after HTTP checks is exact:
  two properties, `party=8`, `contact=0`, `party_role=8`, `fact=75`, `outbox=22`, and
  zero Party display names matching the disclosed synthetic Order311 guest. Thus the
  protected login and page/API reads did not alter the recorded clean counts.

## Reviewer-executed gates

- Focused Order311 status plus founder/workbench tests: **6 passed, 0 failed, 10
  expected database skips, 99 assertions**.
- Full standing with 30-second per-test timeout: **1,125 passed, 0 failed, 890 expected
  skips, 17,101 assertions**, 2,015 tests across 366 files.
- Typecheck passed.
- Import boundaries: **6 passed, 0 failed, 27 assertions**.
- Licence policy: **23 installed packages**, passed.
- `bun audit`: no vulnerabilities found.
- `git diff --check`, ancestry, exact scope and clean worktree passed.

## Exact personal command classes

I personally ran `git rev-parse/log/show/diff/merge-base/status`; `Get-FileHash` and
read-only backup-manifest inspection; `docker ps/inspect/image inspect/volume ls/network
ls`; loopback TCP probes; protected in-memory `Invoke-WebRequest` login followed by
property/status/page/API GETs; `docker exec ... psql` transactions beginning
`BEGIN READ ONLY` and ending `ROLLBACK`; focused `bun test`; full `bun test --timeout
30000`; `bun run typecheck`; the import-boundary test; `bun run license-check`; `bun
audit`; and `git diff --check`. I issued no container-control or database-write command.

## Verdict

Exact candidate `9a1673b7ce4d5f146b519191005b7cfb6dc10b31` is **NOT APPROVED** solely
because exact catalogue evidence is mislabeled. Correct every Order311/D862 occurrence
of `112 public tables` to `110 base tables + 2 views (112 table-like public relations)`,
commit the remediation, and request a fresh rereview. The live local otherwise passed
all reviewed management-demo checks. No public deployment, phase-complete, merge,
push, financial/statutory mutation, credential-rotation or broader application authority
is granted.
