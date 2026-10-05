# Order713 — Today business-day movement scope

Status: live, final image3c8647aa078b3cfb6ec5da2398ac330c6268315630ac95d4c11a92d40c7e126c.
Existing711/712 is retained as before-order713 rollback. Full ecosystem unfinished.

Root read-only serving API confirmed businessDate2026-09-25: stagearrival3,
stagedeparture3, stagein_house14; broadstatusdue_in14 anddue_out14 each. Today had
used those broad status queues and a status=in_house count0, producing misleading
Today values. Existing phase API is reused; no backend, schema or hotel writes.

Builder completion_queue709 added generic injected journey loader with stable
server date, bounded pagination and explicit on-demand past-due filter using the
property timezone and stay boundary, not browser day/travel timing. Root App uses
the same canonical response for dashboard, ribbon and selected table. Checked-in-
today overlap is retained. Past-due selected ribbon reports its own labelled count.
Broad queues remain intact for assistant/operational/business-mix consumers.

Review corrections before release: missing nextCursor rejects instead of silently
truncating; missing timezone metadata is an error with retry, not endless loading;
error/loading hides false-zero toolbar/footer; inline lifecycle settle invalidates
Today data; landing view explicitly labels its server business day. Full root
typecheck initially failed because a pure helper imported a TSX type; Q713 records
the minimally constrained generic correction without changing compiler gates.

Root713+Today+pagination22pass/0fail/107assertions, full types and208 boundaries
pass. Independent review709 personally final seven-file safe suite31/0/161, types
and boundaries; no database fixture or live writes. Initial713 released asde47e63c
with Vite552. Actual mobile browser found unstyled new date-scope buttons; Q713
explicitly scopes the correction in existing movement-ribbon.css. Final independent
followup9/0/69+fulltypes passed; final Vite552, image3c8647aa above, bundle
index-DgKUk9_S.js and index-eiS8zrup.css. Initial visual defect is preserved here,
not represented as a first-pass perfect release.

Root actual public browser verified server businessDate2026-09-25 on the landing
view; counts3arrivals/3departures/14in_house match each unfiltered table. Explicit
Past-due shows11arrivals and11departures with selected ribbon count matching; tabs
return to business-day scope and In-house exposes no irrelevant Past-due control.
In-house search Layla gives1of14; Reset returns14. Final320px control bounds are
100.8/75.2/44px wide, each44px high on one row; page scrollWidth305≤320.390px,
desktop1280px, refresh, unchanged counts, final bundle and no console errors checked.
No reservation, occupancy or financial writes occurred during these read-only checks.

App-only cutovers kept the same PostgreSQL/Valkey/tunnel running; local/public app
and health200, database migrationledger101 unchanged. No extra public instance,
paid provider, repository commit/PR/merge. Inherited ready503/build_revision_unavailable
remains. Wider ecosystem unfinished. A pre-existing generic status label still
calls due_out “Departure today” even in overdue/in-house views; record for the next
explicit copy/query consistency order, do not silently rewrite shared semantics here.
