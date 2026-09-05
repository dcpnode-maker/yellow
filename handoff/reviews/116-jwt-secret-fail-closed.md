# Independent review — Order 116 JWT signing-secret fail-closed startup

**Verdict:** APPROVED  
**Risk tier:** 3  
**Reviewer:** independent non-implementing OpenAI Codex reviewer  
**Implementation reviewed:** `f15e142803fe9bf6859176e7e4334419a8202bd6`  
**Required red parent:** `f7865f2c134989a0014ca0b856b094a255e4763c`  
**Order:** `handoff/orders/116-jwt-secret-fail-closed.md`

This approval is exact-SHA and exclusive to `auth.repository-known-jwt-signing-key`
(`occ_f1bd4c1fcb48b0ae894a4f29`). It does not approve a branch name, later commit,
merge, deployment, or any sibling Cyber finding.

## Findings

No implementation finding.

The implementation keeps D-91's HS256 algorithm, exact claim set, 15-minute TTL and
60-second verification leeway unchanged. The enabled runtime obtains the required secret,
constructs `Hs256TokenSigner`, and therefore rejects an absent, short, retired legacy, or
documented-placeholder key before `runtimeApp()` returns to `.listen()`. Workbench-disabled
startup returns the database-free health application without constructing a signer.

Compose now supplies only `YELLOW_TOKEN_SECRET: "${YELLOW_TOKEN_SECRET:-}"`. The tracked
`.env.example` uses the real variable name with an empty value. Both setup paths generate
48 bytes from their platform CSPRNG only for non-DB setup when the caller supplied no value,
do not write `.env`, do not print the value, and preserve a caller-supplied fresh key.

The reviewed range changes only files authorized by Order 116. No migration, JWT claims,
password behavior, tenant/RLS surface, public binding, dependency, or founder-status
completion claim changed.

## Reviewer-executed evidence

All application commands below ran from isolated checkouts. All Compose commands used
unique projects and ports; the live `yellow` project and builder branch were not touched.

### P0 — exact parent red

Detached parent worktree at `f7865f2c134989a0014ca0b856b094a255e4763c`:

```text
bun test tests/jwt-runtime-secret-security.test.ts
```

Result: `1 pass, 3 fail`. The passing test issued and verified a normally accepted operator
token with the repository-known legacy key. The three hardened assertions failed because
the parent signer accepted that key, `.env.example` did not exist, and setup had no CSPRNG
generation. This is the required accepted-legacy-key condition, not a synthetic source-only
red.

### P1 — signer and source boundary

Exact implementation SHA:

```text
bun test tests/jwt-runtime-secret-security.test.ts
```

Result: `5 pass, 0 fail, 19 assertions`. Legacy, documented placeholder, empty/short
boundaries, two distinct fresh 48-byte keys, normal issue/verify, empty Compose default,
blank real environment example, and setup source rules passed.

Source and diff inspection additionally confirmed:

- the signer compares the exact retired values as bytes after the existing 32-byte floor;
- no entropy heuristic or JWT contract change was introduced;
- setup generation is outside the image and product runtime;
- PowerShell clears the temporary byte array and restores the prior caller environment;
- shell generation exports only within the setup process and unsets the temporary variable;
- neither setup path contains a secret-file write or secret-value logging path.

### P2 — startup and local workflow

Isolated project `yellow-order116-review-runtime`, app port `3518`:

```text
$env:YELLOW_OPERATOR_WORKBENCH='1'
Remove-Item Env:YELLOW_TOKEN_SECRET -ErrorAction SilentlyContinue
docker compose up -d --build app
```

Result: container `exited exit=1`; log reported
`YELLOW_TOKEN_SECRET is required when YELLOW_OPERATOR_WORKBENCH=1`; the port had no
listener.

```text
$env:YELLOW_TOKEN_SECRET='yellow-local-development-token-secret-change-before-deployment'
docker compose up -d --force-recreate app
```

