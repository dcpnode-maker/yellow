# Order 258 — sole-local Orders256–257 promotion verification

**Conclusion:** PASS — local-only operational verification

**Served source:** `f6089d4ca64925e8c4c152b5410b6fa62cd9862f`

**Verifier:** independent non-operating Codex worker

## Scope and method

The verifier did not build, restart, replace, migrate, seed, back up, edit product
source, inspect or print credentials, mutate data, or alter Git or the running
containers. Read-only Docker inspection, an explicit read-only PostgreSQL
transaction, protected-file metadata/hash inspection, loopback HTTP probes and
byte-level served-source comparisons were performed against the completed
promotion. Sign-in values and the short-lived access token remained only in process
memory. This review file is the sole verification write.

The exact branch was `phase-7/promote-orders256-257-local` at
`f6089d4ca64925e8c4c152b5410b6fa62cd9862f`.

## Reversibility and protected backup

`Get-Item`, `Get-FileHash -Algorithm SHA256` and `Get-Acl` against
`D:\Yellow\backups\yellow-pre-order258-20260828T220705Z.dump` returned:

- size: 692,752 bytes;
- SHA-256: `3941439acfd736f357e129854b3e9f0318e0287081826eb00979b164c6d0a146`;
- owner: `ASTHA\astha`;
- inheritance protected: true;
- exactly two non-inherited allow rules, both FullControl, for the current user and
  `NT AUTHORITY\SYSTEM` only.

The read-only catalogue command
`cmd /c type <protected-dump> | docker exec -i yellow-order175-folio-responsive-containment-postgres-1 pg_restore -l`
completed successfully under PostgreSQL 16.15 and produced 1,269 restore entries
(1,284 output lines including catalogue comments). No restore was attempted.

`docker image inspect yellow-order258-rollback:pre-orders256-257` resolves exactly to
the prior application image
`sha256:f15586b35662f19791aec67f1dbaa23022c8282ef8474e43b7d2c18532e9e398`.

## Exact sole-local topology

`docker ps --no-trunc` and read-only `docker inspect` returned exactly the expected
three-container compose project:

- application id
  `f76185512569890b02ac2ce0a39218c6ed23c118b30f5c79339e90e414b85633`,
  image id
  `sha256:19c4546a2a0931af00cf8d8e130e51353ce4bf3caf5da2a6ad00a1184d0648de`,
  running and healthy, bound only to `127.0.0.1:3000`;
- PostgreSQL id
  `b0a92182a16a0cb1f5ac4c33fabb73bce498a2f84622007370d7e30695bc0d0f`,
  running and healthy;
- Valkey id
  `ae62afc8df693ee4cb646007317dbbfe120884278752d16817a72f716c402834`,
  running and healthy.

PostgreSQL retains the exact named volume
`yellow-order175-folio-responsive-containment_yellow-pgdata` mounted at
`/var/lib/postgresql/data`. All three containers carry the compose-project label
`yellow-order175-folio-responsive-containment`.

`Get-NetTCPConnection -State Listen` found one relevant listener only:
`127.0.0.1:3000`. Bounded loopback connection probes returned
`3000=true`, `3002=false`, `3188=false`.

## Database and two-hotel truth

The verifier piped the following query through the existing PostgreSQL container's
configured owner identity without exposing its environment:

```sql
BEGIN READ ONLY;
SELECT count(*), min(version), max(version) FROM public.schema_migration;
SELECT count(*) FROM information_schema.tables
 WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
SELECT count(*) FROM pg_policies WHERE schemaname = 'public';
SELECT count(*) FROM public.org_node WHERE kind = 'property';
COMMIT;
```

The exact result was migration ledger `42 / 1 / 42`, 96 public base tables, 86
public policies and two properties. The transaction began with `BEGIN READ ONLY`
and completed with `COMMIT`; no database write or migration runner was invoked.

## Founder access and exact status

Loopback requests returned HTTP 200 for both `/` and `/health`. The root carried
`Cache-Control: no-store`. A value-redacting structural inspection found the local
form protected with `autocomplete="off"`, all three fields populated, every field's
protected default equal to its populated value, and the password input masked with
`type="password"`. No value was printed or persisted.

The verifier then extracted those values only into process memory, posted the exact
three-field JSON shape to `/api/v1/auth/local:login`, kept the returned token in
memory, and discarded all of them after the checks. Results were:

- login HTTP 200 and a non-empty in-memory token;
- `/api/v1/me/properties` HTTP 200 with exactly two properties;
- both authenticated `/api/v1/properties/{property}/system-status` requests HTTP
  200, live app and database `operational`, tenant context true;
- both snapshots exactly
  `2026-08-29 / latest256 / current257 / review91 / active7`.

## Served-source identity

`git diff --quiet HEAD --` confirmed both promotion-critical source paths are clean.
`Get-FileHash -Algorithm SHA256` on the committed working-tree files and
`docker exec ... sha256sum /app/<path>` on the served container matched exactly:

- `src/project-status.ts` —
  `14af72384a3c70787984097e717d486955dc67fcd7cf62bcf44653024f9a1152`;
- `src/contexts/tax-fiscal/folio-eligibility.ts` —
  `d2d1801902596049a72e429939e7ef968a667905af1347ab55a8432bcb7e4456`.

## Finding and boundary

No blocking operational finding was found. Order258's app-only sole-local promotion
is independently approved. This is not product review and does not increase review
coverage above 91, merge, expose publicly, deploy to production, or claim Phase or
application completion.
