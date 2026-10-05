# Order 671 delivery receipt

Date: 2026-09-24. Status: scoped draft-editor slice delivered and browser verified.

## Working slice
- Settings > Business mappings is a lazy-loaded client editor, not a JSON text area.
- MSG/MS demand groups, independent distribution groups/sources/channels, and market
  code to segment relationships are editable with labeled forms and bounded validation.
- Existing company and room-class mappings are preserved; their editing is not claimed.
- Authenticated property-scoped API reads active and latest draft configuration and
  saves new audited draft versions to PostgreSQL with a stale-version conflict check.
- Shared `TableControls` and `table-query` provide search, up to five AND filters and
  three sort levels; the market mapping list is the first new adopter, not all tables.
- Collapsible cards and the existing selected-yellow ribbon keep the initial view
  compact. Code loads on entering the editor, not on the normal Today screen.

## Verification
- Independent write-boundary proof: reviewer `/root`, implementer
  `/root/mapping_backend`, 5 real PostgreSQL tests, 0 failures, 24 assertions.
- Focused regression suite: 34 tests, 0 failures, 151 assertions.
- Root and frontend strict TypeScript pass; import boundaries pass (206 source files).
- Production Vite build passes (491 modules). Editor is approximately 6.0 KB gzipped
  JavaScript plus 1.9 KB CSS, lazy-loaded. No LLM/network request per filter keystroke.
- Public browser read showed active v1, no saved draft, and edit access granted.
  Search MICE returned 1 of 5 rows; exact filter plus descending sort returned 1 of 5.
  Browser error log empty at that check. Unsaved test changes were never submitted.
- Native `window.confirm` stalled the embedded preview. Replaced it with in-page
  confirmation dialogs; personally verified Keep editing, reload Cancel, restoring
  the original field, and returning to Property overview in a fresh browser tab.
- Final 390px mobile check: compact ribbon/cards and two-column version pills,
  no horizontal overflow, no browser console errors. Fresh preview tab4 retained.

## Deployment boundaries
Source: D:/Yellow/git-live-order611-source-v2, existing dirty branch preserved.
Only `yellow-public-demo-app-1` is rebuilt/recreated on port3010; no duplicate app,
database migration, role grant, active mapping edit or financial/lifecycle write.
Rollback image retained as `yellow-public-demo-app:before-order671` (previous668image).
Final image: sha256:dbfa88af5e530bc93536e8934a71ccf30bc81004dcd195dbf713dd262a8cc9d9.
Entry asset: index-BevCXuGc.js; health check is healthy. Disposable proof DB removed.
No commit, PR, GitHub push, permanent hosting, full PMS completion or 50ms guarantee
is asserted. Public review URL remains a temporary Cloudflare tunnel.

## Explicit follow-ups
Effective-dated activation/history-safe attribution; client-owned rate/company purpose
rules; sales portfolios and product intersections; shared controls adopted by remaining
tables. Draft persistence does not imply that any of these are active.