Result: container `exited exit=1`; log reported
`repository-known HS256 secret is forbidden`; the port had no listener.

Direct Compose health-only command with workbench disabled and the secret absent:

```text
$env:YELLOW_OPERATOR_WORKBENCH='0'
Remove-Item Env:YELLOW_TOKEN_SECRET -ErrorAction SilentlyContinue
docker compose up -d --force-recreate app
```

Result: `running healthy`; `GET http://127.0.0.1:3518/health` returned exact
`200 {"status":"ok"}`. No database container was needed in this runtime project.

`./setup.ps1 -DbOnly` under isolated project `yellow-order116-review-db` on ports
`3517/5517/6517` applied eleven migrations, produced 85 tables, passed the referee
`11 passed, 0 failed of 11`, and left `YELLOW_TOKEN_SECRET` absent.

Normal setup was executed from fresh app-never-started isolated projects on both supported
paths:

```text
./setup.ps1
./setup.sh
```

PowerShell project `yellow-order116-review-setup` (`3520/5520/6520`) and WSL project
`yellow-order116-review-sh` (`3521/5521/6521`) each passed their own referee 11/11 and
returned exact app health 200. For each run, the reviewer captured all setup output, read
the generated runtime value from the disposable container without displaying it, and
asserted the value was absent from captured output. Both printed only the generation
notice, created no `.env`, and left no secret in a new caller shell. The PowerShell path
also restored its prior caller environment.

After stopping only the disposable PowerShell review app, a second normal setup run used a
reviewer-generated 48-byte CSPRNG value. The container retained that exact supplied value,
captured output did not contain it, the generation notice was absent, and the caller value
was restored. Its referee again passed 11/11 and app health was 200.

### P3 — authentication regression and real login

The seeded two-tenant invariant fixture in `yellow_test`:

```text
$env:YELLOW_REQUIRE_AUTH='1'
$env:YELLOW_AUTH_URL='postgres://yellow:yellow@127.0.0.1:5517/yellow_test'
bun test tests/auth.integration.test.ts tests/token.test.ts
```

Result: `12 pass, 0 fail, 37 assertions`. Tenant A saw 16 spaces and tenant B saw zero;
the exact D-91 claims, fixed HS256 algorithm, 15-minute issuance, skew behavior, tamper
rejection, uniform credential failure, and Argon2id behavior remained green.

A separate database, `yellow_workbench`, was created empty, migrated through all eleven
migrations, and used only for the Order 042 fixture:

```text
$env:YELLOW_REQUIRE_OPERATOR_WORKBENCH='1'
$env:YELLOW_OPERATOR_WORKBENCH_URL='postgres://yellow:yellow@127.0.0.1:5517/yellow_workbench'
bun test tests/operator-workbench.integration.test.ts
```

Result: `7 pass, 0 fail, 87 assertions`, including database-backed login, uniform failures,
bearer/scope/property authorization, exact and ancestor grants, reusable rejected
connections, memory-only browser token behavior, and disabled health-only behavior.

For the real container login, the reviewer seeded only the isolated `yellow_dev`, generated
48 fresh bytes with `RandomNumberGenerator.Fill`, set the base64 value only in the Compose
invocation, built the exact app image, and never printed the secret or returned token.
`POST /api/v1/auth/local:login` returned 200, `Bearer`, `expiresInSeconds=900`; the returned
token successfully called `/api/v1/me/properties` and saw one authorized property. The
reviewer process then cleared the value.

### P4 — standing gates

```text
bun test
bun run typecheck
bun run boundaries
```

Results: `153 pass, 394 skip, 0 fail, 1,839 assertions`; TypeScript clean; import boundaries
clean with `63 TypeScript files scanned`.

Because this Windows worktree's `node_modules` is a junction, the first local licence CLI
saw zero packages. The reviewer corrected that environment precondition by copying the
same installed tree into an ephemeral Linux container and reran the unchanged checker:

