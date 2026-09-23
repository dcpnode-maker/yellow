# Review 271 — Promote approved Orders266–270 to the retained sole local

**Reviewer:** independent non-operating Codex Tier-3 reviewer (`/root/order271_independent_review`)  
**Decision:** APPROVED  
**Date:** 2026-08-29  
**Reviewed commit:** `27a67528e6c12d72f14a5ad7fdfb08cc51590e83`  
**Authority:** Order271 / D-706 / D-707 only

## Verdict

Order271 is approved. This reviewer personally reproduced the safely repeatable
read-only evidence at the exact review commit. The restricted backup is readable and
has the recorded hash; the rollback image exists; historical ledger rows1–44,
all97 non-ledger table counts and both property identities are exact; migrations45/46
are the only appended ledger rows with the committed hashes; the recorded second
runner execution is a zero-PID no-op; and the live contained function has the exact
owner, execute ACL and search path.

The exact PostgreSQL, Valkey, network and retained-volume identities remain healthy
with restart0. Only the app identity changed, it is healthy on the sole loopback3000
listener, and3002/3123/3188 are closed. The reviewer used the protected local sign-in
without reading or emitting any credential value: on the signed-out page the masked
password control was present and pressing only `Enter workbench` authenticated the
operator. Exactly two properties were discovered, and both authenticated status
pages report latest266/current269/review91/active7.

This approval is limited to the reversible local promotion. It does not authorize a
merge, public or production deployment, review-coverage advance, Phase7 completion,
or application-complete claim.

## Independent evidence

### Git and source identity

Commands:

```text
git status --short
git rev-parse HEAD
git show --stat 27a67528e6c12d72f14a5ad7fdfb08cc51590e83
git merge-base --is-ancestor d84f4aad1b3dd14159aa14accdad4921be5d95a1 27a67528e6c12d72f14a5ad7fdfb08cc51590e83
git diff --name-only d84f4aad1b3dd14159aa14accdad4921be5d95a1..27a67528e6c12d72f14a5ad7fdfb08cc51590e83
Get-FileHash migrations/0045_governed_positive_tax_correction.sql -Algorithm SHA256
Get-FileHash migrations/0046_positive_tax_posting_ordinal_repair.sql -Algorithm SHA256
```

Results:

- the checkout was clean on exact local and origin review commit `27a67528...90e83`;
- exact promotion source `d84f4aad...95a1` is its ancestor, and the intervening
  promotion commit changes only Order271 governance/evidence files;
- committed migration45 is
  `aec7f04eaa0536568adf68d51d7e2fa3ff578cd043b3079c080a680d6e210dba`;
- committed migration46 is
  `bd7fb83f619aabf76b7247246a096ca09275823d07cbdceeb2deec8a1e76b574`.

### Restricted backup, manifests and rollback

Commands:

```text
Get-ChildItem D:\Yellow\backups\yellow-order271-20260829T050750Z
Get-Acl D:\Yellow\backups\yellow-order271-20260829T050750Z
Get-FileHash ...\yellow_dev.pre-orders266-270.dump -Algorithm SHA256
<stream dump through docker exec -i <exact-postgres> pg_restore -l; compare output in memory>
Compare-Object counts.before.txt counts.after.txt
Compare-Object properties.before.txt properties.after.txt
Compare-Object ledger-1-44.before.txt ledger-1-44.after.txt
docker image inspect yellow-order271-rollback:pre-orders266-270
```

Results:

- directory owner is `ASTHA\astha`, inheritance is protected, and its only allow
  principals are that owner and `NT AUTHORITY\SYSTEM`, both FullControl; every file
  inherits only those two rules;
- dump size is741,061 bytes and its independently recomputed SHA-256 is
  `60cb14f7eab539bf640ee8dfe34fb9651a2b6d8a7513ef120a52445be9d249da`;
- PostgreSQL16.15 `pg_restore -l` reads the dump successfully with exit0 and reproduces
  the recorded catalogue exactly (1,320 lines);
- before/after ledger, count and property manifest files are byte-identical;
- the count manifest has exactly97 table rows, the property manifest has exactly2
  rows, and the historical ledger manifest has exactly44 rows;
- rollback tag `yellow-order271-rollback:pre-orders266-270` resolves to exact prior
  image `sha256:83a7bb59bd702c3b8fefab26338d2273f293d32b802915fe9034bae21e057c93`.

