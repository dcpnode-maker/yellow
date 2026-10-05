# Orders686/687 — bounded live reservation-family delivery

24 September2026. Coordinator root; UI worker reservation_workspace_research;
group implementer ecosystem_journey_gaps; independent reviewer
order679_independent_review. Existing approved UI, not a new Yellow application.

## Serving result

One existing app service `yellow-public-demo-app-1` now runs image
`51be39202064765e2475209460fba0092547c615b28979826cd09fdf00b06bfd`, tag
`yellow-public-demo-app:orders686-687-candidate`. Public URL remains
https://lying-jones-terminal-church.trycloudflare.com . Only app was recreated;
database, cache and tunnel services were not recreated. Source remains dirty in
D:/Yellow/git-live-order611-source-v2; no clean Git/PR/merge claim.

- One collapsible Reservations parent: Individual / Groups / Calendar, with
  in-place sibling changes, URL/back history and matching inner gray pill ribbon.
- Compact Search / Filter / Sort / Columns, one editor at a time, arbitrary
  supported filter levels, ordered sort levels and existing per-column menus.
- Individual drafts stay mounted across sibling views. Groups mounts on first
  visit and stays mounted; property-keyed pending-command storage protects exact
  create/link retry keys, and missing browser storage blocks the write.
- Create a linked group with persisted server-generated group code, open its
  staff workspace, find a pre-arrival reservation by confirmation and link it.
  Existing room-block groups and their reservations remain readable.
- This is NOT inventory block creation/allotment/pickup/wash/master-folio editing.
  Linked groups hold no rooms. Room-block overview is a separate closed disclosure.

## Database and rollback evidence

Verified exact public target `yellow_public_demo`, PG18.6, ledger99/count99,
owner yellow_owner, tenant RLS and runtime/app role membership before mutation.
Backup `D:/Yellow/runtime/backups/order687/yellow-before-order687.dump` is
2,766,771 bytes; custom archive manifest read successfully (not a restore proof).
SHA256 `030f286b62f6c6e2a27ed813778e30b1392aab8fed716d7b322f734a98eee4b4`.
Normal checksummed runner verified prior files and applied0100 then0101 on backend
293722; ledger now101.0100 already independently approved in review635.
0100 SHA256 `f70844b2c8205c286f7f552dd1f8a4a2023645f70dcd00dbdacc7c777b0415d4`;
0101 `3e89c0a8da1d7173b9b8def0bc99fff527996fb73248a57880fa1b1204c39d21`.
Prior app f8406c78 retained as `before-orders685-686-687`. Database migrations
are forward-only; image rollback alone does not remove the added column grants.

## Executed checks

- Independent reviewer: actual isolated PG18 group proof6/0/29; canonical
  invariant referee11/11; scoped service/HTTP/UI/readiness17/0/289; full types and
 208 import-boundary checks. Exact final storage-guard spot check recorded in687review.
- Root combined targeted suite before release split49/0/574; final CSS specificity
  regression repaired after a failing literal-color expectation; focused13/0/106.
  Full typecheck and default Vite build pass. Not a full-repository CI claim.
- Image app/group imports pass. Zero Cesium/GodEye engine or asset files in this
  default build (native feature deliberately off). Native map is not live.
- Live /health200 and Docker healthy. Live authorized groupsGET200; invalid empty
  create400, no test booking/group written on serving DB. Actual public browser
  loaded two existing groups, opened one with four member links, and loaded the
  room calendar with real room/stay rows.
- Actual public search 'Priya' reduced134 rows to6. Filter loaded real state/type/
  rate options; Sort accepted a second level; canceled and reset after inspection.
- Browser sibling navigation changes only ?view, collapsible parent and mobile
  drawer selection work, active pill matches route. Synthetic group draft retained
  across Groups->Individual->Groups. Independent DB proves actual writes; browser
  creation was not executed on live customer data.

## Visual QA against approved reference

Viewed founder reference 3-1000510280.jpg and saved actual live screenshots with
view_image: D:/Yellow/temp/order685-evidence/groups-live-desktop.png and
groups-live-mobile.png. Five checks: gray containing rail/white active pill;
clear Reservations parent/three child hierarchy; consistent22px/12px workspace
padding; creation before staff group/member containers with blocks disclosed;
mobile375px layout without horizontal overflow (360px content plus scrollbar),
44px touch controls and universal search retained. Earlier CSS collision from
calendar pill styling was fixed with workspace scoping and recomputed colors.

## Explicit outstanding gates

Native map licensing is pending founder response (see685 receipt/question).
The existing image already contained tslib2.8.1 under0BSD, rejected by the current
licence allowlist. Baseline and this image produce exactly that same failure;
no new runtime dependency was added. The native candidate adds pako2.2.0's Zlib
condition and is excluded from the deployed build, not waved through the gate.
Full licence CI is NOT green. PG18 raw schema dump versus canonical PG16.15 snapshot
also remains known version drift; scoped101 snapshot delta is independently reviewed.
Both old baseline and this image lack immutable build revision (empty image
YELLOW_BUILD_SHA); /ready correctly returns503 build_revision_unavailable, although
/health and the reviewed UI/API routes work. No invented SHA was injected to hide
that inherited provenance gap. Clean immutable source packaging remains required
before claiming production release readiness.

## Test-service cleanup

The coordinator removed only `yellow-order687-proof` after confirming its exact
name, PG18.6 image, tmpfs-only data directory and empty persistent mounts. Its
disposable synthetic proof data is gone and can be recreated by the test suite.
The loopback4175 UI fixture was also stopped. Live app/database/cache/tunnel and
unrelated pre-existing development services were left running.
