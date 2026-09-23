# Review 268 — Restore exact retained sole-local containers

**Reviewer:** independent non-operating Codex Tier-3 reviewer (`/root/order268_independent_review`)
**Decision:** APPROVED
**Date:** 2026-08-29
**Reviewed commit:** `713a6a736f5efd070130acc10bb2cc57f3a73479`
**Authority:** Order268 / D-695 / D-696 / D-697 only

## Verdict

Order268 is approved. This reviewer personally repeated every safely reproducible
logging-safe live assertion against the exact retained runtime. The three exact
containers are healthy with unchanged full identities, approved app image, retained
PostgreSQL volume, one shared project network, configured loopback topology and
restart count0. The restricted Order267 backup, read-only product database catalogue,
98-table digest, scratch absence, root/health/assets, populated masked local defaults,
protected current login, two-property discovery, both exact recorded-status snapshots
and sole application port all match D-697.

The historical `docker start` commands and the moment PostgreSQL/Valkey first became
healthy before app start cannot be replayed by a non-operating reviewer without
performing the forbidden container mutation. Docker's retained `StartedAt` values do
independently preserve dependency order — PostgreSQL, then Valkey, then app — while a
bounded historical `docker events` query returned no rows. This is an explicit
historical-evidence limitation, not a live continuity failure: Order268 required the
independent reviewer to repeat the safe live assertions, and every one passed.

This approval restores the independently verified sole-local prerequisite for later
Order266 work under its own authority. It does not authorize a Compose action,
container restart/recreate, database migration/seed, merge, public deployment,
Phase7-complete or application-complete claim.

## Independent evidence and exact results

### Constitution, state and Git scope

The reviewer read `PROJECT.md`, ran `bash ./state.sh`, read the Order268 change and
the applicable roster/workflow material, and grepped the exact commit for the retained
runtime decisions. The shared checkout was on unrelated `main` at `5f49c82` with
three pre-existing untracked paths, so the subject was inspected by immutable Git
object and ref without checking out or modifying either branch.

Commands:

```text
git diff-tree --no-commit-id --name-status -r 713a6a7
git rev-parse 713a6a7^
git rev-parse refs/heads/phase-7/restore-retained-sole-local
git rev-parse refs/remotes/origin/phase-7/restore-retained-sole-local
git merge-base --is-ancestor c6a30f1 713a6a7
git log --reverse --format='%H|%P|%s' c6a30f1..713a6a7
git diff --name-status c6a30f1..713a6a7
git diff --check 713a6a7^..713a6a7
```

Results:

- local and origin `phase-7/restore-retained-sole-local` both resolve to exact
  `713a6a736f5efd070130acc10bb2cc57f3a73479`;
- exact parent is `78737bfaba8f83a20d296761bfdc27f5d953a2fa`, whose parent is Order267 review
  base `c6a30f115ca28fe188918046a9ab0a89383f43e6`;
- `c6a30f1` is an ancestor; the bounded lineage contains only `[codex] Admit Order 268
  retained local restore` and `[codex] Restore exact retained sole local`;
- both the exact subject commit and complete Order268 lineage change only
  `BUILD-PLAN.md`, `DECISIONS.log`, `handoff/LEDGER.md` and
  `handoff/orders/268-restore-retained-sole-local.md`;
- `git diff --check` exits0. No product, migration, schema, seed, dependency,
  credential or runtime file changed.

### Exact retained containers, topology and resources

The reviewer used only formatted fields from `docker inspect`; no container
environment was rendered. The command was:

```text
docker inspect --format '{{.Id}}|name={{.Name}}|project={{index .Config.Labels "com.docker.compose.project"}}|service={{index .Config.Labels "com.docker.compose.service"}}|image={{.Image}}|status={{.State.Status}}|running={{.State.Running}}|exit={{.State.ExitCode}}|started={{.State.StartedAt}}|finished={{.State.FinishedAt}}|restarts={{.RestartCount}}|health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|networkmode={{.HostConfig.NetworkMode}}|restartpolicy={{.HostConfig.RestartPolicy.Name}}|ports={{json .HostConfig.PortBindings}}|mounts={{range .Mounts}}{{.Type}}:{{.Name}}:{{.Source}}->{{.Destination}}:rw={{.RW}};{{end}}|networks={{range $k,$v := .NetworkSettings.Networks}}{{$k}}:{{$v.NetworkID}}:{{$v.IPAddress}};{{end}}' <each exact full id>
```