```text
docker run --rm --mount type=bind,src=<exact-worktree>,dst=/repo,readonly \
  --mount type=bind,src=<installed-node_modules>,dst=/mods,readonly \
  -w /work oven/bun:1.3.14-alpine \
  sh -lc 'cp -R /mods /work/node_modules && bun /repo/scripts/license-check.ts'
bun audit
```

Results: licence policy passed for `23 installed package(s)`; `No vulnerabilities found`.

```text
$env:COMPOSE_PROJECT_NAME='yellow-order116-review-db'
$env:YELLOW_SCHEMA_DATABASE='yellow_dev'
bun run schema:check
```

Result: schema exactly matched `tests/schema/expected.sql`.

Protected SHA-256 values remain exact:

- `migrations/0001_init.sql` —
  `fe2a9fc949c6bacded3f8d3fc4d14fc596a83ebde9aeb043eb10845f07b30923`
- `tests/run_invariants.py` —
  `3228279bd99a8f9b6af99748f31d4d4b482a8e627e16d92644d9d859ad8befa1`

`git diff --check f7865f2..f15e142` passed, and the exact implementation worktree was clean
before this reviewer-authored record.

## Disclosed reviewer precondition corrections

These are not represented as green product evidence:

1. The first normal PowerShell setup canary reused a stack whose app was already running.
   Those app pools consumed PostgreSQL connections, and TC-8.2 issued only 81/100 invoice
   numbers, producing referee 10/11. The reviewer discarded that run and restarted the
   complete setup proof on a fresh app-never-started project, which passed 11/11.
2. The first WSL wrapper had PowerShell-to-bash nested-quote parsing errors and executed no
   Order 116 assertion. A simplified bounded invocation then ran `setup.sh` successfully;
   its captured-output assertions and referee passed as reported above.
3. The first junction-backed licence scan returned zero packages. It was not accepted; the
   real installed tree was scanned in an ephemeral Linux directory and passed 23 packages.

## Residual Cyber findings — fourteen remain open

Order 108 already discharged only `database.security-definer-temp-shadowing`, and this
review discharges only `auth.repository-known-jwt-signing-key`. The remaining sealed scan
inventory is exactly:

1. `auth.unbounded-local-login` — medium — `occ_53a4e9f042a7a3534d9830fb`
2. `database.caller-controlled-rls-tenant` — high — `occ_48ef46aabb565be569c6e79d`
3. `database-grants.runtime-role-direct-dml` — medium — `occ_f0526a0906f1b0b5a72edf0c`
4. `database.occupancy-caller-tenant` — high — `occ_2f4ca8c2e6f1d7352ba849c8`
5. `database.public-destructive-maintenance` — high — `occ_0c5b4cfc4934049849c99d8f`
6. `database.runtime-bootstrap-superuser` — high — `occ_235bd4dcea3d48cd3f611759`
7. `supply-chain.unpinned-project-mcp` — medium — `occ_f2201362eef2a3df87abf1b3`
8. `actorless-api-idempotency` — low — `occ_2160f7211ebce346c54b759e`
9. `unbounded-external-rate-intent-requests` — medium — `occ_227ec2963a84e30663d4d7db`
10. `regular-expression.unbounded-extension-schema` — low — `occ_623ba52de928bfe323127e66`
11. `supply-chain.mutable-container-tags` — low — `occ_b05bc911e6d4fb6de7b6382e`
12. `broken-property-authorization.party-search` — low — `occ_ba3b2f7be81a2793ac34384a`
13. `authorization.party-duplicate-oracle` — low — `occ_a18c087af2ee0041e610dc85`
14. `privacy.reservation-notes-durable-events` — low — `occ_0f9a3b20577c0bf2f247d392`

## Conclusion

Order 116 is APPROVED at exact SHA
`f15e142803fe9bf6859176e7e4334419a8202bd6`. No self-merge or deployment action was taken.
