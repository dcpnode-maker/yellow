# Order 325 fresh non-operating Tier 3 review

**Disposition: APPROVE**

**Reviewer:** Codex, fresh independent non-operating Tier 3 reviewer

**Governance candidate:** `409be214113b7d5f001e3d3b4c2192a43f48797f`

**Runtime source:** `c3afab2b86e57be7ab6445322f42dfb6e8f648ab`

**Running image:** `sha256:58ad2103d6d254bb2cd56b3b192ea9fc2f6d58ceed5ca312a88f3f37b9823456`

## Disposition

**APPROVE** the exact Order 325 candidate, runtime and image above with no finding.
I did not implement or operate this refresh. I read `PROJECT.md`, ran `./state.sh`,
read Order 325, D-905/D-906, the Order 324 review and the Order 323 rereview, then
personally executed the runtime, browser, focused-test and database proof below.

All review operations were read-only except the required local authentication request
and transient in-browser field, workspace-detail, property, appearance and route state.
I did not start, stop, restart, rename, replace, create or delete a container, image,
network or volume, and did not modify application data, credentials or recorded status.

## Exact runtime, topology and preservation

- `yellow-order325-app:c3afab2` resolves to the exact image and OCI revision above.
  Container id is `e5541d7c1779d56b068250c9505db1b89f80509f5028369380b64172940ec1d5`.
- It was the sole UI publisher at `127.0.0.1:3000->3000/tcp`, running healthy with
  restart count 0 on `yellow_order311_local`. Its exact health command remained
  `wget -q -O /dev/null http://127.0.0.1:3000/health`; `/health` returned HTTP 200
  and exact `{"status":"ok"}`.
- `yellow-order323-app-rollback-d901` remained stopped with restart count 0 and exact
  approved revision `9bc9ad2e3463e8588d16b2c382cf15a589272628`.
- Current and rollback environments each had 24 names and identical secret-safe
  sorted-value SHA-256
  `08212c62fddd8175c874f54292c262629af8ccff89231009dd2f56387e3d4a95`.
  No value was printed or recorded.
- PostgreSQL, provider and Valkey were healthy with restart count 0 on the inherited
  network. Intended ports 3000, 3001 and 6389 were open; obsolete 3002, 3123 and
  3188 were closed.

## Protected login, routes and recorded status

A fresh real in-app browser loaded the signed-out loopback root and the protected
prefill helper. After a delayed load, the one submit button was enabled. Direct
browser clearing followed by focus, pageshow and visible lifecycle signals restored
all three non-empty process defaults; distinct non-empty founder-marker values
survived the same focus signal. No credential value was read, printed or persisted.
Clearing the markers restored the protected defaults and one button activation
authenticated `Yellow Review Operator` with exactly two properties.

A token-bound live browser probe covered Today, Availability, Reservations, Folios,
Operations, Inventory, Restrictions, Rates, Housekeeping, Vehicles, Cashiers and
Project status for both properties: **24/24 HTTP 200 with exact `no-store`**. Live
Project status remained exact: Order 310 built, current order 311, 91 independently
reviewed orders, Phase 7 active and invariant referee 11/11 required.

## Personally executed live-browser acceptance

Both properties across Simple, Advanced and Expert produced **6/6 green cells**.
Every cell proved the Simple catalogue preview, `nav-operations` label and management
journey action say exact `Room outages`; the generic `Operations` label is absent from
those scoped labels; activating the existing journey reaches the canonical property
`/operations` route, exposes the existing workspace, focuses `operations-title`, and
shows exact heading `Out of order and out of service`.

Apple, Android, Windows 95/98, Glass, Neo and ERP each kept the changed action visible
and contained at 375 x 900 with zero horizontal overflow. The label remained contained
at 812 x 375 landscape and at the bounded 200% device-scale proof. Reduced-motion and
forced-colour emulation were active at 375 x 900 with the changed surface contained
and zero overflow. Browser console warnings/errors were **0**.

No business action was activated. The required login was the only write-like request;
unchanged final `fact_log` and `outbox` counts corroborate **business mutations 0**.

## Personally executed focused and database proof

Focused command:

`bun test tests/local-login-prefill.security.test.ts tests/operator-room-outages-label-alignment.intentional-red.test.ts tests/operator-management-demo-navigation-finetune.intentional-red.test.ts tests/operator-arrival-departure-journey-alignment.intentional-red.test.ts tests/operator-today-command-centre.integration.test.ts tests/operator-today-operational-routing-ui.integration.test.ts tests/operator-today-operational-routing.integration.test.ts tests/operator-adaptive-experience.test.ts tests/operator-appearance-geometry.test.ts tests/operator-ui-foundation.test.ts`

Result: **45 pass, 0 fail, 565 assertions across 10 files**, including real Chromium
geometry, protected-prefill lifecycle security, exact labels and preserved route/
identity, adaptive modes, six appearances and accessibility rules.

Explicit `BEGIN READ ONLY`/`ROLLBACK` PostgreSQL probes before and after browser work
were identical: **59** schema migrations, **110** public base tables, **2** public
views, **100** public policies, **2** properties and party/contact-point/party-role/
fact-log/outbox counts of **8/0/8/75/22**.

`git diff --check 409be214113b7d5f001e3d3b4c2192a43f48797f` passed. The pre-existing
untracked `.yellow/` directory remained the only unrelated worktree status and was
not modified.

## Approval boundary

Approval is limited to this exact app-only reflection of independently approved Order
324. It grants no database, credential, permission, business, financial, statutory,
recorded-status, post-310, public-network, deployment, rollback-deletion, merge or
push authority.
