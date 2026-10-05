# Order 681 independent review — reservation room calendar

2026-09-24. Reviewer: Codex agent `order679_independent_review` (independent of the Order 681 backend and frontend implementers). Serving source: `D:/Yellow/git-live-order611-source-v2`. I did not implement the calendar or deploy it.

## Decision

**Source admission approved**: I found no remaining blocking correctness or authorization defect after the expanded database fixture and empty-room UI correction. The coordinator still owns mounted desktop/mobile browser proof and guarded promotion of the exact candidate image. This is not a claim of deployed/live UI acceptance, group booking implementation, or date-specific sellable availability.

## Corrections reviewed

- Initial SQL selected an instant-overlapping segment whose checkout fell on the requested first local date. The revised query also requires local start date `< toDateExclusive` and local end date `> fromDate`, preserving half-open nightly semantics. The executed DST fixture asserts that a November 2 checkout does not appear on November 2, and that a November 4 checkout does not appear on November 4.
- Initial inner joins could silently drop a segment with missing joined guest or room-type context, while a mismatched room could paint as unassigned. Revised joins retain source segment identities and fail closed with a conflict when an applicable join is missing or mismatched. The focused fake-transaction test exercises these cases.
- Backend uses the existing `reservations.lifecycle:read` scope, granted-property check, tenant transaction, and tenant/property predicates; strict local-date validation runs before SQL. It returns all applicable non-cancelled stay segments, independent room rows, and separate explicit `limit=1000`/`roomLimit=500` truncation flags. Room condition is labeled current context and out-of-service means a block overlaps the requested window, not per-date readiness.
- Frontend uses one Reservations workspace with List / Room calendar / Groups navigation; stay cells target canonical reservation detail. It shows an explicit warning that blank cells are not sellable availability, plus loading, error/retry, empty, and partial-result states. Local-date helpers use UTC date arithmetic rather than elapsed property-local hours. Mobile CSS provides a horizontally scrollable seven-day grid. Actual mobile reachability remains for coordinator browser proof.

## Personally executed proof

- Created exact disposable database `order681_review_20260924` and temporary non-superuser runtime role `order681_review_runtime` on **dev PostgreSQL port 5442 only**, applied `migrations/0001_init.sql`, and ran with `YELLOW_REQUIRE_RESERVATION_CALENDAR_DB=1` and separate deploy/runtime URLs. No public PostgreSQL port 55432 or hotel data was touched.
- Initial run: `bun test tests/reservation-calendar.test.ts tests/reservation-calendar-http.test.ts tests/reservation-calendar.integration.test.ts tests/reservation-calendar-ui.test.ts` → **11 pass, 0 fail, 76 assertions**. The PostgreSQL integration test executed, not skipped; it covered New York DST, both room-move segments, empty room, local checkout exclusions, cancelled parent, same-tenant other property, and foreign-tenant rejection. Backend owner separately ran its three backend files serially on that disposable DB: 7 pass, 0 fail, 49 assertions (reported by owner, not substituted for my proof).
- Following the fixture and frontend follow-ups, I rebuilt the same exact disposable dev DB and personally reran all four files with required DB mode → **13 pass, 0 fail, 89 assertions**. The new live PostgreSQL case inserted 501 additional rooms and 1001 segments, then verified 500/1000 returned with `roomsLimited=true` and `limited=true`; it cleaned inserted rows in `finally`. The other case now includes a cancelled segment under an active reservation and verifies exclusion.
- `bun run typecheck` → backend and frontend TypeScript pass, including after the follow-up changes.
- `bun run boundaries` → `Import boundaries OK: 207 TypeScript files scanned`, including after the follow-up changes.
- After the first serial reviewer/implementer runs, I verified zero active connections and dropped only the exact disposable database and temporary role. I rebuilt them for expanded fixture proof. The backend owner subsequently reran the enhanced backend suite serially (**8 pass, 0 fail, 58 assertions**, owner-reported). I again verified zero active connections, then dropped the exact disposable DB and role. No test DB, temporary role, or local secret file remains.

## Follow-up and remaining release proof

- The first fixture did not test real database LIMIT+1 or active-parent segment cancellation; both cases were added and personally passed in the 13-test rerun above.
- The first frontend version suppressed room rows when no stays matched. The revised grid renders whenever `rows.length > 0`, retaining authoritative empty room rows alongside the explicit no-stays/no-filter-match message; its added UI test passed in my rerun.
- The coordinator must personally verify mounted desktop/mobile date navigation, stay-to-detail, empty/error/retry, and exact-image promotion over the existing Order 679 app. I did not run a concurrent browser session.
