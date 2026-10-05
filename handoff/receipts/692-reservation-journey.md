# Order692 — five reservation phases

25 September 2026. Built and independently reviewed; public cutover pending.

Individual / Groups / Calendar share one family container. Individual nests
Pre-arrival / Arrival / In house / Departure / Post departure plus All. New
reservation sits in the same container. The hotel's persisted open business date
is visible. Waitlist is explicitly not confirmed inventory. Phase membership may
overlap, and exceptions remain in All; phase totals must not be summed as rooms.

The SQL predicate precedes LIMIT; stage/date-bound cursors prevent mixing pages.
No day produces a clear conflict with an All fallback rather than guessing today.
Grid state remains mounted through phase loading, error and family transitions;
creation recovery locks propagate to the shell. Booking detail links retain a
validated originating phase. No schema change or public reservation write.

Independent reviewer personally executed isolated PostgreSQL18 tests (8/0/116),
canonical referee11/11 and scoped HTTP/client tests, recorded in review692.
Root final combined tests673/684/686/692/693/694/696/board-pages:32/0/246,
full typecheck, boundaries208 and source licence120 pass. Native-enabled Vite
build includes existing God Eye and Overture chunks; map is not removed.

Root CUA against loopback4176's eight synthetic reservations: phase counts
2/2/3/1/1 and All8, deep-link/browser back, quick-search and header-filter
retention across phases. A filtered Arrival correctly remains1 while other
views retain their own filters. No-day fixture returned a visible error with
Retry/Open all reservations; All still displayed8. This is not live acceptance.

## Fidelity ledger

Compared founder F&B capsule reference with rendered desktop1280 and phone390
screenshots in D:/Yellow/temp/order694-menu-desktop.png and
order694-dock-mobile.png (the final header measurement supersedes early shots).

1. Gray parent tracks and white current capsules retain the approved palette.
2. Parent family contains phase children; creation stays adjacent, not isolated.
3. Main content changes within the same work area, with no new full-page theme.
4. Phone six choices wrap to two rows with44px targets rather than tiny tabs.
5. Table headers use44px border-box triggers inside48px rows, verified by DOM
   rectangles; a real inherited-padding overlap was fixed during mounted QA.
6. Desktop fields remain a horizontally scrollable table, not hidden columns;
   filters/sorts and explicit cell-copy affordances remain available.

Adaptation: operational phase names replace F&B content. No claim all creator
resources or all ecosystem features were implemented. Shared catalogue gaps are
recorded separately in receipt695.
