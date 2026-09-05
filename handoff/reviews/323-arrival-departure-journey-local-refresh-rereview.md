# Order 323 fresh non-operating Tier 3 rereview

**Disposition: APPROVE**

**Reviewer:** Codex, fresh non-operating Tier 3 rereviewer

**Governance candidate:** `6e11d4c0b7ca57234a2b47b2c715cd5a9f174360`

**Runtime source:** `9bc9ad2e3463e8588d16b2c382cf15a589272628`

**Running image:** `sha256:093fd44fb33cf1d8f4d4d4c0b0d7f77ae62df832549899968885e276ba999c93`

## Disposition

**APPROVE** the exact remediated Order 323 candidate above. The D899 P1 is closed in
the live sole local: the protected process-only defaults survive a delayed fresh load,
recover after later browser clearing and lifecycle signals, preserve non-empty founder
input, and support one-button authentication. Runtime identity, topology, data,
recorded status and the approved Order 322 arrival/departure alignment also pass.

All rereview operations were read-only except the required authentication request. I
did not restart, replace, rename, create or delete any container, image, network,
volume, credential, environment, database or business record.

## D899 P1 closure — personally executed fresh-browser proof

I launched an isolated temporary Chromium profile at the signed-out loopback root. No
cookie, storage or prior Yellow session was inherited, and no credential value was
printed or recorded.

- The root and helper returned HTTP 200 with exact `Cache-Control: no-store`.
- The document contained exactly three non-empty protected local-default payloads and
  loaded `/assets/operator-local-prefill.js`; the helper contained the later focus,
  pageshow and visible visibility-change restoration hooks.
- After the helper loaded and an additional 1.8-second wait, tenant, email and
  password were all non-empty.
- I cleared all three fields separately, then dispatched focus, pageshow and a
  visibility-change while the document was visible. Every signal restored every
  empty field.
- I entered distinct non-empty founder-marker values, dispatched focus, and proved
  all three remained unchanged. Clearing them and dispatching focus restored the
  protected defaults again.
- Clicking the existing submit button without typing authenticated successfully;
  the login view hid, the workbench opened and exactly two properties loaded.
- Browser console warnings/errors were 0. Apart from the required login request,
  observed non-GET/HEAD/OPTIONS business mutations were 0.

No credential was embedded in this review. The default operator document remains
credential-free outside the explicit loopback/process configuration, and the helper
uses no local storage, session storage, IndexedDB or cookie.

## Exact runtime, topology and preservation

- `yellow-order323-app:9bc9ad2` resolved to the exact image and OCI revision above.
- `yellow-order323-app` was the sole UI publisher at
  `127.0.0.1:3000->3000/tcp`, healthy with restart count 0 on
  `yellow_order311_local`; `GET /health` returned HTTP 200 and exact
  `{"status":"ok"}`.
- `yellow-order323-app-rejected-d899` and
  `yellow-order321-app-rollback-d893` remained stopped with restart count 0.
- Current and Order321 rollback environments each had 24 names and exact-value
  secret-safe sorted SHA-256
  `08212c62fddd8175c874f54292c262629af8ccff89231009dd2f56387e3d4a95`.
- PostgreSQL, provider and Valkey remained healthy with restart count 0. Ports 3002,
  3123 and 3188 remained closed.

Explicit `BEGIN READ ONLY`/`ROLLBACK` database probes before and after browser work
were identical: 59 schema migrations, 110 public base tables, 2 public views, 100
public policies, 2 property nodes, and party/contact-point/party-role/fact-log/outbox
counts of 8/0/8/75/22. This corroborates zero business mutation.

## Authenticated routes, status and alignment

- A token-bound in-browser probe covered Today, Availability, Reservations, Folios,
  Operations, Inventory, Restrictions, Rates, Housekeeping, Vehicles, Cashiers and
  Project status for both properties: **24/24 HTTP 200 with exact `no-store`**.
- Live Project status remained exact: Order 310 built; current order 311; 91
  independently reviewed orders; Phase 7 active; invariant referee 11/11 required.
- Both properties across Simple, Advanced and Expert produced **6/6 green cells**:
  exactly seven unique journey destinations, one `today` identity, one
  `Arrivals & departures` label, and that label plus the exact due-in/due-out/in-house
  copy under Stay operations.
- Activating the changed control resolved to the canonical property `/today` route,
  restored focus to `today-title`, and retained the exact due-in, due-out and in-house
  lanes.
- Apple, Android, Windows 95/98, Glass, Neo and ERP each kept the changed control
  visible and within a 375 x 900 viewport with zero horizontal overflow.
- Browser console warnings/errors were 0; business mutations after excluding the
  required login were 0.

## Personally re-executed focused proof

I ran the local-prefill security proof plus the eight Order 322/navigation/Today/
adaptive/geometry/foundation files. Result: **43 pass, 0 fail, 540 assertions across
9 files**. The Chromium geometry test personally executed and passed its contract
widths.

`git diff --check` passed. Before this review file, the pre-existing untracked
`.yellow/` directory was the only worktree status and was not touched.

## Approval boundary

This approval is limited to the exact candidate, runtime and image above. It does not
authorize post-310 statutory expansion, merge, push, public exposure, deployment,
credential change, database mutation, rollback deletion or any further local
replacement.