Exact results:

- app
  `b084c60b9fe615f4aed9197dd71e7d77ddfdeb88e5a42496b039f55ef06f2c2f`
  is running/healthy, exit0, restart0, restart policy `no`, on image
  `sha256:83a7bb59bd702c3b8fefab26338d2273f293d32b802915fe9034bae21e057c93`,
  started `2026-08-29T02:59:38.249766167Z`, with only
  `127.0.0.1:3000->3000/tcp`;
- PostgreSQL
  `f4f02655770a997df7641c887fe241e6002c1de7d847eaafc9db873ed7c52d12`
  is running/healthy, exit0, restart0, restart policy `no`, started
  `2026-08-29T02:59:30.103272572Z`, with only loopback5545->5432;
- Valkey
  `aa3061bdf23123cc29447e338af6d28b2c89d50bc5daaf0222c89df040d052fa`
  is running/healthy, exit0, restart0, restart policy `no`, started
  `2026-08-29T02:59:30.442755852Z`, with only loopback6485->6379;
- all three belong to exact project `yellow-order175-folio-responsive-containment`
  and exact network `yellow-order175-folio-responsive-containment_default`, network
  id `ba56ef587dbac90f222237d890c410c377aa9a36670ffdf2bd0412b4ce65161a`;
- that project has exactly these three containers and all three are running; the WSL
  daemon separately queried by `bash -lc 'docker ps ...'` has zero running containers;
- PostgreSQL retains exact local named volume
  `yellow-order175-folio-responsive-containment_yellow-pgdata` mounted read-write at
  `/var/lib/postgresql/data`; `docker volume inspect` reports local driver/local scope.

Point-in-time `docker stats --no-stream` returned:

```text
b084c60b9fe6|app|cpu=0.79%|mem=85.64MiB / 7.434GiB|mempct=1.12%|pids=23
f4f02655770a|postgres|cpu=3.98%|mem=84.8MiB / 7.434GiB|mempct=1.11%|pids=28
aa3061bdf231|valkey|cpu=3.31%|mem=4.398MiB / 7.434GiB|mempct=0.06%|pids=5
```

The capture shows no resource pressure or topology discrepancy.

### Restricted backup

Commands:

```text
Get-Item -LiteralPath D:\Yellow\backups\yellow-order267-reconcile-20260829T022152Z.dump
Get-FileHash -LiteralPath D:\Yellow\backups\yellow-order267-reconcile-20260829T022152Z.dump -Algorithm SHA256
Get-Acl -LiteralPath D:\Yellow\backups\yellow-order267-reconcile-20260829T022152Z.dump
cmd.exe /d /c 'type "D:\Yellow\backups\yellow-order267-reconcile-20260829T022152Z.dump" | docker exec -i f4f02655770a997df7641c887fe241e6002c1de7d847eaafc9db873ed7c52d12 pg_restore -l'
```

The `pg_restore` catalogue was captured in memory and only its count was emitted.
Results are exact630,690 bytes, SHA-256
`b427ea1ae369ddd6c6aa043f154aedcc304671b7886b4213c54d1dd0662c5201`,
891 catalogue lines, and `pg_restore` exit0. Owner is `ASTHA\astha`, inheritance is
protected, and the only two non-inherited allow entries are FullControl for that
owner and `NT AUTHORITY\SYSTEM`.

An initial WSL-path attempt used `/d/Yellow/...`, returned file-not-found and fed no
bytes to `pg_restore`; the corrected native `cmd.exe type` pipeline above produced the
valid 891/exit0 proof. It created and restored nothing.

### Read-only PostgreSQL truth

Every successful query used the exact retained PostgreSQL container and:

```text
env 'PGOPTIONS=-c default_transaction_read_only=on' psql -X -U yellow_deploy -d yellow_dev -v ON_ERROR_STOP=1 -At
```

