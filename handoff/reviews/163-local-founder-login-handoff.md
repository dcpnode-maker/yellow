# Operations evidence — Order 163 persistent founder login handoff

**State:** BUILT LOCALLY — independent post-cutover verification pending
**Approved executable:** `a4178ce4b3bdf1fd95b097439287802a1edb7f8c`
**Runtime image:** `sha256:83a51f63ff284cab011b3405429ff3fda74bc6fc05251dbf591f271bf2433665`
**Operator:** OpenAI Codex operations
**Date:** 2026-08-26

## Scope and credential boundary

I read `PROJECT.md`, ran `./state.sh`, and read Order163 and D-430 before
operating. No product, test, migration, schema, role, permission, UI, status or
dependency source was edited. There was no merge, push, public bind, old-data
mutation or destructive cleanup.

Before generating credentials I added only
`.yellow/order163-founder-login.env` to the worktree's local
`.git/info/exclude` and proved it with `git check-ignore`. The generated runtime
authority path is also locally excluded (and already matched the tracked private
authority ignore). Final `git status --short` was empty before this evidence.

Exactly two distinct 48-byte base64url founder-login values were generated once.
The handoff file contains exactly these keys:

- `YELLOW_REVIEW_PASSWORD`;
- `YELLOW_REVIEW_APPROVER_PASSWORD`.

It was atomically installed without printing either value. Windows ACL inheritance
is disabled and the only two explicit entries are allow/full-control for the current
user and SYSTEM; there are no inherited, broad or deny entries. The passwords were
used only as process environment for the governed seed and redacted HTTP harness.
Neither password is present in any app container environment, Compose file, command
argument, log, chat or tracked file. The ignored protected handoff remains for the
founder and independent reviewer.

## Pre-mutation and rollback record

Immediately before endpoint replacement, both existing surfaces returned HTTP 200.
The exact serving containers were:

- port 3000: `yellow-order161-local-active-app-1`, container
  `4ba98b1a98f4a12153d6ff091ffb372d3a33faffa678e1949c34f4a552088eaf`,
  image `sha256:83a51f63ff284cab011b3405429ff3fda74bc6fc05251dbf591f271bf2433665`,
  revision `a4178ce4b3bdf1fd95b097439287802a1edb7f8c`;
- port 3002: `yellow-order161-local-active-preview-1`, container
  `4638e1972175955c9ce582ed6d4f315f88d9a949491cd6866418bd9218f4268e`,
  the same exact image and revision.

Their networks and images were captured before mutation. Final Docker inventory
still contains 16 Order147/159/161 containers, three corresponding networks and
three corresponding volumes. The two superseded Order161 app containers remain
intact and stopped at the same exact IDs and images. All older PostgreSQL, Valkey,
image, network and volume rollback resources remain retained; no setup, migration or
seed command targeted an old project.

## Fresh governed stack

The isolated project is `yellow-order163-local-founder-login`. Its PostgreSQL and
Valkey publish only on `127.0.0.1:5643` and `127.0.0.1:6590`. `setup.sh --db-only`
completed all 17 migrations, normal seed and a fresh referee result of **11 passed,
0 failed of 11**. `bun scripts/seed-review.ts` then completed the governed review
seed using the exact two persistent credentials.

Final infrastructure identities are:

- PostgreSQL `3b41170d710a26fbe81c65b06895fb8496affaba56edb297be934f38dc043f62`,
  healthy, with retained volume
  `yellow-order163-local-founder-login_yellow-pgdata`;
- Valkey `9ff3e3e55857221c675819c27174aa13c1b2f4e1a78c68069dfa79dfbe292053`,
  healthy;
- network `yellow-order163-local-founder-login_default`.

The two staging containers on loopback 3100 and 3102 were distinct, healthy, exact
image/revision matches and contained no review-password variables. Each separately
passed a redacted served-HTTP journey:

`login 200 -> one granted property -> Party create/replay 201 -> masked Party search
200 -> availability 200 (five bookable offers) -> hold/replay 201 -> reservation
commit/replay 201 -> confirmation GET 200 -> system status 200`.

