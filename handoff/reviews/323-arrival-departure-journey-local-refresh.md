# Order 323 fresh non-operating Tier 3 review

**Disposition: WITHHOLD**

**Reviewer:** Codex, fresh non-operating Tier 3 reviewer

**Governance candidate:** `ffa160004540f0fb582a9baf71bdb7a24516dbf1`

**Approved runtime source:** `e1113d5b38d7edb9b6abf93dd77160a9805da25e`

**Running image:** `sha256:780bda0a22572a699e54cc1be18e646053496323fbf27c0d8bee6d97e12f23b9`

## Blocking finding

**P1 — the required protected one-click login prefill is absent in the live local.**

On a fresh signed-out load of `http://127.0.0.1:3000/`, the Hotel account field was
filled but the Email and Password fields were both empty. This remained true after
the deferred helper loaded, `pageshow`, two animation frames and an additional
1.5-second bounded wait. The page included and loaded
`/assets/operator-local-prefill.js`, the running container had non-empty
`YELLOW_LOCAL_REVIEW_TENANT`, `YELLOW_LOCAL_REVIEW_EMAIL` and
`YELLOW_LOCAL_REVIEW_PASSWORD`, and `YELLOW_LOCAL_REVIEW_PREFILL=1`; therefore this
is not an absent runtime credential configuration. The helper response remained
`no-store`, but the live login inputs had no `data-local-default` payload and Email
and Password had zero-length current values.

The separately protected `current-founder-login.env` password also did not
authenticate the expected review identity. Authentication succeeded only when the
review used the current running container's configured local-review identity, whose
values were never printed or recorded. This confirms the authenticated app is
available while the required founder-facing credential handoff/prefill is not.

Order 323 explicitly requires a prefilled protected login and builder evidence
claims that requirement passed. A founder cannot activate the promised one-click
login on this exact refreshed local, so Tier 3 approval is withheld.

## Scope and exact identity

I read `PROJECT.md`, ran `./state.sh`, read Order 323 and D-894 through D-898, and
personally inspected the exact candidate. `git rev-parse HEAD` returned the exact
governance candidate above. The pre-existing untracked `.yellow/` directory was the
only unrelated worktree status before this review file. `git diff --check` passed.

Read-only Docker inspection proved `yellow-order323-app:e1113d5` resolves to the
exact image above and carries exact OCI revision
`e1113d5b38d7edb9b6abf93dd77160a9805da25e`.

## Live topology, health and preservation

All runtime inspection was non-operating and read-only. I did not stop, restart,
rename, create, replace or remove any container, network, volume, environment,
credential, database or business record.

- `yellow-order323-app` was the sole UI publisher at
  `127.0.0.1:3000->3000/tcp`, running healthy with restart count 0 on
  `yellow_order311_local`.
- `GET /health` returned HTTP 200 and exact `{"status":"ok"}`.
- `yellow-order321-app-rollback-d893` remained stopped with restart count 0.
- Current and rollback environments contained the same 24 names and exact values,
  with secret-safe sorted SHA-256
  `08212c62fddd8175c874f54292c262629af8ccff89231009dd2f56387e3d4a95`.
  No value was printed.
- PostgreSQL, provider and Valkey remained healthy with restart count 0. Obsolete
  ports 3002, 3123 and 3188 were closed.

### Read-only database proof

Explicit `BEGIN READ ONLY`/`ROLLBACK` transactions before and after all browser
acceptance returned identical truth: 59 schema migrations, 110 public base tables,
2 public views, 100 public policies and 2 property organisation nodes; party 8,
contact point 0, party role 8, fact log 75 and outbox 22. This corroborates zero
business mutation.

## Authenticated routes and recorded status

After the prefill finding, I authenticated with the running container's approved
local-review configuration without displaying its values and completed the bounded
read-only acceptance:

- exactly two property identities loaded;
- a fresh token-bound probe covered Today, Availability, Reservations, Folios,
  Operations, Inventory, Restrictions, Rates, Housekeeping, Vehicles, Cashiers and
  Project status for both properties: **24/24 HTTP 200 with exact `no-store`**;
- live Project status remained exact: Order 310 built, current order 311, 91
  independently reviewed orders, active Phase 7 and invariant referee 11/11.

## Personally executed live-browser acceptance

- Both properties across Simple, Advanced and Expert produced **6/6 green cells**.
  Each cell had exactly one `Arrivals & departures`, exactly one Reservations
  destination, exactly seven journey controls, and the exact Stay operations text.
- The seven unique identities were exact: `today`, `reservations`, `folios`,
  `cashiers`, `housekeeping`, `vehicles`, and `operations`.
- The existing Today identity resolved to the canonical property `/today` route and
  restored focus to `today-title`. Due-in, due-out and in-house lanes remained
  present.
- Existing preparation actions routed to canonical reservation detail workbenches:
  `?workbench=check-in` and `?workbench=checkout`; no action command was submitted.
- Apple, Android, Win95, Glass, Neo and ERP each kept the changed control visible and
  produced zero horizontal overflow at 375 x 900. It remained visible and contained
  at 812 x 375 landscape and within the viewport at the bounded 640-CSS-pixel/200%
  proof. Reduced motion and forced colours were active and retained visibility and
  containment. Keyboard focus landed on the changed control with `:focus-visible`.
- Browser console warnings/errors: **0**.

## Re-executed focused proof

I personally ran:

`bun test tests/operator-arrival-departure-journey-alignment.intentional-red.test.ts tests/operator-management-demo-navigation-finetune.intentional-red.test.ts tests/operator-today-command-centre.integration.test.ts tests/operator-today-operational-routing-ui.integration.test.ts tests/operator-today-operational-routing.integration.test.ts tests/operator-adaptive-experience.test.ts tests/operator-appearance-geometry.test.ts tests/operator-ui-foundation.test.ts`

Result: **35 pass, 0 fail, 482 assertions** across eight files. The Order 322
presentation/navigation alignment itself remains green.

## Disposition boundary

**WITHHOLD** exact Order 323 governance candidate
`ffa160004540f0fb582a9baf71bdb7a24516dbf1`. The sole loopback app, alignment,
topology, database preservation and authenticated read paths are otherwise green,
but the required prefilled protected one-click login is not present and the retained
credential handoff is stale. No repair, restart, rollback, database/credential
mutation, status/authority/post-310 work, public exposure, deployment, rollback
deletion, merge or push is authorized by this review.