### Live database truth, forced read-only

Every successful query used the exact retained PostgreSQL container with:

```text
docker exec -e "PGOPTIONS=-c default_transaction_read_only=on" <postgres-id> \
  psql -X -v ON_ERROR_STOP=1 -U yellow_deploy -d yellow_dev -Atq -c <SELECT-only SQL>
```

Exact results:

```text
transaction_read_only=on
migrations=46|min=1|max=46
public_tables=98
rls_policies=88
properties=2
migration45=0045_governed_positive_tax_correction.sql|aec7f04e...10dba
migration46=0046_positive_tax_posting_ordinal_repair.sql|bd7fb83f...b574
historical_ledger_rows=44|binary_exact=true
non_ledger_counts=97|exact=true
property_identities=2|binary_exact=true
open_other_transactions=0
```

The live function authority is exactly:

```text
owner=yellow_owner
acl=yellow_owner=X/yellow_owner,app_role=X/yellow_owner
search_path=pg_catalog, public, pg_temp
```

The protected operation evidence records first runner execution
`applied=2/status=applied` with one PID for both migrations, followed by
`applied=0/status=no-op/transaction_pids=none`. The reviewer did not rerun the
production runner because Order271 explicitly forbids a reviewer mutation; the live
ledger independently confirms exactly45/46 and there is no remaining transaction.

### Exact retained runtime and sole-local topology

Commands used formatted `docker ps`, `docker inspect`, `docker network inspect`,
`docker volume inspect`, and `Get-NetTCPConnection`; container environments were
never rendered.

Results:

- app `d108284e83a613cd714d67c40710fb1bf890d90f75b1ef7e0d135268233fbf3b`
  is running/healthy/restart0 on image
  `sha256:419fd91f13779ec0d5ab64e7cb0324803a2072b5825d3a47d394d967313fbfaa`;
- PostgreSQL
  `f4f02655770a997df7641c887fe241e6002c1de7d847eaafc9db873ed7c52d12`
  is running/healthy/restart0 and retains named volume
  `yellow-order175-folio-responsive-containment_yellow-pgdata`;
- Valkey
  `aa3061bdf23123cc29447e338af6d28b2c89d50bc5daaf0222c89df040d052fa`
  is running/healthy/restart0;
- all three and only those three attach to exact network
  `ba56ef587dbac90f222237d890c410c377aa9a36670ffdf2bd0412b4ce65161a`;
- app publishes only `127.0.0.1:3000->3000/tcp`; listener3000 is open and
  3002/3123/3188 are closed. PostgreSQL5545 and Valkey6485 remain loopback-only.

### HTTP, protected press-only login and both status snapshots

`Invoke-WebRequest` returned root200 with exact `Cache-Control: no-store`, health200,
and HTTP200 for `operator.css`, `operator.js` and
`operator-local-prefill.js`. Browser verification began from the signed-out root,
confirmed the three local-review controls and masked password type, and clicked only
the `Enter workbench` button. No value was read, typed, logged, serialized or hashed.
The page authenticated as `Yellow Review Operator` and exposed exactly two distinct
property options.

The reviewer opened Project status for each property through the visible selector.
Both independently rendered:

```text
Order 266 built
Snapshot date 2026-08-29 · current order 269
91 orders independently reviewed
Phase 7 of 12 active
Application operational
PostgreSQL operational with tenant context confirmed
```

### Harness-only corrections

The WSL-oriented `state.sh` reported services down because native Windows Docker is
the documented authority; direct native inspection proved the live stack. An initial
archive-list invocation included an unnecessary literal `-` argument and exited1;
the corrected stdin invocation exited0 and reproduced the saved catalogue. Initial
count comparison sorted complete `table|count` lines under PostgreSQL collation and
therefore differed only in ordering; keyed set comparison proved all97 exact. An
initial historical-ledger probe used generic row JSON rather than Order271's binary
canonical form; the corrected version/UTF-8/timestamptz-send query reproduced all44
rows byte-for-byte. All probes were read-only and no product finding resulted.

## No-mutation statement

This reviewer did not build, run Compose, apply or rerun a migration, seed, restore,
provision, start, stop, restart, recreate or remove a container, image, network or
volume; did not write the database or cache; did not rotate, inspect or expose a
credential; and did not change runtime or product source. Apart from this review
record, no repository file was written.