The staging containers are retained stopped after successful cutover.

## Guarded endpoint replacement

For the port-3002 cutover, a background monitor sampled port 3000 throughout stop,
create, health, identity and full journey proof. All 14 samples returned HTTP 200.
The new 3002 container passed the same full redacted journey before acceptance. Only
then did the port-3000 cutover proceed. A symmetric monitor sampled port 3002
throughout; all 15 samples returned HTTP 200, and the new 3000 container passed the
full journey before acceptance. No rollback was required.

Final serving identities are:

- port 3000: `yellow-order163-local-founder-login-app-3000`, container
  `03699305f8db59f4f4421366b2ffbb4e9dbf2e0f48b146c59c91269698f437a8`;
- port 3002: `yellow-order163-local-founder-login-preview-3002`, container
  `d401d295c134a00e779e892015d9014b44286f924df9af92c7c93a5ad972e9a5`.

Both are simultaneously running and Docker-healthy, publish only their single
loopback port, use only the Order163 network, resolve to exact image
`sha256:83a51f63ff284cab011b3405429ff3fda74bc6fc05251dbf591f271bf2433665`,
carry revision `a4178ce4b3bdf1fd95b097439287802a1edb7f8c`, and use the same fresh
`yellow_dev` database through runtime authority. Their final served health is 200.

## Commands and redacted results

The operative proof used these bounded command forms; secret values were never
included in command arguments or captured output:

- `git check-ignore -v -- .yellow/order163-founder-login.env` — local exclude match;
- `./setup.sh --db-only` with explicit project/port names and the WSL environment-name
  bridge — 17 migrations, normal seed, referee 11/11;
- `bun scripts/seed-review.ts` with private process environment — governed seed passed;
- `docker compose -p yellow-order163-local-founder-login run -d --name ... -p
  127.0.0.1:<port>:3000 --no-deps app` — two stage and two final distinct containers;
- redacted `bun -e` served-HTTP harness — two staging and two final full journeys passed;
- `docker inspect` image/revision/network/binding/environment checks — exact identity,
  loopback-only binding, common fresh DB and absence of login-secret environment;
- continuous `Invoke-WebRequest /health` monitors — 14/14 and 15/15 unaffected-port
  samples passed.

## Discarded preconditions and corrections

- The first atomic handoff move failed closed because `.yellow` did not yet exist.
  Its temporary file was removed, no value was exposed, and the same two values were
  installed after creating the private directory.
- The first WSL setup invocation could not see Bun and made no resource change. A
  temporary ignored Bun bridge was created and later removed.
- WSL initially did not inherit the requested non-secret project/port variables. It
  created a new empty misnamed Order163 Compose project and failed on occupied port
  5442 before provisioning, migration or seed. Only those two verified failed-new
  containers, their new empty volume and network were removed; both old endpoints
  remained HTTP 200. Setup was restarted under the exact project and ports.
- Windows Bun initially did not receive WSL-local authority variable names and failed
  before provisioning. An explicit name-only `WSLENV` bridge corrected this, after
  which the complete setup and referee restarted and passed.
- The first private file label used `YELLOW_APPROVER_PASSWORD`; the governed seeder
  rejected it before review mutation. Without regenerating either value, the file was
  atomically replaced under the same restricted ACL with the contract key
  `YELLOW_REVIEW_APPROVER_PASSWORD`; the governed seed then passed.
- The first staging Compose command failed before container creation because Compose
  validates the deploy-password placeholder for inactive tool services. The existing
  private authority was supplied through process environment only, and both staging
  launches then passed.

## Handoff

The local operation is complete but not self-approved. An independent non-operating
reviewer must read the protected ignored file, independently test login and the
redacted journeys on both ports, verify exact identities/ACL/rollback retention, then
record the Order163 verdict. After that review, process copies must be cleared again;
the founder handoff file remains until the founder requests retirement.
