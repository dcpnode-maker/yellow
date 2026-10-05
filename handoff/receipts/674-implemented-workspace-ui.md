# Order 674 — implemented workspace UI

24 September 2026. Bounded UI slice delivered to the existing live review app; not whole-ecosystem completion. Founder approved the revised dense reservation-table concept and requested implementation. No backend/database change in this release.

## Implemented

- One shared header in all ten active shells, grouped desktop navigation with persistent collapse preference, and mobile slide-out navigation with property context, backdrop, keyboard containment and Escape/focus restoration. Existing guarded navigation callbacks remain authoritative.
- Compact gray capsule ribbons with white moving selection, disclosure, mounted content transitions and reduced-motion handling. Native contextual drawer preserves modality and return focus; modal lifecycle is independent of callback identity.
- Arrivals, departures and in-house switch in place with browser history and per-lane view state. Shared configurable columns, independent channel/source/market, correct assignment labeling, property-local dates and retained travel criteria. Mobile no longer hides selected columns via the legacy breakpoint rule.
- Real column menus and shared search/filter/sort controls in movement, folio and business-mapping tables. More than five filter rules and three unique sort levels; reorder/removal and exact bigint comparisons retained. Draft row identity and server balances preserved.
- Compact authorized search results show entity, dates/room/confirmation and destination, with All/Stays/Profiles tabs. Search remains limited to the existing reservation/profile sources; it is not an all-module index.

## Reference coverage and skill influence

The team read all 24 public lesson transcripts linked from Kole Jain's resource catalog, including the prior two public lessons. Source/time/applicability ledger: D:/Yellow/git-live-order611-source-v2/docs/design/KOLE-INTERACTION-SYSTEM.md. Public transcript review does not establish frame-by-frame video or gated asset review. Download/preview still opens the access gate; no Figma asset was downloaded and no access-control bypass occurred.

Frontend-building/testing skills required a functioning same-app implementation, responsive interaction proof, and same-pass comparison of the accepted concept and saved rendered screenshot. React guidance informed stable modal lifecycle and shared listeners. No new framework, runtime package, model provider or subscription was installed.

## Executed proof

Root: 62 tests / 0 failures / 286 assertions across Order674 shell/movement/query/search, Order668 search model, Order671 query/mapping UI, Order673 ribbon/theme and yellow-today-workspace. Subsequent corrected Order668 search-surface: 4 / 0 / 64. Total focused root proof: 66 / 0 / 350.

`bun run typecheck`: root and frontend pass. `bun run boundaries`: 206 TypeScript files pass. Vite: 501 modules pass. Scoped diff checks pass. This is not a full-repository all-tests or fresh database-referee claim. No PR or commit was created.

Independent reviewer /root/kole_design_lead personally executed 11 shell/ribbon/theme tests (77 assertions), then 46 table/search/folio/mapping integration tests (256 assertions), and strict typechecks. Reviewer did not implement those reviewed components. Found and rechecked callback-identity drawer focus reset; also identified obsolete search-shell assertions, now strengthened to check each of ten shells individually. Record: D:/Yellow/git-live-order611-source-v2/handoff/reviews/674-shell-independent-review.md. Root independently executed and inspected the movement agent's implementation.

### Browser checks (in-app Chromium)

- Desktop rail collapses/expands; movement tabs change URL without document reload. Departures search Noah gives 1/11, arrivals retains its separate 11/11, Back restores 1/11.
- Header Guest filter Noah gives 1/11; clearing chip restores 11/11. UI accepts six filter rules and four sort levels.
- Search Noah reports 32 matches with a visible 30-result cap; Stays shows all six stays, correctly filtered before cap. Entity dates, profile destinations and cashier links are distinct. Existing duplicate seeded profile identities are not silently merged.
- Mapping field Market code 3 changed temporarily to MICE_QA, then descending sort retained its original identity. Restored MICE; Save draft disabled again. No save submitted.
- All-workspaces compact disclosure expands; Operate selection updates the same region. Contextual preview opens native `dialog:modal`; Close is focused, Escape closes and restores View boundary focus.
- 375x812 menu: current property visible, main inert while open, tab remains within menu, Escape restores trigger. Twelve table fields including Billing remain rendered; horizontal scrolling is contained to the table. No page overflow (document360px inside375px viewport with scrollbar).
- Reduced-motion emulation gives navigation and ribbon transition duration 0s; emulation and viewport restored afterward.
- Relevant console warnings/errors: none in candidate run. No financial, reservation, occupancy or configuration mutation submitted.

