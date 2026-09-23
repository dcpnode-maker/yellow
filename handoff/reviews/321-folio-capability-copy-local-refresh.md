# Order 321 fresh non-operating Tier 3 review

**Disposition: APPROVE**

**Reviewer:** Codex, fresh non-operating Tier 3 reviewer

**Governance candidate:** `608bc005a1117af4f8250db35883f4ba63c5ddf1`

**Approved runtime source:** `94e76a8b2788e59298a0e16cdcb9267df30bb23a`

**Running image:** `sha256:6e1142348cc76ff1f971bb04408586fba12b4771e6a1ccbff8f0f1bd494bd819`

No finding.

## Scope and exact identity

I read `PROJECT.md`, ran `./state.sh`, and read Order 321 plus D-890 through
D-892 before review. `git rev-parse HEAD` returned the exact governance candidate
above; `git diff --check` passed. The pre-existing untracked `.yellow/` directory
was the only unrelated worktree status.

Read-only Docker inspection proved `yellow-order321-app:94e76a8` resolves to the
exact image above and carries exact OCI revision
`94e76a8b2788e59298a0e16cdcb9267df30bb23a`. Container copies of
`operator.css` and `operator.js` were byte-identical to both the exact approved
source and served assets. The container `index.html` was byte-identical to the exact
approved source; the served shell differed only by the already-approved local-prefill
script injection. The protected page rendered the three approved login field
identities and enabled successful one-click authentication without exposing values.

## Live topology, health and preservation

All inspection was non-operating and read-only. I did not stop, restart, rename,
replace or mutate any container, network, volume, environment, credential, database
or business record.

- `yellow-order321-app` was the sole UI publisher at
  `127.0.0.1:3000->3000/tcp`, running healthy with restart count 0 on
  `yellow_order311_local`, with the exact approved health command.
- `GET /health` returned HTTP 200 and exact `{"status":"ok"}`.
- `yellow-order319-app-rollback-d887` remained exited with restart count 0 on exact
  prior image `sha256:9daa7e708ede3c170ed68ab9d32127fdae347e69a146d5184392cc54d6fb04c9`
  and revision `e46af12016ea0b0811315619f0344a5482c4930c`.
- Current and rollback environments contained the same 24 names and identical
  values after name-canonicalization, with secret-safe SHA-256
  `08212c62fddd8175c874f54292c262629af8ccff89231009dd2f56387e3d4a95`.
  No value was printed.
- PostgreSQL, provider and Valkey were each running healthy with restart count 0.
  Intended ports 3000, 3001 and 6389 were open; obsolete 3002, 3123 and 3188 were
  closed.

### Read-only database proof

An explicit `BEGIN READ ONLY`/`ROLLBACK` transaction returned exact unchanged truth:
59 schema migrations, 110 public base tables, 2 public views, 100 public policies and
2 property org nodes; party 8, contact point 0, party role 8, fact log 75 and outbox
22. A final read-only recount after all browser acceptance remained exactly the same.

## Protected login, routes and recorded status

- The approved protected local login authenticated Yellow Review Operator by one
  button activation and granted exactly two properties.
- A fresh token-bound probe covered Today, Availability, Reservations, Folios,
  Operations, Inventory, Restrictions, Rates, Housekeeping, Vehicles, Cashiers and
  Project status for both properties: **24/24 HTTP 200 with exact `no-store`**.
- Live Project status remained deliberately truthful: Order 310 built, current order
  311, 91 independently reviewed orders, active Phase 7 and invariant referee 11/11.
  The live service cards also loaded under the refreshed authenticated session.

## Personally executed live-browser acceptance

I used fresh authenticated browser state only against the sole loopback app.

- Both property identities across Simple, Advanced and Expert produced **6/6 green
  cells**. In every cell the exact two Order 320 paragraphs were visible, the Today
  Financials paragraph kept Cashiers separate, and the Folios paragraph retained its
  conditional server-authorized wording plus explicit tax, invoice, fiscal-document
  and checkout boundaries.
- Every cell retained exactly one `Find via reservation` bridge, all five existing
  Folio tabs and all seven existing Folio action identities. Cashiers navigated to a
  distinct canonical route and visible `Cashier workbench` heading.
- A deliberately unavailable `FOL-1` lookup produced the bounded generic not-found
  state with settlement hidden. Canonical `ARR-CLEAN-1` then loaded the singular UUID
  Folio route with its immutable USD statement, all five existing tabs, eligible
  charge/deposit/organize/direct-billing surfaces and visible enabled settlement.
  This proves the copy remains conditional on current server state rather than making
  the tools unconditional.
- At 375x900 across Apple, Android, Win95, Glass, Neo and ERP, the exact Folios copy
  and bridge were visible, within the viewport and had zero horizontal overflow.
  At 812x375 landscape they remained contained. At the bounded 200%/640-CSS-pixel
  proof the changed copy and bridge remained inside the viewport; this approval makes
  no broader claim about unrelated shell geometry outside Order 320's two paragraphs.
- Reduced-motion and forced-colours emulation were active and retained visible,
  contained copy and bridge with zero 375px overflow. Keyboard-origin focus landed on
  `folio-find-via-reservation` with `:focus-visible` true.
- Browser console warnings/errors: **0**. I invoked only authentication, navigation
  and read paths; no financial or other business action was activated. The unchanged
  final fact-log and outbox counts corroborate zero business mutation.

## Re-executed focused proof

I personally ran the exact Order 320 focused suite over capability copy,
discoverability, management navigation, Folio workbench/routing, hosted deposit,
settlement, receivable transfer, appearance geometry and UI foundation.

Result: **57 pass, 6 database-gated skip, 0 fail, 744 assertions**, including real
Chromium geometry and all static capability/authority boundaries.

## Approval boundary

**APPROVE** exact Order 321 governance candidate
`608bc005a1117af4f8250db35883f4ba63c5ddf1` and the sole loopback local described
above. Approval is limited to this exact app-only reflection of the independently
approved two-paragraph Order 320 presentation change. It grants no database,
credential, permission, business, financial, status, statutory, post-310,
public-network, deployment, rollback-deletion, merge or push authority.
