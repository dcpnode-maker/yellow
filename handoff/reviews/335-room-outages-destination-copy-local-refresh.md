# Order 335 fresh independent non-operating Tier 3 review

**Disposition: WITHHOLD**

**Reviewer:** Codex `/root/order335_fresh_tier3`, fresh independent non-operating Tier 3 reviewer

**Governance candidate:** `09be583`

**Runtime source:** `15516170433b008411bb07e13c8001f823f8e16d`

**Running image:** `sha256:b826c789d413410db1f2bdbb67540feb15ba72d468a730760e77ec4c7da2f059`

## Finding

**P1 — the retained rollback did not stop cleanly.**

`yellow-order333-app-rollback-d932` is present, stopped and restart count0, but its
actual Docker exit code is **139**, not the exact rollback code0 required by Order335
and claimed by D937. Exit139 is not an orderly stopped rollback. I did not start,
stop, restart, replace, delete or otherwise operate it because this review is strictly
non-operating. Order335 cannot be approved until an authorized operator restores or
re-establishes the required clean stopped rollback and a different fresh Tier3
reviewer personally reproduces the proof.

## Passing read-only evidence

- `yellow-order335-app` remained the sole healthy publisher on
  `127.0.0.1:3000`, restart0, exact OCI revision/image above, inherited
  `yellow_order311_local` network, loopback bind and exact wget health contract.
  PostgreSQL, provider and Valkey remained healthy/restart0. Ports3000,3001,6389
  were open;3002,3123,3188,3318 were closed.
- Current and rollback each had exactly24 environment entries and identical
  secret-safe sorted-value SHA-256
  `08212c62fddd8175c874f54292c262629af8ccff89231009dd2f56387e3d4a95`.
  Image copies of operator HTML,JavaScript and CSS were byte-identical to exact
  runtime source1551617.
- Protected one-button login authenticated Yellow Review Operator and returned
  exactly2 properties. Both properties'12 explicit workspace routes were24/24
  HTTP200 with exact `Cache-Control: no-store`. Live status was exact: Order310
  built,current order311,91 independently reviewed orders,Phase7 active,11/11
  required.
- Live Today navigation, Arrivals & departures lanes and Room outages destination
  remained coherent. The canonical operations route, `Room outages` workbench title,
  focused `operations-title`, OOO/OOS heading and controls passed. Static focused
  proof also pinned the initial `Open Room outages…` status, exact operations
  identity/router,three requests,OOO/OOS controls and permissions.
- Reviewer-personal live matrix passed **72/72** cells across2 properties x3 modes
  x6 appearances x375/640 CSS pixels at DSF2 with document/body/workbench overflow0
  and exact Room outages title. Reduced motion and forced colours were active;
  native Space activation retained the canonical route/focus. Console warnings/errors
  were0 and observed non-read network requests were0.
- Focused Room-outages/lane-focus/Separate-charges/Folio/app-bar proof passed
  **15/0 with162 assertions** across6 files.

## Read-only database proof

Explicit PostgreSQL transactions beginning `BEGIN READ ONLY` and ending `ROLLBACK`
were identical before and after HTTP/browser proof: **59 migrations,110 public base
tables,2 views,100 policies,2 properties** and party/contact-point/party-role/
fact-log/outbox counts **8/0/8/75/22**. Business mutations were0. The exact app and
companions remained healthy/restart0 after proof.

## Boundary

**WITHHOLD** exact Order335 candidate solely for the rollback exit-code finding.
This review grants no authority to operate or repair the rollback and no data,
credential,status,permission,authority,post310,public,merge,push,deploy,rollback
deletion or broader product/financial/statutory authority.