Catalogue SELECTs returned:

```text
database=yellow_dev
migration_count=44|min=1|max=44
migration44=44|0044_governed_positive_tax_posting.sql|5ea338b18aabb3cb2c5a4613c00ebf57806be881b956b13df1e2c95262cce55c
public_tables=98
rls_policies=88
properties=2
scratch_count=0
```

For the digest, `pg_tables` in canonical table-name order generated only
`SELECT '<table>' || '=' || count(*) FROM public.<table>` statements through psql
`\gexec`. The 98 returned lines were joined in memory with LF and no trailing newline,
then hashed with .NET `SHA256.HashData`. Result: query exit0, 98 lines, 1,573 bytes and
exact SHA-256
`739b6a2d929a2278064e35935351f32fcc9290c16da2db9b5072e9640ed28763`.

Two harmless read-only harness probes preceded the final commands: role `postgres`
was absent, so the exact non-secret container role name `yellow_deploy` was selected;
and the migration checksum column was corrected from `checksum` to
`checksum_sha256` after an `ON_ERROR_STOP` column error. Neither failed probe executed
a write, and the complete corrected catalogue and digest proofs were restarted.

### Logging-safe HTTP, populated defaults and authenticated status

A Bun verifier was supplied only on standard input to the exact app container:

```text
<constant-output verifier source> | docker exec -i b084c60b9fe615f4aed9197dd71e7d77ddfdeb88e5a42496b039f55ef06f2c2f bun -
```

The verifier read the three protected local-review defaults only from the process
environment inside the retained app container, compared them in memory to the served
HTML, posted them to the loopback login endpoint, held the returned access token only
in memory, and emitted constant assertion results. Its catch path allowed fixed
assertion codes only. It never printed, serialized for evidence, individually hashed,
or passed a protected value or token on a command line.

Exact emitted results:

```text
protected_defaults=three_nonempty_in_memory
root=200|cache=no-store|form=autocomplete-off|defaults=tenant,email,masked-password-populated
health=200
asset_operator.css=200|bytes=291803|cache=no-cache
asset_operator.js=200|bytes=663073|cache=no-cache
asset_operator-deposits.css=200|bytes=963|cache=no-cache
asset_operator-deposits.js=200|bytes=11626|cache=no-cache
asset_operator-local-prefill.js=200|bytes=490|cache=no-store
protected_login=200|access-token-present-in-memory-only
properties=200|count=2|unique=2
status_1=200|latest=262|current=263|reviewed=91|active=7|app=operational|database=yellow_dev|tenant-context=true
status_2=200|latest=262|current=263|reviewed=91|active=7|app=operational|database=yellow_dev|tenant-context=true
verifier=PASS|protected-values-not-emitted
```

Thus root, health, protected login and all five operator assets are HTTP200; root is
exactly `no-store`; the form and all three fields disable autocomplete; tenant, email
and password are populated from their exact private defaults; the password input is
masked; authenticated discovery returns two unique properties; and both properties
return exact latest262/current263/review91/active7 snapshots with live app/database
and tenant-context truth.

### Sole application port

A `System.Net.Sockets.TcpClient` direct loopback probe with a one-second bound and
`Get-NetTCPConnection -State Listen` returned:

```text
port_3000=open
port_3002=closed
port_3188=closed
listener=127.0.0.1:3000
```

Combined with exact container port bindings, this proves one loopback application on
3000 and no local application listener on 3002 or 3188.

## No-mutation statement

This reviewer did not start, stop, restart, recreate, remove or reconfigure any
container, image, network or volume; did not run Compose; did not mutate a database,
schema, row, role, cache, credential, token, application runtime or product file; did
not run a migration, seed, restore or Order266 proof; and did not expose any protected
password, database URL, secret or access token. PostgreSQL inspection was forced
transaction-read-only. HTTP authentication was the explicitly required current-login
assertion and retained its password/token only in process memory.

No temporary verifier file was created, so no verifier cleanup was required. Apart
from this review record, the reviewer wrote no repository file and did not touch the
pre-existing unrelated untracked paths.