## Visual fidelity ledger

Compared approved exec-2e613d3c-997a-44fa-b3f2-48da93494e6a.png and saved rendered image using view_image in the same QA pass. Desktop comparison at1672x941; mobile at375x812.

| Landmark | Implemented result / intentional deviation |
|---|---|
| Neutral professional shell | White/gray surfaces, yellow identity, consistent outlined icons; retained real guarded navigation labels. |
| Sidebar hierarchy | Operate/Business/System groups; collapsible rail and mobile drawer. Property selector also appears in sidebar, unlike concept. |
| Capsule navigation | Gray group and moving white selected capsule; actual11/11/3 counts replace illustrative24/18/96. Compact width follows actual content. |
| Table toolbar density | Collapsed shared toolbar measured53.6px high; table top327.7px, close to concept324px. Working combined filter/sort disclosure replaces separate illustrative buttons. |
| Data density | 54px operational rows with horizontal column scrolling; concept's tighter illustrative rows are not copied at the expense of touch targets/real labels. |
| Data/copy truth | Arrival time is not relabeled guest ETA; actual property/rates/currency and sources used. Missing class/code/meal bindings were not filled from synthetic concept data. |
| Mobile parity | Slide-out workspace hierarchy and every selected table column accessible. Full redesigned reservation editing and mobile task sheets remain a separate acceptance scope. |

Saved screenshots: C:/Users/astha/AppData/Local/Temp/yellow-order674-desktop.png and yellow-order674-mobile-menu.png. These show implemented UI, not generated mockups.

## Single-app release

Old image retained as yellow-public-demo-app:before-order674, digest9eca2e4ce16d2793de1efef8d3022580da945acbb1bc3f94d192447f85b871df.

UI-only image FROM that exact previous image, copying built public/yellow-next assets only. Backend/runtime/environment preserved; no rebuild from unrelated dirty backend changes. New digest1fd42b27a901615d45fc06cf3698f959a305ddf96125073119d109167e87aa19, tagorder674-ui and currentlatest. Compose replaced only yellow-public-demo-app-1 with --no-deps --no-build. Existing PostgreSQL, Valkey and tunnel were not restarted. Local3010health200, publicroot200, publicHTML references index-LBtUWdVk.js; container healthy.

Review URL: https://lying-jones-terminal-church.trycloudflare.com/p/6081b544-22a1-534f-a86d-bb1ae0519e14/today?lane=due_in

Public in-app browser after cutover: Arrivals11/11 → In-house3/3 → Arrivals11/11 with matching lane URLs, new shared navigation and no console warnings/errors. Live tab retained for founder review.

The URL is the existing temporary Cloudflare tunnel, not a newly provisioned permanent domain. The UI-only local preview proxy was stopped and its temporary script plus temporary Dockerfile removed after verification. Saved screenshots and rollback image remain. No second application/database remains from this task.

## Explicit remaining gaps

Room class, rate code, meal plan/package inclusion and financial/relationship-band read bindings need a scoped backend follow-on; no fabricated placeholders count as completion. Whole-ecosystem implementation, all-module search/history, permanent tunnel, full mobile editing acceptance, saved views/pinning/reordering, 50ms performance SLA and paid/gated asset access are not completed by Order674. Source stays in the existing dirty integration worktree; no Git publication claimed.
