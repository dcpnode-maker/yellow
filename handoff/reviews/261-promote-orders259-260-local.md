# Order 261 — independent sole-local promotion verification

**Verdict:** **APPROVED LOCALLY**

**Verifier:** independent non-operating OpenAI Codex Tier-3 reviewer

**Reviewed branch:** `phase-7/promote-orders259-260-local`

**Order commit:** `fda25b5549f2bb6b1baa5003632fd9b1507870b4`

**Promoted source:** `2ae5f2a`

## Scope and method

I read `PROJECT.md`, ran `./state.sh`, and read Order 261 before inspecting the
completed promotion. I did not build, restart, replace, migrate, seed, provision,
back up, restore, alter credentials, change data, modify Git, or operate the stable
containers. The checks used read-only filesystem/ACL/hash inspection, Docker
inspection and image export, read-only PostgreSQL queries, and loopback HTTP
requests. Protected sign-in values and the access token existed only in process
memory and were neither printed nor persisted. This review file is the sole write.

## Backup and rollback evidence

Read-only `Get-Item`, `Get-FileHash -Algorithm SHA256`, and `Get-Acl` checks of
`D:\Yellow\backups\yellow-pre-order261-20260828T230253Z.dump` returned:

- non-empty custom-format backup, 692,752 bytes;
- SHA-256 `9f77cff0b1321e9ec96448547d0be242cf5c91c9f6208ed555f1dcc00c681038`;
- owner `ASTHA\astha`, ACL inheritance protected;
- exactly two non-inherited FullControl allow rules: the owner and
  `NT AUTHORITY\SYSTEM`.

PostgreSQL 16.15 `pg_restore -l` read the backup without restoring it and returned
1,269 catalogue entries. The parent `D:\Yellow\backups` directory itself inherits
eight ACL rules. That is a non-blocking hardening note because the dump file has its
own protected owner/SYSTEM-only ACL.

`docker image inspect yellow-order261-rollback:pre-orders259-260` resolves to the
exact prior application image
`sha256:19c4546a2a0931af00cf8d8e130e51353ce4bf3caf5da2a6ad00a1184d0648de`.

## Sole-local topology and continuity

Read-only `docker ps --no-trunc` and `docker inspect` returned exactly the expected
three-container Compose project:

- app id `d23532f1782a12f3d0d52d1996c2dbd3724b2bf65e6b49c5b8b6f94440140874`,
  image
  `sha256:dab955b933ed92854c66cb9e87655d8d41a51c95805eda26890b7c8d3cc738b6`,
  running and healthy on `127.0.0.1:3000` only;
- PostgreSQL id
  `b0a92182a16a0cb1f5ac4c33fabb73bce498a2f84622007370d7e30695bc0d0f`,
  running and healthy;
- Valkey id
  `ae62afc8df693ee4cb646007317dbbfe120884278752d16817a72f716c402834`,
  running and healthy.

PostgreSQL retains the exact named volume
`yellow-order175-folio-responsive-containment_yellow-pgdata` at
`/var/lib/postgresql/data`. Bounded loopback probes returned `3000=true`,
`3002=false`, and `3188=false`; `/health` returned HTTP 200.

The PostgreSQL and Valkey ids and PostgreSQL volume exactly match the recorded
pre-promotion Order 258 baseline. No second local application was present.

## Database preservation and migration 43

Queries were executed through the existing PostgreSQL container with
`default_transaction_read_only=on`. Results were:

- migration ledger: 43 rows, minimum 1, maximum 43;
- row 43: `0043_positive_tax_semantic_route.sql`, checksum
  `a5036df30f07c4c8add08c46cdb805c71b87597efa542e368e64aa35d572bf40`;
- 97 public tables and 87 public policies;
- `tax_semantic_route`: zero rows;
- one tenant and exactly two property nodes, both retained with their prior ids,
  tenant ownership, names, time zones and currencies.

For count-drift proof, I compared all current pre-existing non-ledger tables against
the protected pre-Order255 95-table baseline count file. Excluding only the new
`tax_semantic_route` and the migration ledger, the comparison covered exactly 95
tables and returned zero mismatches. The canonical current count-pair digest was
`3f8b8a7918fa18e1e4289d4c3e31aa2bffb767642ff24a794409f8f438484e76`.
This confirms no pre-existing table count drift across the intervening empty
lineage/schema additions and this promotion.

## Protected one-click sign-in and both properties

Loopback `/` returned HTTP 200 with `Cache-Control: no-store`. Structural inspection
without printing values proved:

- the login form has `autocomplete="off"`;
- tenant, email and password are all populated;
- each populated value equals its protected local default;
- the password field is masked with `type="password"`.

The exact three values were extracted only into process memory and posted to
`/api/v1/auth/local:login`. Login returned HTTP 200 and a non-empty in-memory token.
`/api/v1/me/properties` returned HTTP 200 and exactly two properties. Both
authenticated system-status requests returned HTTP 200, `Cache-Control: no-store`,
operational app/database state, valid tenant context, and the exact same recorded
snapshot:

- recorded date `2026-08-29`;
- latest built order `259`;
- current order `260`;
- independently reviewed through order `91`;
- active phase `7`.

## Served-source identity

`git diff --quiet 2ae5f2a -- <path>`, working-tree SHA-256, and read-only hashes from
the served app image matched exactly:

- `src/project-status.ts` —
  `c7f93081735cea8c7a03f6c793e5d795f7a3feb079dd1de98ddf7fc3903552a8`;
- `src/contexts/tax-fiscal/semantic-route.ts` —
  `46d68766eea9217fc15d3df74619c86e2c867c6c63d91898a1ea41982917906d`.

A read-only export of the retained migration image located exactly one
`app/migrations/0043_positive_tax_semantic_route.sql` layer entry. Its SHA-256 was
`a5036df30f07c4c8add08c46cdb805c71b87597efa542e368e64aa35d572bf40`,
equal to the clean committed file and live migration ledger.

## Conclusion and boundary

No blocking operational finding was found. Order 261's reversible sole-local
migration-43 and app promotion is independently approved. This approval is local
only: it does not increase product-review coverage, authorize authoring or posting,
merge Git history, expose the service publicly, deploy to production, destroy
rollback resources, complete Phase 7, or claim the application is complete.
