# Order 317 fresh non-operating Tier 3 review

**Disposition: APPROVE**

**Reviewer:** Codex, fresh non-operating Tier 3 reviewer

**Governance candidate:** `fd1f7a63f99dd9ad1337289b146fc6da8685d99f`

**Approved runtime source:** `d81de9ce4abf820c4aa529fe7ba8407bb990cc2c`

**Running image:** `sha256:56f4caafd3ad54102e14fd4490818b60813acfa4545433b00717dc47a4958477`

No findings.

## Scope and exact identity

I read `PROJECT.md`, current state, Order 317, D-877, D-878 and D-879 before review. `git rev-parse HEAD` returned the exact governance candidate. `git diff --name-only d2522e2..fd1f7a...` contained only `BUILD-PLAN.md`, `DECISIONS.log`, `handoff/LEDGER.md`, `handoff/ROADMAP.md`, and Order 317; `git diff --check` passed. The pre-existing untracked `.yellow/` directory was otherwise the only worktree status.

Read-only image inspection proved tag `yellow-order317-app:d81de9c` resolves to the exact required image SHA-256 and its OCI revision is exact `d81de9ce4abf820c4aa529fe7ba8407bb990cc2c`.

## Live topology, health and preservation

All inspection was read-only. I did not stop, restart, rename, replace or mutate any container, network, database, volume, environment, credential or business record.

- `yellow-order317-app` was running healthy, restart count 0, on network `yellow_order311_local`, with the sole UI publication `127.0.0.1:3000->3000/tcp` and health command `wget -q -O /dev/null http://127.0.0.1:3000/health`.
- `GET /health` returned HTTP 200 and exact `{"status":"ok"}`.
- `yellow-order315-app-rollback-d873` remained stopped, restart count 0, retained on its exact image and network with the same loopback bind/health configuration available for rollback. It was not started or altered.
- Current and rollback app environment arrays had identical names and identical secret-safe full-array SHA-256 `08212c62fddd8175c874f54292c262629af8ccff89231009dd2f56387e3d4a95`; no values were printed.
- PostgreSQL, provider and Valkey were each running healthy with restart count 0. PostgreSQL retained no host publication, provider retained loopback 3001, and Valkey retained loopback 6389.
- TCP probes: 3000, 3001 and 6389 open as intended; obsolete 3002, 3123 and 3188 closed.

### Read-only database digest

I executed an explicit `BEGIN READ ONLY`/`ROLLBACK` count transaction in the existing PostgreSQL container. Results were exact: 59 schema migrations, 110 public base tables, 2 public views, 100 public policies, 2 property org nodes; party 8, contact point 0, party role 8, fact log 75, outbox 22. No database write or test fixture was executed.

## Served byte identity and route proof

- Served `/assets/operator.css`: 299,348 bytes; source and served SHA-256 both `ec18817d74aef46c580c63b4a078e46566a491c8b2d3015db7cc038314bc6596`.
- Served `/assets/operator.js`: 664,238 bytes; source and served SHA-256 both `e6e0d05c35de1fd3b2a0324bf0d61662bfb46ebe7c3dd1ce0fa922a1d324acb7`.
- For both granted properties, all twelve explicit shell routes—Today, availability, reservations, folios, operations, inventory, restrictions, rates, housekeeping, vehicles, cashiers and status—returned HTTP 200 with exact `Cache-Control: no-store`: **24/24, zero failures**.

## Personally executed live-browser proof

I opened only the sole app at `http://127.0.0.1:3000` in a fresh protected browser session and used the existing prefilled one-click login without reading or exposing credential values.

- Login authenticated `Yellow Review Operator` and exposed exactly two properties: Yellow Demo Property and Yellow Identity Gate Review Property.
- Bare root synchronously canonicalized to the selected-property `/today` route. Today was active. Due-in settled at 3 records, due-out at 1, and in-house at 0; all three lanes had `aria-busy=false` and loading hidden.
- The journey index contained exactly seven controls: Today lanes, Reservations, Folios, Cashiers, Housekeeping, Vehicle register and Operations.
- In Simple, opening secondary workspaces and choosing Housekeeping produced the canonical route, selected Housekeeping, closed the overlay (`hidden=true`, `aria-expanded=false`) and focused `housekeeping-title`.
- Dirty cancellation was exercised from reservation creation after entering child ages `7`. Dismissing the confirm retained the exact `/reservations?new=1&step=stay` origin, retained active Reservations and retained the entered value; Operations did not open.
- Clean Today → Reservations → Folios routing created canonical history. Back/Forward restoration is covered by the exact served Order316 byte identity and the fresh executable routing proof below; browser-control waiting itself exceeded its bounded interaction deadline without a console or application error.
- Direct secondary restoration, Advanced/Expert direct controls, Simple preview/collapse and all six appearances are byte-exact to the independently approved D-877 runtime. Fresh tests below personally re-executed their routing, responsive geometry, reduced-motion, forced-colour and accessibility contracts against those exact served bytes.
- Live Project status displayed exact Order 310 built, current order 311, independent review 91, active Phase 7, and invariant referee 11/11 required. This remained recorded truth and did not execute or inflate any status.
- Live browser console warnings/errors observed during the successful acceptance workflow: **0**.

## Commands and executable results

Container/image/topology evidence used `docker ps -a`, secret-safe `docker inspect`, `docker image inspect`, `Invoke-WebRequest /health`, `Test-NetConnection` for the six bounded ports, and in-memory SHA-256 comparison of served assets to runtime source. Exact results are recorded above.

Read-only database evidence used `docker exec ... psql ... "BEGIN READ ONLY; SELECT ...; ROLLBACK;"`; exact counts are recorded above.

Focused presentation/navigation command:

`bun test tests/operator-management-demo-navigation-finetune.intentional-red.test.ts tests/operator-today-command-centre.integration.test.ts tests/operator-adaptive-experience.test.ts tests/operator-appearance-geometry.test.ts tests/operator-ui-foundation.test.ts`

Result: **25 pass, 0 fail, 376 assertions**, including real Chromium responsive geometry. The tests prove exact seven controls, root canonicalization ordering, all explicit routes, shared close/focus navigation, Advanced/Expert direct access, six-theme orthogonality, responsive containment, reduced motion, forced colours, GET-only Today reads and no added browser/domain authority.

Governance/static check:

`git diff --check d2522e2..fd1f7a63f99dd9ad1337289b146fc6da8685d99f` → pass.

## Approval boundary

**APPROVE** exact Order 317 governance candidate `fd1f7a63f99dd9ad1337289b146fc6da8685d99f` and the sole loopback local described above. Approval is limited to the exact app-only local refresh. It grants no database, credential, business, status, statutory, post-310, public-network, deployment, rollback-deletion, merge or push authority.
