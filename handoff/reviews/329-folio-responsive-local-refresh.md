# Order 329 fresh independent non-operating Tier 3 review

**Disposition: WITHHOLD**

**Reviewer:** Codex `/root/order329_fresh_tier3`, fresh independent non-operating Tier 3 reviewer

**Governance candidate:** `5e29ea08488a9ae8bc18e6765c11954f296766b9`

**Runtime source:** `f11440e9f0f0fd78dbe4c1a8b9fedc4b09330aee`

**Running image:** `sha256:fc8cbf2500bcc6e70d5852b52f927663a59d2487a382c6cdc9f1922238828e09`

## Disposition and finding

**WITHHOLD** Order 329. The live loaded Folio is contained at 375 CSS pixels and its
workspace is contained at both required widths, but the complete live document still
overflows by **64 px at 640 CSS pixels / device scale factor 2**. Chromium reported
`innerWidth=640`, document `clientWidth=625`, `scrollWidth=689`; body overflow was
also 64. The exact offender is `HEADER.app-bar`: left 0, right 625, client width 625,
scroll width 689, computed `overflow-x: visible`. Root and body also compute visible
overflow. This is the same 640 px magnitude found in D-913 and contradicts Order 329's
required document/workspace overflow0. Order 328's reviewer proof used an isolated
loaded-Folio fixture without the live app bar, so it did not execute this full-shell
condition.

The same browser run recorded one failed-resource 404 console error. No business
write request occurred. The responsive overflow alone independently requires the
withheld verdict.

I did not implement or operate the refresh. I did not start, stop, restart, rename,
replace, create or delete a container, image, network, volume, credential or database
record.

## Exact runtime, topology and preservation

- `yellow-order329-app:f11440e` resolves to the exact OCI revision and image above.
  Container `76f16e8d7c2fff967b8c24c492ab86222bd06a10ca03af1d89328d983d89698e`
  remained the sole healthy publisher on `127.0.0.1:3000`, restart count 0, on
  `yellow_order311_local`, with the inherited wget health command and exact health
  body `{"status":"ok"}`.
- Stopped Order 327 rollback
  `21786bc8320b1d1f2bb79a635d0518bbb56ee0f8c97585728745b63b151a8f78`
  remained present with restart count 0 and runtime revision `5c37533`.
- Current and rollback each had 24 environment entries and identical secret-safe
  sorted-value SHA-256
  `08212c62fddd8175c874f54292c262629af8ccff89231009dd2f56387e3d4a95`.
  No protected value was printed or recorded.
- PostgreSQL, provider and Valkey remained healthy with restart count 0 on the same
  network. Loopback 3000, 3001 and 6389 were open; obsolete 3002, 3123, 3188 and 3318
  were closed.

## Browser, focused and database proof

The protected no-store root restored all three non-empty defaults after delayed load,
focus and pageshow; non-empty founder markers survived restoration. One-button login
authenticated `Yellow Review Operator` without credential inspection or output and
returned exactly two properties. Both properties' twelve explicit shell routes were
24/24 HTTP 200 with exact `no-store`. Project status was exact: Order 310 built,
current order 311, 91 independently reviewed orders, Phase 7 active and 11/11 required.

Across two properties, Simple/Advanced/Expert and all six appearances, **36/36 cells**
retained exact `Separate charges`, `folio-tab-organize`, the
`folio-organize-panel` ARIA relationship and tabpanel, internal `Organize whole charge
groups`, and `Correct a wrong charge`; scoped old-label count was zero. Reduced motion
and forced colours matched, and ArrowRight moved selection and focus to the next tab.
At 375/DSF2 document and workspace overflow were zero and the workspace rail was a
local `overflow-x:auto` scroller. At 640/DSF2 the Folio workspace remained zero and its
rail remained local, but the full document failed as detailed above.

Reviewer-run focused proof covering protected login, geometry, label/routing/
workbench, whole-group transfers, adaptive experience, appearance geometry and UI
foundation produced **48 pass, 6 expected database-gated skip, 0 fail, 517
assertions**.

Explicit `BEGIN READ ONLY`/`ROLLBACK` PostgreSQL snapshots before and after browser
work were identical: **59** migrations, **110** public base tables, **2** views,
**100** policies, **2** properties and party/contact-point/party-role/fact-log/outbox
counts **8/0/8/75/22**. Business mutations were zero. The exact app remained healthy
with restart count 0 after proof.

## Approval boundary

No approval is granted. Remediation must address the live 640/DSF2 full-shell app-bar
overflow without hiding global overflow or changing business/data authority, then use
a new exact candidate and fresh independent non-operating Tier 3 review.
